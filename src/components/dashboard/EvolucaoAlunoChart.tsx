import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend 
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { AlertCircle, Users, User } from "lucide-react";

interface AlunoPresencaMensal {
  mes: string;
  presenca: number;
}

interface Turma {
  id: string;
  nome: string;
}

interface Aluno {
  id: string;
  nome: string;
  matricula: string;
  turma_id: string;
}

const EvolucaoAlunoChart = () => {
  const { user } = useAuth();
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [turmaSelecionada, setTurmaSelecionada] = useState<string>("");
  const [alunoId, setAlunoId] = useState<string>("");
  const [presencaData, setPresencaData] = useState<AlunoPresencaMensal[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingTurmas, setLoadingTurmas] = useState(true);
  const [loadingAlunos, setLoadingAlunos] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Carregar turmas do usuário
  useEffect(() => {
    const fetchTurmas = async () => {
      if (!user) {
        setError("Usuário não autenticado");
        setLoadingTurmas(false);
        return;
      }
      
      setLoadingTurmas(true);
      setError(null);
      
      try {
        const { data: turmasData, error: turmasError } = await supabase
          .from("turmas")
          .select("id, nome")
          .eq("user_id", user.id)
          .order("nome");
        
        if (turmasError) {
          throw new Error("Erro ao buscar turmas");
        }
        
        setTurmas(turmasData || []);
      } catch (error) {
        setError(error instanceof Error ? error.message : "Erro ao carregar turmas");
      } finally {
        setLoadingTurmas(false);
      }
    };
    
    fetchTurmas();
  }, [user]);

  // Carregar alunos quando uma turma for selecionada
  useEffect(() => {
    const fetchAlunos = async () => {
      if (!turmaSelecionada) {
        setAlunos([]);
        setAlunoId("");
        return;
      }
      
      setLoadingAlunos(true);
      setError(null);
      
      try {
        const { data: alunosData, error: alunosError } = await supabase
          .from("alunos")
          .select("id, nome, matricula, turma_id")
          .eq("turma_id", turmaSelecionada)
          .order("nome");
          
        if (alunosError) {
          throw new Error("Erro ao buscar alunos");
        }
        
        setAlunos(alunosData || []);
        setAlunoId(""); // Reset aluno selecionado quando mudar turma
      } catch (error) {
        setError(error instanceof Error ? error.message : "Erro ao carregar alunos");
      } finally {
        setLoadingAlunos(false);
      }
    };
    
    fetchAlunos();
  }, [turmaSelecionada]);

  // Carregar dados de presença quando um aluno for selecionado
  useEffect(() => {
    const fetchPresencaAluno = async () => {
      if (!alunoId) {
        setPresencaData([]);
        return;
      }
      
      setLoading(true);
      setError(null);
      
      try {
        // Buscar presença do aluno
        const { data: presencas, error: presencasError } = await supabase
          .from("presencas")
          .select("data_chamada, presente")
          .eq("aluno_id", alunoId)
          .order("data_chamada", { ascending: true });
        
        if (presencasError) {
          throw new Error("Erro ao buscar presenças do aluno");
        }
        
        if (!presencas || presencas.length === 0) {
          setPresencaData([]);
          setLoading(false);
          return;
        }
        
        // Agrupar por mês
        const presencaPorMes = presencas.reduce((acc: {[key: string]: {total: number, presentes: number}}, presenca) => {
          const dataLocal = new Date(presenca.data_chamada + 'T00:00:00');
          const mesAno = format(dataLocal, 'MM/yyyy');
          
          if (!acc[mesAno]) {
            acc[mesAno] = { total: 0, presentes: 0 };
          }
          
          acc[mesAno].total += 1;
          if (presenca.presente) {
            acc[mesAno].presentes += 1;
          }
          
          return acc;
        }, {});
        
        // Converter para formato do gráfico
        const dadosGrafico = Object.entries(presencaPorMes).map(([mesAno, dados]) => ({
          mes: mesAno,
          presenca: Math.round((dados.presentes / dados.total) * 100)
        }));
        
        setPresencaData(dadosGrafico);
      } catch (error) {
        setError(error instanceof Error ? error.message : "Erro ao carregar dados de presença");
      } finally {
        setLoading(false);
      }
    };
    
    fetchPresencaAluno();
  }, [alunoId]);

  const handleTurmaChange = (value: string) => {
    setTurmaSelecionada(value);
  };

  const handleAlunoChange = (value: string) => {
    setAlunoId(value);
  };

  const turmaAtual = turmas.find(t => t.id === turmaSelecionada);
  const alunoAtual = alunos.find(a => a.id === alunoId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Evolução do Aluno
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 mb-6">
          {/* Seletor de Turma */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Turma
            </label>
            <Select value={turmaSelecionada} onValueChange={handleTurmaChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma turma" />
              </SelectTrigger>
              <SelectContent>
                {loadingTurmas ? (
                  <div className="px-4 py-2 text-gray-500">Carregando turmas...</div>
                ) : turmas.length === 0 ? (
                  <div className="px-4 py-2 text-gray-500">Nenhuma turma encontrada</div>
                ) : (
                  turmas.map((turma) => (
                    <SelectItem key={turma.id} value={turma.id}>
                      {turma.nome}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Seletor de Aluno */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <User className="h-4 w-4" />
              Aluno
            </label>
            <Select value={alunoId} onValueChange={handleAlunoChange} disabled={!turmaSelecionada}>
              <SelectTrigger>
                <SelectValue placeholder={turmaSelecionada ? "Selecione um aluno" : "Primeiro selecione uma turma"} />
              </SelectTrigger>
              <SelectContent>
                {loadingAlunos ? (
                  <div className="px-4 py-2 text-gray-500">Carregando alunos...</div>
                ) : alunos.length === 0 ? (
                  <div className="px-4 py-2 text-gray-500">Nenhum aluno encontrado nesta turma</div>
                ) : (
                  alunos.map((aluno) => (
                    <SelectItem key={aluno.id} value={aluno.id}>
                      {aluno.nome} ({aluno.matricula})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Informações do aluno selecionado */}
          {alunoAtual && turmaAtual && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-sm text-blue-800">
                <p className="font-medium">Aluno: {alunoAtual.nome}</p>
                <p>Turma: {turmaAtual.nome} • Matrícula: {alunoAtual.matricula}</p>
              </div>
            </div>
          )}
        </div>

        <div className="h-[300px]">
          {loadingTurmas ? (
            <div className="h-full flex items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
                <p className="text-gray-500">Carregando turmas...</p>
              </div>
            </div>
          ) : error ? (
            <div className="h-full flex items-center justify-center">
              <div className="flex flex-col items-center gap-2 text-red-500">
                <AlertCircle size={24} />
                <p className="text-center">{error}</p>
              </div>
            </div>
          ) : turmas.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <Users className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                <p className="text-gray-500">Nenhuma turma encontrada.</p>
                <p className="text-sm text-gray-400">Crie uma turma para começar.</p>
              </div>
            </div>
          ) : !turmaSelecionada ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <Users className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                <p className="text-gray-500">Selecione uma turma para ver os alunos.</p>
              </div>
            </div>
          ) : loadingAlunos ? (
            <div className="h-full flex items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
                <p className="text-gray-500">Carregando alunos...</p>
              </div>
            </div>
          ) : alunos.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <User className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                <p className="text-gray-500">Nenhum aluno encontrado nesta turma.</p>
                <p className="text-sm text-gray-400">Adicione alunos à turma para começar.</p>
              </div>
            </div>
          ) : !alunoId ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <User className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                <p className="text-gray-500">Selecione um aluno para visualizar sua evolução.</p>
              </div>
            </div>
          ) : loading ? (
            <div className="h-full flex items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
                <p className="text-gray-500">Carregando dados do aluno...</p>
              </div>
            </div>
          ) : presencaData.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <AlertCircle className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                <p className="text-gray-500">Nenhum registro de presença encontrado.</p>
                <p className="text-sm text-gray-400">Faça algumas chamadas para ver a evolução.</p>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={presencaData}
                margin={{
                  top: 5,
                  right: 30,
                  left: 20,
                  bottom: 5,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" />
                <YAxis domain={[0, 100]} unit="%" />
                <Tooltip 
                  formatter={(value: number) => [`${value}%`, 'Frequência']}
                  labelFormatter={(label) => `Mês: ${label}`}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="presenca" 
                  name="Frequência" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default EvolucaoAlunoChart;
