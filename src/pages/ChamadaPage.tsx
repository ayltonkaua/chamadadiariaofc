import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { createClient } from '@supabase/supabase-js';
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { Check, X, FileText, Save, ArrowLeft, Loader2, Wifi, WifiOff, Shield, MessageSquare, Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import JustificarFaltaForm from "@/components/justificativa/JustificarFaltaForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  salvarChamadaOffline, 
  getSessaoChamada, 
  salvarSessaoChamada, 
  limparSessaoChamada,
  sincronizarChamadasOffline
} from '@/lib/offlineChamada';

// Cliente Supabase genérico para contornar problemas de tipo
const supabaseGeneric = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

interface Aluno {
  id: string;
  nome: string;
  matricula: string;
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
  
  // Estados para observação
  const [tituloObservacao, setTituloObservacao] = useState('');
  const [descricaoObservacao, setDescricaoObservacao] = useState('');
  const [salvandoObservacao, setSalvandoObservacao] = useState(false);

  // Monitorar status da conexão
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Tentar sincronizar quando voltar a conexão
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

  // Carregar dados iniciais e sessão salva
  useEffect(() => {
    const carregarDados = async () => {
      if (!turmaId) return;
      
      setIsLoading(true);
      
      try {
        // Carregar alunos
        const { data: alunosData, error: alunosError } = await supabase
          .from("alunos")
          .select("id, nome, matricula")
          .eq("turma_id", turmaId);
        
        if (alunosError) throw alunosError;
        if (alunosData) setAlunos(alunosData);

        // Carregar atestados aprovados para a data selecionada
        const dataFormatada = format(date, "yyyy-MM-dd");
        const { data: atestadosData, error: atestadosError } = await supabase
          .from("atestados")
          .select("id, aluno_id, data_inicio, data_fim, status")
          .eq("status", "aprovado")
          .lte("data_inicio", dataFormatada)
          .gte("data_fim", dataFormatada);

        if (atestadosError) throw atestadosError;
        
        // Organizar atestados por aluno
        const atestadosPorAluno: Record<string, Atestado[]> = {};
        if (atestadosData) {
          atestadosData.forEach(atestado => {
            if (!atestadosPorAluno[atestado.aluno_id]) {
              atestadosPorAluno[atestado.aluno_id] = [];
            }
            atestadosPorAluno[atestado.aluno_id].push(atestado);
          });
        }
        setAtestados(atestadosPorAluno);

        // Tentar carregar sessão salva
        const sessaoSalva = await getSessaoChamada();
        if (sessaoSalva && sessaoSalva.turmaId === turmaId) {
          setDate(new Date(sessaoSalva.date));
          setPresencas(sessaoSalva.presencas);
          toast({
            title: "Sessão restaurada",
            description: "Seus dados foram restaurados da sessão anterior.",
          });
        }
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
        toast({
          title: "Erro ao carregar dados",
          description: "Não foi possível carregar os dados dos alunos.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    carregarDados();
  }, [turmaId, date]);

  // Salvar sessão sempre que houver mudanças
  useEffect(() => {
    if (turmaId && Object.keys(presencas).length > 0) {
      const salvarSessao = async () => {
        await salvarSessaoChamada({
          turmaId,
          date: format(date, "yyyy-MM-dd"),
          presencas,
        });
      };
      
      // Debounce para não salvar a cada mudança
      const timeoutId = setTimeout(salvarSessao, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [turmaId, date, presencas]);

  const handlePresenca = (alunoId: string, tipo: Presenca) => {
    setPresencas((prev) => ({ ...prev, [alunoId]: tipo }));
  };

  const handleSalvar = async () => {
    setTentouSalvar(true);
    // Validação: todos os alunos devem ter status definido
    const alunosSemRegistro = alunos.filter(aluno => !presencas[aluno.id]);
    if (alunosSemRegistro.length > 0) {
      toast({
        title: "Erro",
        description: "Todos os alunos devem ter presença, falta ou atestado registrados.",
        variant: "destructive",
      });
      return;
    }
    
    setIsSaving(true);
    try {
      const dataChamada = format(date, "yyyy-MM-dd");
      const presencasParaInserir = Object.entries(presencas)
        .map(([alunoId, status]) => {
          let presente = false;
          let falta_justificada = false;
          if (status === "presente") presente = true;
          else if (status === "falta") presente = false;
          else if (status === "atestado") {
            presente = false;
            falta_justificada = true;
          }
          return {
            aluno_id: alunoId,
            turma_id: turmaId,
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
        return;
      }

      if (presencasParaInserir.length > 0) {
        const { error } = await supabase.from("presencas").insert(presencasParaInserir);
        if (error) throw error;
      }
      
      toast({
        title: "Chamada salva",
        description: "A chamada foi registrada com sucesso.",
      });
      setPresencas({});
      setTentouSalvar(false);
      await limparSessaoChamada();
    } catch (error) {
      console.error("Erro ao salvar chamada:", error);
      toast({
        title: "Erro ao salvar",
        description: "Ocorreu um erro ao salvar a chamada.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Função para verificar se aluno tem atestado aprovado para a data
  const temAtestadoAprovado = (alunoId: string): boolean => {
    const atestadosAluno = atestados[alunoId] || [];
    return atestadosAluno.length > 0;
  };

  // Função para salvar observação
  const handleSalvarObservacao = async () => {
    if (!showObservacao || !tituloObservacao.trim() || !descricaoObservacao.trim()) {
      toast({
        title: "Erro",
        description: "Título e descrição são obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    setSalvandoObservacao(true);
    try {
      const { error } = await (supabaseGeneric as any)
        .from("observacoes_alunos")
        .insert({
          aluno_id: showObservacao.alunoId,
          turma_id: turmaId,
          titulo: tituloObservacao.trim(),
          descricao: descricaoObservacao.trim(),
          data_observacao: format(date, "yyyy-MM-dd"),
          user_id: (await supabase.auth.getUser()).data.user?.id,
        });

      if (error) throw error;

      toast({
        title: "Observação salva",
        description: "A observação foi registrada com sucesso.",
      });

      // Limpar formulário e fechar modal
      setTituloObservacao('');
      setDescricaoObservacao('');
      setShowObservacao(null);
    } catch (error) {
      console.error("Erro ao salvar observação:", error);
      toast({
        title: "Erro ao salvar observação",
        description: "Ocorreu um erro ao salvar a observação.",
        variant: "destructive",
      });
    } finally {
      setSalvandoObservacao(false);
    }
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
    <div className="min-h-screen bg-gray-50 py-6 px-4 max-w-3xl mx-auto">
      {/* Status da conexão */}
      {!isOnline && (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-3 rounded mb-4 flex items-center">
          <WifiOff className="h-4 w-4 mr-2" />
          <span className="text-sm font-medium">Modo offline - As chamadas serão salvas localmente</span>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-md p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-purple-700">Chamada</h2>
          <div className="flex items-center gap-2">
            {isOnline ? (
              <div className="flex items-center text-green-600 text-sm">
                <Wifi className="h-4 w-4 mr-1" />
                Online
              </div>
            ) : (
              <div className="flex items-center text-yellow-600 text-sm">
                <WifiOff className="h-4 w-4 mr-1" />
                Offline
              </div>
            )}
            <Link to="/dashboard">
              <Button variant="outline" className="flex gap-2">
                <ArrowLeft size={18} /> Voltar ao Dashboard
              </Button>
            </Link>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
          <div>
            <span className="font-medium">Data selecionada:</span>{" "}
            <span className="text-gray-800">
              {format(date, "dd/MM/yyyy")}
            </span>
          </div>
          <div>
            <Calendar 
              mode="single"
              selected={date}
              onSelect={(date) => date && setDate(date)}
              className="p-3 pointer-events-auto"
            />
          </div>
        </div>
        <div className="mb-2 mt-4">
          <h3 className="font-semibold text-gray-700">Alunos</h3>
        </div>
        <div className="flex flex-col gap-2">
          {[...alunos].sort((a, b) => a.nome.localeCompare(b.nome)).map((aluno) => {
            const semRegistro = tentouSalvar && !presencas[aluno.id];
            const temAtestado = temAtestadoAprovado(aluno.id);
            return (
              <div
                key={aluno.id}
                className={`flex items-center justify-between border rounded-md p-2 gap-2 bg-gray-50 ${semRegistro ? "border-2 border-red-500 bg-red-50" : ""}`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{aluno.nome}</span>
                  <span className="text-sm text-gray-500">(Matrícula: {aluno.matricula})</span>
                  {temAtestado && (
                    <div className="flex items-center gap-1 text-blue-600" title="Aluno com atestado aprovado para esta data">
                      <Shield className="h-4 w-4" />
                      <span className="text-xs font-medium">Atestado</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={presencas[aluno.id] === "presente" ? "default" : "outline"}
                    className={presencas[aluno.id] === "presente" ? "bg-green-600 text-white" : ""}
                    onClick={() => handlePresenca(aluno.id, "presente")}
                    title="Presente"
                  ><Check size={18}/></Button>
                  <Button
                    variant={presencas[aluno.id] === "falta" ? "default" : "outline"}
                    className={presencas[aluno.id] === "falta" ? "bg-red-600 text-white" : ""}
                    onClick={() => handlePresenca(aluno.id, "falta")}
                    title="Falta"
                  ><X size={18}/></Button>
                  <Button
                    variant={presencas[aluno.id] === "atestado" ? "default" : "outline"}
                    className={presencas[aluno.id] === "atestado" ? "bg-blue-400 text-white" : ""}
                    onClick={() => handlePresenca(aluno.id, "atestado")}
                    title="Atestado"
                  ><FileText size={18}/></Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowObservacao({ alunoId: aluno.id, alunoNome: aluno.nome })}
                    title="Adicionar Observação"
                    className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                  >
                    <MessageSquare size={16}/>
                  </Button>
                </div>
                {semRegistro && (
                  <span className="text-xs text-red-600 font-semibold ml-2">Obrigatório registrar presença</span>
                )}
              </div>
            );
          })}
        </div>
        <Button 
          className="mt-6 w-full bg-purple-600 hover:bg-purple-700 text-white flex gap-2 items-center justify-center" 
          onClick={handleSalvar}
          disabled={isSaving || alunos.some(aluno => !presencas[aluno.id])}
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Salvando...
            </>
          ) : (
            <>
              <Save size={20}/> Salvar Chamada
            </>
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

      {/* Modal de Observação */}
      <Dialog open={!!showObservacao} onOpenChange={() => setShowObservacao(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-purple-600" />
              Adicionar Observação
            </DialogTitle>
          </DialogHeader>
          
          {showObservacao && (
            <div className="space-y-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Aluno:</span> {showObservacao.alunoNome}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Data:</span> {format(date, "dd/MM/yyyy")}
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="titulo">Título da Observação *</Label>
                <Input
                  id="titulo"
                  value={tituloObservacao}
                  onChange={(e) => setTituloObservacao(e.target.value)}
                  placeholder="Ex: Comportamento, Participação, etc."
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição *</Label>
                <Textarea
                  id="descricao"
                  value={descricaoObservacao}
                  onChange={(e) => setDescricaoObservacao(e.target.value)}
                  placeholder="Descreva a observação..."
                  rows={4}
                />
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowObservacao(null);
                    setTituloObservacao('');
                    setDescricaoObservacao('');
                  }}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSalvarObservacao}
                  disabled={salvandoObservacao || !tituloObservacao.trim() || !descricaoObservacao.trim()}
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                >
                  {salvandoObservacao ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Salvar Observação
                    </>
                  )}
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
