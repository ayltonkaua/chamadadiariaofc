import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { Check, X, FileText, Save, ArrowLeft, Loader2, Wifi, WifiOff, MessageSquare, Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import JustificarFaltaForm from "@/components/justificativa/JustificarFaltaForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  getSessaoChamada, 
  salvarSessaoChamada, 
  limparSessaoChamada,
  sincronizarChamadasOffline
} from '@/lib/offlineChamada';
import { useAuth } from '@/contexts/AuthContext';

interface Aluno {
  id: string;
  nome: string;
  matricula: string;
  turma_id: string;
}

interface Atestado {
  id: string;
  aluno_id: string;
  data_inicio: string;
  data_fim: string;
  status: string;
}

type Presenca = "presente" | "falta" | "atestado" | null;

const ChamadaPage: React.FC = () => {
  const { turmaId } = useParams<{ turmaId: string }>();
  const { user } = useAuth();
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [presencas, setPresencas] = useState<Record<string, Presenca | null>>({});
  const [atestados, setAtestados] = useState<Record<string, Atestado[]>>({});
  const [date, setDate] = useState<Date>(new Date());
  const [isSaving, setIsSaving] = useState(false);
  const [showJustificarFalta, setShowJustificarFalta] = useState<{ alunoId: string } | null>(null);
  const [showObservacao, setShowObservacao] = useState<{ alunoId: string; alunoNome: string } | null>(null);
  const [tentouSalvar, setTentouSalvar] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isLoading, setIsLoading] = useState(true);
  
  const [tituloObservacao, setTituloObservacao] = useState('');
  const [descricaoObservacao, setDescricaoObservacao] = useState('');
  const [salvandoObservacao, setSalvandoObservacao] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      sincronizarChamadasOffline().then(result => {
        if (result.success && result.count > 0) {
          toast({
            title: "Conexão restaurada",
            description: `${result.count} chamadas foram sincronizadas automaticamente.`,
          });
        }
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast({
        title: "Sem conexão",
        description: "Você está offline. As chamadas serão salvas localmente.",
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    let cancelado = false;
    const carregarDados = async () => {
      if (!turmaId) return;
      setIsLoading(true);
      try {
        const { data: alunosData, error: alunosError } = await supabase
          .from("alunos")
          .select("id, nome, matricula, turma_id")
          .eq("turma_id", turmaId);
        if (alunosError) throw alunosError;

        const sessaoSalva = await getSessaoChamada();
        let presencasRestauradas = {};
        let dataRestaurada = new Date();

        if (sessaoSalva && sessaoSalva.turmaId === turmaId) {
          const [year, month, day] = sessaoSalva.date.split('-').map(Number);
          dataRestaurada = new Date(year, month - 1, day);
          presencasRestauradas = sessaoSalva.presencas;
        }

        if (!cancelado) {
          if (alunosData) setAlunos(alunosData);
          setDate(dataRestaurada);
          setPresencas(presencasRestauradas);
          if (Object.keys(presencasRestauradas).length > 0) {
            toast({
              title: "Sessão restaurada",
              description: "Sua chamada não finalizada foi recuperada.",
            });
          }
        }
        const dataFormatada = format(dataRestaurada, "yyyy-MM-dd");
        const { data: atestadosData, error: atestadosError } = await supabase
          .from("atestados")
          .select("id, aluno_id, data_inicio, data_fim, status")
          .eq("status", "aprovado")
          .lte("data_inicio", dataFormatada)
          .gte("data_fim", dataFormatada);
        if (atestadosError) throw atestadosError;
        
        const atestadosPorAluno: Record<string, Atestado[]> = {};
        if (atestadosData) {
          atestadosData.forEach(atestado => {
            if (!atestadosPorAluno[atestado.aluno_id]) {
              atestadosPorAluno[atestado.aluno_id] = [];
            }
            atestadosPorAluno[atestado.aluno_id].push(atestado);
          });
        }
        if (!cancelado) setAtestados(atestadosPorAluno);
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
        toast({
          title: "Erro ao carregar dados",
          description: "Não foi possível carregar os dados dos alunos.",
          variant: "destructive",
        });
      } finally {
        if (!cancelado) setIsLoading(false);
      }
    };
    carregarDados();
    return () => { cancelado = true; };
  }, [turmaId]);

  useEffect(() => {
    if (turmaId && Object.keys(presencas).length > 0) {
      const salvarSessao = async () => {
        await salvarSessaoChamada({
          turmaId,
          date: format(date, "yyyy-MM-dd"),
          presencas,
        });
      };
      
      const timeoutId = setTimeout(salvarSessao, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [turmaId, date, presencas]);

  const handlePresenca = (alunoId: string, tipo: Presenca) => {
    setPresencas((prev) => ({ ...prev, [alunoId]: tipo }));
  };

  const handleSalvar = async () => {
    setTentouSalvar(true);
    const alunosSemRegistro = alunos.filter(aluno => !presencas[aluno.id]);
    if (alunosSemRegistro.length > 0) {
      toast({
        title: "Chamada incompleta",
        description: "Todos os alunos devem ter um status (presente, falta ou atestado) registrado.",
        variant: "destructive",
      });
      return;
    }
    
    if (!user?.escola_id) {
      toast({
        title: "Erro de Configuração",
        description: "Seu usuário não está vinculado a uma escola. Contate o suporte.",
        variant: "destructive",
      });
      return;
    }
    
    setIsSaving(true);
    try {
      const dataChamada = format(date, "yyyy-MM-dd");
      const presencasParaInserir = Object.entries(presencas)
        .filter(([, status]) => status !== null)
        .map(([alunoId, status]) => {
          let presente = false;
          let falta_justificada = false;
          if (status === "presente") presente = true;
          if (status === "atestado") falta_justificada = true;
          
          return {
            aluno_id: alunoId,
            turma_id: turmaId,
            escola_id: user.escola_id,
            presente,
            falta_justificada,
            data_chamada: dataChamada,
          };
        });

      if (!isOnline) {
        const sucesso = await salvarChamadaOffline(presencasParaInserir);
        if (sucesso) {
          toast({
            title: "Chamada salva offline",
            description: "A chamada foi salva localmente e será enviada quando a conexão voltar.",
          });
          setPresencas({});
          setTentouSalvar(false);
          await limparSessaoChamada();
        } else {
          throw new Error("Falha ao salvar offline");
        }
        setIsSaving(false);
        return;
      }

      if (presencasParaInserir.length > 0) {
        await supabase.from("presencas").delete().eq("turma_id", turmaId).eq("data_chamada", dataChamada);
        
        const { error } = await supabase.from("presencas").insert(presencasParaInserir);
        if (error) throw error;
      }
      
      toast({
        title: "Chamada salva",
        description: "O registro de presença foi salvo com sucesso.",
      });
      setPresencas({});
      setTentouSalvar(false);
      await limparSessaoChamada();
    } catch (error) {
      console.error("Erro ao salvar chamada:", error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar a chamada. Verifique sua conexão e tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSalvarObservacao = async () => {
    if (!showObservacao || !tituloObservacao.trim() || !descricaoObservacao.trim()) {
      toast({ title: "Erro", description: "Título e descrição são obrigatórios.", variant: "destructive" });
      return;
    }
    setSalvandoObservacao(true);
    try {
      const { error } = await supabase
        .from("observacoes_alunos")
        .insert({
          aluno_id: showObservacao.alunoId,
          turma_id: turmaId,
          titulo: tituloObservacao.trim(),
          descricao: descricaoObservacao.trim(),
          data_observacao: format(date, "yyyy-MM-dd"),
          user_id: user?.id,
        });

      if (error) throw error;
      toast({ title: "Observação salva", description: "A observação foi registrada com sucesso." });
      setTituloObservacao('');
      setDescricaoObservacao('');
      setShowObservacao(null);
    } catch (error) {
      console.error("Erro ao salvar observação:", error);
      toast({ title: "Erro ao salvar observação", description: "Ocorreu um erro.", variant: "destructive" });
    } finally {
      setSalvandoObservacao(false);
    }
  };
  
  const temAtestadoAprovado = (alunoId: string): boolean => {
    const atestadosAluno = atestados[alunoId] || [];
    return atestadosAluno.length > 0;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-purple-600" />
          <p className="text-gray-600">Carregando dados da turma...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-4 px-2 sm:py-6 sm:px-4 max-w-4xl mx-auto">
      {!isOnline && (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 px-3 py-2 sm:px-4 sm:py-3 rounded mb-4 flex items-center text-sm">
          <WifiOff className="h-4 w-4 mr-2 flex-shrink-0" />
          <span className="font-medium">Modo offline - As chamadas serão salvas localmente</span>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <h2 className="text-xl sm:text-2xl font-bold text-purple-700">Chamada</h2>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
            {isOnline ? (
              <div className="flex items-center text-green-600 text-sm"><Wifi className="h-4 w-4 mr-1" />Online</div>
            ) : (
              <div className="flex items-center text-yellow-600 text-sm"><WifiOff className="h-4 w-4 mr-1" />Offline</div>
            )}
            <Link to="/dashboard">
              <Button variant="outline" className="flex gap-2 w-full sm:w-auto">
                <ArrowLeft size={18} /> 
                <span className="hidden sm:inline">Voltar ao Dashboard</span>
                <span className="sm:hidden">Voltar</span>
              </Button>
            </Link>
          </div>
        </div>
        
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
          <div>
            <span className="font-medium text-sm sm:text-base">Data selecionada:</span>{" "}
            <span className="text-gray-800 text-sm sm:text-base">{format(date, "dd/MM/yyyy")}</span>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setPresencas({});
                setTentouSalvar(false);
                setDate(new Date());
              }}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              Limpar Seleção
            </Button>
            <div className="self-center">
              <Calendar 
                mode="single"
                selected={date}
                onSelect={(d) => d && setDate(d)}
                className="p-3 pointer-events-auto border rounded-md"
              />
            </div>
          </div>
        </div>
        
        <div className="mb-2 mt-4">
          <h3 className="font-semibold text-gray-700 text-sm sm:text-base">Alunos</h3>
        </div>
        
        <div className="flex flex-col gap-1">
          {[...alunos].sort((a, b) => a.nome.localeCompare(b.nome)).map((aluno) => {
            const semRegistro = tentouSalvar && !presencas[aluno.id];
            const temAtestado = temAtestadoAprovado(aluno.id);
            return (
              <div
                key={aluno.id}
                className={`flex flex-col sm:flex-row items-center border rounded-lg p-3 gap-3 transition-all ${semRegistro ? "border-2 border-red-500 bg-red-50" : "border-gray-200"}`}
              >
                <div className="flex-1 min-w-0 text-center sm:text-left">
                  <span className="font-medium text-sm">{aluno.nome}</span>
                  <span className="text-xs text-gray-500 ml-2 hidden sm:inline">({aluno.matricula})</span>
                  {temAtestado && (
                    <span className="ml-2 text-xs text-blue-600 font-semibold">(Com Atestado)</span>
                  )}
                </div>
                <div className="flex flex-row gap-2">
                  <Button
                    variant={presencas[aluno.id] === "presente" ? "default" : "outline"}
                    size="sm"
                    className={`h-9 px-3 ${presencas[aluno.id] === "presente" ? "bg-green-600 text-white" : ""}`}
                    onClick={() => handlePresenca(aluno.id, "presente")}
                    title="Presente"
                  >
                    <Check size={16} /> <span className="hidden sm:inline ml-1">Presente</span>
                  </Button>
                  <Button
                    variant={presencas[aluno.id] === "falta" ? "default" : "outline"}
                    size="sm"
                    className={`h-9 px-3 ${presencas[aluno.id] === "falta" ? "bg-red-600 text-white" : ""}`}
                    onClick={() => handlePresenca(aluno.id, "falta")}
                    title="Falta"
                  >
                    <X size={16} /> <span className="hidden sm:inline ml-1">Falta</span>
                  </Button>
                  <Button
                    variant={presencas[aluno.id] === "atestado" ? "default" : "outline"}
                    size="sm"
                    className={`h-9 px-3 ${presencas[aluno.id] === "atestado" ? "bg-blue-400 text-white" : ""}`}
                    onClick={() => handlePresenca(aluno.id, "atestado")}
                    title="Atestado"
                  >
                    <FileText size={16} /> <span className="hidden sm:inline ml-1">Atestado</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowObservacao({ alunoId: aluno.id, alunoNome: aluno.nome })}
                    title="Adicionar Observação"
                    className="h-9 w-9 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                  >
                    <MessageSquare size={16}/>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
        
        <Button 
          className="mt-6 w-full bg-purple-600 hover:bg-purple-700 text-white flex gap-2 items-center justify-center h-12 text-base" 
          onClick={handleSalvar}
          disabled={isSaving || alunos.some(aluno => !presencas[aluno.id])}
        >
          {isSaving ? (
            <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Salvando...</>
          ) : (
            <><Save size={20}/> Salvar Chamada</>
          )}
        </Button>
      </div>
      
      <Dialog open={!!showJustificarFalta} onOpenChange={() => setShowJustificarFalta(null)}>
        <DialogContent>
          {showJustificarFalta && (
            <JustificarFaltaForm 
              alunoId={showJustificarFalta.alunoId} 
              onClose={() => setShowJustificarFalta(null)} 
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!showObservacao} onOpenChange={() => setShowObservacao(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Adicionar Observação</DialogTitle></DialogHeader>
          {showObservacao && (
            <div className="space-y-4 pt-4">
              <p className="text-sm text-gray-600">Aluno: <span className="font-medium">{showObservacao.alunoNome}</span></p>
              <div className="space-y-2">
                <Label htmlFor="titulo">Título</Label>
                <Input id="titulo" value={tituloObservacao} onChange={(e) => setTituloObservacao(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea id="descricao" value={descricaoObservacao} onChange={(e) => setDescricaoObservacao(e.target.value)} />
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowObservacao(null)} className="flex-1">Cancelar</Button>
                <Button onClick={handleSalvarObservacao} disabled={salvandoObservacao} className="flex-1">
                  {salvandoObservacao && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChamadaPage;