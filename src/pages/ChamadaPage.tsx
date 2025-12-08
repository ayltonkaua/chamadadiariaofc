import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import {
  Check,
  X,
  FileText,
  Save,
  ArrowLeft,
  Loader2,
  Wifi,
  WifiOff,
  MessageSquare
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  getSessaoChamada,
  salvarSessaoChamada,
  limparSessaoChamada,
  sincronizarChamadasOffline,
  salvarChamadaOffline,
  getAlunosDaTurmaOffline
} from '@/lib/offlineChamada';
import { useAuth } from '@/contexts/AuthContext';
import { useEscolaConfig } from "@/contexts/EscolaConfigContext";

// --- TIPOS ---
interface Aluno {
  id: string;
  nome: string;
  matricula: string;
  turma_id: string;
  escola_id?: string; // Fundamental para o offline funcionar
}

interface Atestado {
  id: string;
  aluno_id: string;
  data_inicio: string;
  data_fim: string;
  status: string;
}

// Estado visual único. Não permite ambiguidade.
type Presenca = "presente" | "falta" | "atestado";

const ChamadaPage: React.FC = () => {
  const { turmaId } = useParams<{ turmaId: string }>();
  const { user } = useAuth();
  const { config } = useEscolaConfig();
  const navigate = useNavigate();

  // Estados de Dados
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [presencas, setPresencas] = useState<Record<string, Presenca>>({});
  const [atestados, setAtestados] = useState<Record<string, Atestado[]>>({});

  // Estados de Controle
  const [date, setDate] = useState<Date>(new Date());
  const [isSaving, setIsSaving] = useState(false);
  const isSubmittingRef = React.useRef(false); // Ref para debounce imediato
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // --- CORREÇÃO OFFLINE: ID da Escola Local ---
  // Se o user.escola_id falhar (offline), pegamos dos alunos baixados
  const [localEscolaId, setLocalEscolaId] = useState<string | null>(null);

  // Modais
  const [showObservacao, setShowObservacao] = useState<{ alunoId: string; alunoNome: string } | null>(null);
  const [tituloObservacao, setTituloObservacao] = useState('');
  const [descricaoObservacao, setDescricaoObservacao] = useState('');
  const [salvandoObservacao, setSalvandoObservacao] = useState(false);

  // Cor da Escola
  const corPrimaria = config?.cor_primaria || "#6D28D9";

  // --- 1. MONITORAMENTO DE CONEXÃO ---
  useEffect(() => {
    const handleStatusChange = () => {
      const status = navigator.onLine;
      setIsOnline(status);
      if (status) {
        // Tenta sincronizar silenciosamente ao voltar a internet
        sincronizarChamadasOffline().then(res => {
          if (res.success && res.count > 0) toast({ title: "Sincronizado", description: `${res.count} registros enviados.` });
        });
      }
    };
    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);
    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
    };
  }, []);

  // --- 2. CARREGAMENTO DE DADOS (Estratégia Offline-First Robusta) ---
  const carregarDados = useCallback(async () => {
    if (!turmaId) return;
    setIsLoading(true);

    try {
      let listaAlunos: Aluno[] = [];
      let escolaIdEncontrado: string | null = user?.escola_id || null;

      // A) SE OFFLINE: Vai direto para o cache
      if (!navigator.onLine) {
        console.log("Modo Offline: Buscando alunos no cache...");
        listaAlunos = await getAlunosDaTurmaOffline(turmaId, user?.id);
      }
      // B) SE ONLINE: Tenta Supabase, com fallback para cache
      // RLS já filtra por escola e role automaticamente
      else {
        try {
          const { data, error } = await supabase
            .from("alunos")
            .select("id, nome, matricula, turma_id, escola_id")
            .eq("turma_id", turmaId)
            .order("nome");

          if (error) throw error;
          listaAlunos = data || [];
        } catch (err) {
          console.warn("Erro ao buscar online. Usando cache.", err);
          listaAlunos = await getAlunosDaTurmaOffline(turmaId, user?.id);
        }
      }

      // --- CRUCIAL: Extração do ID da Escola ---
      // Se não veio do Auth (comum offline), tenta pegar do primeiro aluno
      if (!escolaIdEncontrado && listaAlunos.length > 0) {
        // Tenta encontrar algum aluno que tenha escola_id preenchido
        const alunoComEscola = listaAlunos.find(a => a.escola_id);
        if (alunoComEscola) {
          escolaIdEncontrado = alunoComEscola.escola_id!;
          console.log("Escola ID recuperado dos dados do aluno:", escolaIdEncontrado);
        }
      }
      setLocalEscolaId(escolaIdEncontrado);

      // C) Recuperar Rascunho ou Inicializar
      const rascunho = await getSessaoChamada();
      const mapaPresencas: Record<string, Presenca> = {};

      if (rascunho && rascunho.turmaId === turmaId) {
        const [y, m, d] = rascunho.date.split('-').map(Number);
        setDate(new Date(y, m - 1, d));
        Object.entries(rascunho.presencas).forEach(([id, status]) => {
          if (status) mapaPresencas[id] = status as Presenca;
        });
        // Garante consistência
        listaAlunos.forEach(a => { if (!mapaPresencas[a.id]) mapaPresencas[a.id] = "presente"; });
      } else {
        // PADRÃO: Todos presentes
        listaAlunos.forEach(a => mapaPresencas[a.id] = "presente");
      }

      // D) Buscar Atestados (Só Online)
      let mapaAtestados: Record<string, Atestado[]> = {};
      if (navigator.onLine) {
        try {
          const hoje = format(new Date(), 'yyyy-MM-dd');
          const { data: attData } = await supabase
            .from("atestados")
            .select("*")
            .eq("status", "aprovado")
            .lte("data_inicio", hoje)
            .gte("data_fim", hoje);

          if (attData) {
            attData.forEach(att => {
              if (!mapaAtestados[att.aluno_id]) mapaAtestados[att.aluno_id] = [];
              mapaAtestados[att.aluno_id].push(att);
              // Se tem atestado, marca automaticamente
              if (listaAlunos.some(al => al.id === att.aluno_id)) {
                mapaPresencas[att.aluno_id] = "atestado";
              }
            });
          }
        } catch (err) { console.error("Erro atestados", err); }
      }

      setAlunos(listaAlunos);
      setPresencas(mapaPresencas);
      setAtestados(mapaAtestados);

    } catch (err) {
      console.error(err);
      toast({ variant: "destructive", title: "Erro ao carregar dados" });
    } finally {
      setIsLoading(false);
    }
  }, [turmaId, user]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  // Auto-save Rascunho
  useEffect(() => {
    if (turmaId && Object.keys(presencas).length > 0) {
      const timer = setTimeout(() => {
        salvarSessaoChamada({ turmaId, date: format(date, "yyyy-MM-dd"), presencas });
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [presencas, date, turmaId]);

  // --- AÇÕES ---
  const toggleStatus = (alunoId: string) => {
    setPresencas(prev => {
      const atual = prev[alunoId];
      if (atual === "atestado") return prev;
      return { ...prev, [alunoId]: atual === "presente" ? "falta" : "presente" };
    });
  };

  const setStatusManual = (alunoId: string, status: Presenca, e: React.MouseEvent) => {
    e.stopPropagation();
    setPresencas(prev => ({ ...prev, [alunoId]: status }));
  };

  // --- SALVAR CHAMADA ROBUSTO COM FALLBACK ---
  const handleSalvar = async () => {
    // 1. Debounce / Evitar Duplo Clique
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSaving(true);

    try {
      // 2. Tenta obter o ID da escola de qualquer lugar possível
      const idEscolaFinal = localEscolaId || user?.escola_id;

      if (!idEscolaFinal) {
        toast({
          title: "Erro de Identificação",
          description: "Não foi possível identificar a escola nos dados offline. Conecte-se para sincronizar.",
          variant: "destructive"
        });
        return;
      }

      // Prepara o payload
      const dataFormatada = format(date, "yyyy-MM-dd");
      const payload = Object.entries(presencas).map(([alunoId, status]) => ({
        aluno_id: alunoId,
        turma_id: turmaId!,
        escola_id: idEscolaFinal, // ID GARANTIDO
        data_chamada: dataFormatada,
        presente: status === "presente",
        falta_justificada: status === "atestado"
      }));

      // Função auxiliar para salvar offline
      const salvarLocalmente = async () => {
        console.log("Salvando offline...", payload.length, "registros. Escola:", idEscolaFinal);
        const sucesso = await salvarChamadaOffline(payload);

        if (sucesso) {
          toast({
            title: "Salvo no Dispositivo",
            description: "Conexão instável. Dados salvos localmente e serão enviados depois.",
            className: "bg-yellow-100 text-yellow-800 border-yellow-300"
          });
          setPresencas({}); // Limpa estado para evitar re-salvamento do rascunho
          await limparSessaoChamada();
          navigate("/dashboard");
        } else {
          throw new Error("Falha ao gravar no banco local.");
        }
      };

      // 3. SE OFFLINE: Salva no IndexedDB direto
      if (!navigator.onLine) {
        try {
          await salvarLocalmente();
        } catch (err: any) {
          toast({ title: "Erro ao salvar offline", description: err.message, variant: "destructive" });
        }
        return;
      }

      // 4. SE ONLINE: Tenta Supabase com Fallback
      try {
        // Limpa registros anteriores para evitar duplicidade
        const { error: deleteError } = await supabase
          .from("presencas")
          .delete()
          .eq("turma_id", turmaId)
          .eq("data_chamada", dataFormatada);

        if (deleteError) throw deleteError;

        if (payload.length > 0) {
          const { error: insertError } = await supabase.from("presencas").insert(payload);
          if (insertError) throw insertError;
        }

        toast({ title: "Chamada salva!", className: "bg-green-600 text-white" });
        setPresencas({}); // CRUCIAL: Limpa o estado visual antes de limpar o storage
        await limparSessaoChamada();
        navigate("/dashboard");

      } catch (error: any) {
        console.error("Erro no salvamento:", error);

        // DETECÇÃO DE ERRO DE REDE PARA FALLBACK
        const isNetworkError =
          error.message?.includes("Failed to fetch") ||
          error.message?.includes("network") ||
          error.status === 503 ||
          error.status === 504;

        if (isNetworkError) {
          console.warn("Erro de rede detectado durante salvamento online. Ativando fallback offline.");
          try {
            await salvarLocalmente();
          } catch (offlineErr: any) {
            toast({ title: "Erro Crítico", description: "Falha ao salvar online e offline: " + offlineErr.message, variant: "destructive" });
          }
        } else {
          // Erro de validação ou outro erro do Supabase
          toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
        }
      }
    } finally {
      setIsSaving(false);
      isSubmittingRef.current = false;
    }
  };

  const handleSalvarObservacao = async () => {
    if (!showObservacao || !localEscolaId) return;
    setSalvandoObservacao(true);
    try {
      if (!isOnline) {
        toast({ title: "Atenção", description: "Observações requerem internet no momento.", variant: "destructive" });
        return;
      }

      const observacaoData = {
        aluno_id: showObservacao.alunoId,
        data_observacao: format(date, "yyyy-MM-dd"),
        titulo: tituloObservacao.trim(),
        descricao: descricaoObservacao.trim(),
        turma_id: turmaId,
        user_id: user?.id, // Pode ser undefined se offline, mas aqui estamos no bloco online
        escola_id: localEscolaId,
      };

      if (!observacaoData.user_id) throw new Error("Usuário não autenticado");

      const { error } = await supabase
        .from("observacoes_alunos")
        .upsert(observacaoData as any, { onConflict: 'aluno_id, data_observacao' });

      if (error) throw error;

      toast({ title: "Observação salva!" });
      setShowObservacao(null);
      setTituloObservacao("");
      setDescricaoObservacao("");
    } catch (err) {
      toast({ title: "Erro", variant: "destructive" });
    } finally {
      setSalvandoObservacao(false);
    }
  };

  // Contadores
  const totalPresentes = Object.values(presencas).filter(s => s === "presente").length;
  const totalFaltas = Object.values(presencas).filter(s => s === "falta").length;

  if (isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* HEADER */}
      <div className="bg-white border-b sticky top-0 z-10 px-4 py-3 shadow-sm">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5 text-slate-600" />
            </Button>
            <div>
              <h1 className="text-lg font-bold text-slate-800 leading-none">Chamada</h1>
              <span className="text-xs text-slate-500">{format(date, "dd/MM/yyyy")}</span>
            </div>
          </div>
          {!isOnline ? <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300 gap-1"><WifiOff size={12} /> Offline</Badge> : <div className="hidden sm:flex items-center text-xs text-green-600 font-medium"><Wifi size={14} className="mr-1" /> Online</div>}
        </div>
      </div>

      {/* LISTA DE ALUNOS */}
      <div className="max-w-3xl mx-auto p-4 space-y-3">
        {alunos.length === 0 ? (
          <div className="text-center py-10 text-gray-400 border-2 border-dashed rounded-lg"><p>Nenhum aluno encontrado.</p></div>
        ) : (
          alunos.map((aluno) => {
            const status = presencas[aluno.id];
            const isPresente = status === "presente";
            const isFalta = status === "falta";
            const isAtestado = status === "atestado";
            return (
              <div key={aluno.id} onClick={() => toggleStatus(aluno.id)} className={`flex items-center justify-between p-3 rounded-lg border-l-[6px] shadow-sm cursor-pointer transition-all bg-white active:scale-[0.99] ${isPresente ? 'border-l-emerald-500' : isFalta ? 'border-l-red-500 bg-red-50/20' : 'border-l-blue-400'}`}>
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm border transition-colors ${isPresente ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : isFalta ? 'bg-red-100 text-red-700 border-red-200' : 'bg-blue-100 text-blue-700 border-blue-200'}`}>{aluno.nome.substring(0, 2).toUpperCase()}</div>
                  <div>
                    <p className={`font-semibold text-sm ${isFalta ? 'text-red-700' : 'text-slate-800'}`}>{aluno.nome}</p>
                    <p className="text-xs text-slate-400 font-mono">{aluno.matricula}</p>
                  </div>
                </div>
                <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-300 hover:text-purple-600" onClick={() => setShowObservacao({ alunoId: aluno.id, alunoNome: aluno.nome })}><MessageSquare size={18} /></Button>
                  <Button variant={isAtestado ? "default" : "ghost"} size="icon" className={`h-9 w-9 ${isAtestado ? 'bg-blue-500 text-white hover:bg-blue-600' : 'text-slate-300 hover:text-blue-500'}`} onClick={(e) => setStatusManual(aluno.id, isAtestado ? "presente" : "atestado", e)}><FileText size={18} /></Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* FOOTER FLUTUANTE */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-[0_-4px_15px_rgba(0,0,0,0.08)] z-50 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <div className="flex gap-6 text-xs font-medium text-slate-500">
            <div className="flex flex-col items-center"><span className="text-emerald-600 text-xl font-black leading-none">{totalPresentes}</span><span>Presentes</span></div>
            <div className="flex flex-col items-center"><span className="text-red-600 text-xl font-black leading-none">{totalFaltas}</span><span>Faltas</span></div>
          </div>
          <Button onClick={handleSalvar} disabled={isSaving || alunos.length === 0} className="flex-1 h-12 text-base font-bold text-white shadow-lg active:scale-95 transition-all rounded-xl" style={{ backgroundColor: corPrimaria }}>
            {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2 h-5 w-5" />} CONFIRMAR CHAMADA
          </Button>
        </div>
      </div>

      <Dialog open={!!showObservacao} onOpenChange={() => setShowObservacao(null)}>
        <DialogContent className="max-w-sm rounded-xl">
          <DialogHeader><DialogTitle>Observação</DialogTitle></DialogHeader>
          <div className="space-y-3"><Input placeholder="Título" value={tituloObservacao} onChange={e => setTituloObservacao(e.target.value)} /><Textarea placeholder="Detalhes..." value={descricaoObservacao} onChange={e => setDescricaoObservacao(e.target.value)} /><Button onClick={handleSalvarObservacao}>Salvar</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChamadaPage;