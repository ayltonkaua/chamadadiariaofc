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
import { AlertCircle } from "lucide-react";

interface AlunoPresencaMensal {
  mes: string;
  presenca: number;
}

interface AlunoOption {
  id: string;
  nome: string;
  matricula: string;
  turma: string;
}

const EvolucaoAlunoChart = () => {
  const { user } = useAuth();
  const [alunoId, setAlunoId] = useState<string>("");
  const [alunos, setAlunos] = useState<AlunoOption[]>([]);
  const [presencaData, setPresencaData] = useState<AlunoPresencaMensal[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingAlunos, setLoadingAlunos] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAlunos = async () => {
      if (!user) {
        setError("Usuário não autenticado");
        setLoadingAlunos(false);
        return;
      }
      
      setLoadingAlunos(true);
      setError(null);
      
      try {
        // Buscar turmas do usuário
        const { data: turmas, error: turmasError } = await supabase
          .from("turmas")
          .select("id, nome")
          .eq("user_id", user.id);
        
        if (turmasError) {
          throw new Error("Erro ao buscar turmas");
        }
        
        if (!turmas || turmas.length === 0) {
          setAlunos([]);
          setLoadingAlunos(false);
          return;
        }
        
        const turmaIds = turmas.map(t => t.id);
        const turmasMap = turmas.reduce((acc: {[key: string]: string}, turma) => {
          acc[turma.id] = turma.nome;
          return acc;
        }, {});
        
        // Buscar alunos das turmas
        const { data: alunosData, error: alunosError } = await supabase
          .from("alunos")
          .select("id, nome, matricula, turma_id")
          .in("turma_id", turmaIds);
          
        if (alunosError) {
          throw new Error("Erro ao buscar alunos");
        }
        
        if (!alunosData || alunosData.length === 0) {
          setAlunos([]);
          setLoadingAlunos(false);
          return;
        }
        
        const alunosFormatados = alunosData
          .map(aluno => ({
            id: aluno.id,
            nome: aluno.nome,
            matricula: aluno.matricula,
            turma: turmasMap[aluno.turma_id]
          }))
          .sort((a, b) => a.nome.localeCompare(b.nome));
        
        setAlunos(alunosFormatados);
      } catch (error) {
        setError(error instanceof Error ? error.message : "Erro ao carregar alunos");
      } finally {
        setLoadingAlunos(false);
      }
    };
    
    fetchAlunos();
  }, [user]);

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

  const handleAlunoChange = (value: string) => {
    setAlunoId(value);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Evolução do Aluno</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-6">
          <Select value={alunoId} onValueChange={handleAlunoChange}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um aluno" />
            </SelectTrigger>
            <SelectContent>
              {alunos.map((aluno) => (
                <SelectItem key={aluno.id} value={aluno.id}>
                  {aluno.nome} - {aluno.turma}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="h-[300px]">
          {loadingAlunos ? (
            <div className="h-full flex items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
                <p className="text-gray-500">Carregando alunos...</p>
              </div>
            </div>
          ) : error ? (
            <div className="h-full flex items-center justify-center">
              <div className="flex flex-col items-center gap-2 text-red-500">
                <AlertCircle size={24} />
                <p>{error}</p>
              </div>
            </div>
          ) : alunos.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <p className="text-gray-500">Nenhum aluno encontrado.</p>
            </div>
          ) : !alunoId ? (
            <div className="h-full flex items-center justify-center">
              <p className="text-gray-500">Selecione um aluno para visualizar sua evolução.</p>
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
              <p className="text-gray-500">Nenhum registro de presença encontrado para este aluno.</p>
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
