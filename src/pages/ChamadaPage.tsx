import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
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
  getSession,
  upsertSession,
  deleteSession,
  getCachedAlunosByTurma
} from '@/lib/offlineStorage';
import { getAlunosByTurma } from '@/lib/dataProvider';
import { triggerSync } from '@/lib/SyncManager';
import { useAuth } from '@/contexts/AuthContext';
import { useEscolaConfig } from "@/contexts/EscolaConfigContext";
import {
  alunoService,
  atestadosService,
  presencaService,
  observacoesService,
  type Aluno,
  type Atestado
} from "@/domains";
import VirtualizedAlunosList from "@/components/chamada/VirtualizedAlunosList";

// Estado visual único. Não permite ambiguidade.
type PresencaStatus = "presente" | "falta" | "atestado";

const ChamadaPage: React.FC = () => {
  const { turmaId } = useParams<{ turmaId: string }>();
  const { user } = useAuth();
  const { config } = useEscolaConfig();
  const navigate = useNavigate();

  // Estados de Dados
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [presencas, setPresencas] = useState<Record<string, PresencaStatus>>({});
  const [atestados, setAtestados] = useState<Record<string, Atestado[]>>({});

  // Estados de Controle
  const [date, setDate] = useState<Date>(new Date());
  const [isSaving, setIsSaving] = useState(false);
  const isSubmittingRef = React.useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // ID da Escola Local (para offline)
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
    const handleStatusChange = async () => {
      const status = navigator.onLine;
      setIsOnline(status);
      if (status) {
        // Use new SyncManager instead of legacy sync
        const results = await triggerSync();
        const successCount = results.filter(r => r.success).length;
        if (successCount > 0) {
          toast({ title: "Sincronizado", description: `${successCount} registros enviados.` });
        }
      }
    };
    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);
    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
    };
  }, []);

  // --- 2. CARREGAMENTO DE DADOS ---
  const carregarDados = useCallback(async () => {
    if (!turmaId) return;
    setIsLoading(true);

    try {
      let listaAlunos: Aluno[] = [];
      let escolaIdEncontrado: string | null = user?.escola_id || null;

      // A) SE OFFLINE: Vai direto para o cache
      if (!navigator.onLine) {
        console.log("[ChamadaPage] OFFLINE - reading from IndexedDB cache");
        const cached = await getCachedAlunosByTurma(user?.escola_id || '', turmaId);
        listaAlunos = cached as Aluno[];
      }
      // B) SE ONLINE: Usa dataProvider (offline-first)
      else {
        try {
          const result = await getAlunosByTurma(turmaId, user?.escola_id);
          listaAlunos = result.data as Aluno[];
          console.log(`[ChamadaPage] Loaded ${listaAlunos.length} alunos from ${result.source}`);
        } catch (err) {
          console.warn("[ChamadaPage] Error fetching, using cache", err);
          const cached = await getCachedAlunosByTurma(user?.escola_id || '', turmaId);
          listaAlunos = cached as Aluno[];
        }
      }

      // Extração do ID da Escola dos dados do aluno
      if (!escolaIdEncontrado && listaAlunos.length > 0) {
        const alunoComEscola = listaAlunos.find(a => a.escola_id);
        if (alunoComEscola) {
          escolaIdEncontrado = alunoComEscola.escola_id!;
        }
      }
      setLocalEscolaId(escolaIdEncontrado);

      // Recuperar Rascunho ou Inicializar
      const dateStr = format(date, "yyyy-MM-dd");
      const rascunho = await getSession(turmaId, dateStr);
      const mapaPresencas: Record<string, PresencaStatus> = {};

      if (rascunho && rascunho.turma_id === turmaId) {
        // Session exists, restore presences
        Object.entries(rascunho.presencas).forEach(([id, status]) => {
          if (status) mapaPresencas[id] = status as PresencaStatus;
        });
        listaAlunos.forEach(a => { if (!mapaPresencas[a.id]) mapaPresencas[a.id] = "presente"; });
      } else {
        listaAlunos.forEach(a => mapaPresencas[a.id] = "presente");
      }

      // Buscar Atestados (Só Online) usando service
      let mapaAtestados: Record<string, Atestado[]> = {};
      if (navigator.onLine) {
        try {
          const atestadosVigentes = await atestadosService.getAtestadosVigentes();
          mapaAtestados = atestadosService.groupByAluno(atestadosVigentes);

          // Marca alunos com atestado automaticamente
          Object.keys(mapaAtestados).forEach(alunoId => {
            if (listaAlunos.some(al => al.id === alunoId)) {
              mapaPresencas[alunoId] = "atestado";
            }
          });
        } catch (err) {
          console.error("Erro atestados", err);
        }
      }

      // Sort alphabetically by name
      listaAlunos.sort((a, b) => a.nome.localeCompare(b.nome));

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
        const dateStr = format(date, "yyyy-MM-dd");
        upsertSession(turmaId, dateStr, presencas);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [presencas, date, turmaId]);

  // --- AÇÕES (MEMOIZED - Phase 3) ---
  const toggleStatus = useCallback((alunoId: string) => {
    setPresencas(prev => {
      const atual = prev[alunoId];
      if (atual === "atestado") return prev;
      return { ...prev, [alunoId]: atual === "presente" ? "falta" : "presente" };
    });
  }, []);

  const setStatusManual = useCallback((alunoId: string, status: PresencaStatus, e: React.MouseEvent) => {
    e.stopPropagation();
    setPresencas(prev => ({ ...prev, [alunoId]: status }));
  }, []);

  // --- SALVAR CHAMADA usando presencaService ---
  const handleSalvar = async () => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSaving(true);

    try {
      const idEscolaFinal = localEscolaId || user?.escola_id;

      if (!idEscolaFinal) {
        toast({
          title: "Erro de Identificação",
          description: "Não foi possível identificar a escola nos dados offline. Conecte-se para sincronizar.",
          variant: "destructive"
        });
        return;
      }

      const dataFormatada = format(date, "yyyy-MM-dd");
      const registros = Object.entries(presencas).map(([alunoId, status]) => ({
        alunoId,
        presente: status === "presente",
        faltaJustificada: status === "atestado"
      }));

      // Usa o presencaService para salvar (já tem lógica online/offline)
      const result = await presencaService.salvarChamada({
        turmaId: turmaId!,
        escolaId: idEscolaFinal,
        dataChamada: dataFormatada,
        registros
      });

      if (result.syncTriggered) {
        toast({ title: "Chamada salva!", className: "bg-green-600 text-white" });
      } else {
        toast({
          title: "Salvo no Dispositivo",
          description: "Dados salvos localmente e serão enviados depois.",
          className: "bg-yellow-100 text-yellow-800 border-yellow-300"
        });
        window.dispatchEvent(new Event('chamada-salva'));
      }

      setPresencas({});
      navigate("/dashboard");

    } catch (error: any) {
      console.error("Erro no salvamento:", error);
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
      isSubmittingRef.current = false;
    }
  };

  const handleSalvarObservacao = async () => {
    if (!showObservacao || !localEscolaId || !user?.id || !turmaId) return;
    setSalvandoObservacao(true);

    try {
      await observacoesService.salvar({
        aluno_id: showObservacao.alunoId,
        turma_id: turmaId,
        escola_id: localEscolaId,
        user_id: user.id,
        data_observacao: format(date, "yyyy-MM-dd"),
        titulo: tituloObservacao.trim(),
        descricao: descricaoObservacao.trim(),
      });

      toast({ title: "Observação salva!" });
      setShowObservacao(null);
      setTituloObservacao("");
      setDescricaoObservacao("");
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
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
      <div className="max-w-3xl mx-auto p-4">
        <VirtualizedAlunosList
          alunos={alunos}
          presencas={presencas}
          onToggleStatus={toggleStatus}
          onSetStatus={setStatusManual}
          onObservacao={(alunoId, alunoNome) => setShowObservacao({ alunoId, alunoNome })}
        />
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