import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertCircle } from "lucide-react";

interface FrequenciaData {
  mes: string;
  frequencia: number;
  total: number;
}

interface Presenca {
  data_chamada: string;
  presente: boolean;
  turmas: {
    user_id: string;
  };
}

const FrequenciaGeralChart = () => {
  const { user } = useAuth();
  const [frequenciaData, setFrequenciaData] = useState<FrequenciaData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFrequenciaGeral = async () => {
      if (!user) {
        setError("Usuário não autenticado");
        setLoading(false);
        return;
      }
      
      setLoading(true);
      setError(null);
      
      try {
        // Buscar turmas do usuário
        const { data: turmas, error: turmasError } = await supabase
          .from("turmas")
          .select("id")
          .eq("user_id", user.id);
        
        if (turmasError) {
          throw new Error("Erro ao buscar turmas");
        }
        
        if (!turmas || turmas.length === 0) {
          setFrequenciaData([]);
          setLoading(false);
          return;
        }
        
        const turmaIds = turmas.map(t => t.id);
        
        // Obter os últimos 6 meses
        const dataInicio = subMonths(new Date(), 5);
        const dataFim = new Date();
        const ultimos6Meses = Array.from({ length: 6 }, (_, i) => {
          const data = subMonths(new Date(), i);
          return format(data, 'yyyy-MM');
        }).reverse();
            
            // Buscar presença
            const { data: presencas, error: presencasError } = await supabase
              .from("presencas")
          .select("data_chamada, presente, turmas!inner(user_id)")
              .in("turma_id", turmaIds)
              .eq("turmas.user_id", user.id)
          .gte("data_chamada", format(dataInicio, 'yyyy-MM-dd'))
          .lte("data_chamada", format(dataFim, 'yyyy-MM-dd'))
          .order("data_chamada", { ascending: true });
            
            if (presencasError) {
          console.error("Erro ao buscar presenças:", presencasError);
          setFrequenciaData([]);
          setLoading(false);
          return;
        }
        
        console.log('Presenças encontradas:', presencas); // Debug
        
        // Agrupar por mês
        const presencaPorMes = presencas.reduce((acc: {[key: string]: {total: number, presentes: number}}, presenca) => {
          const dataLocal = new Date(presenca.data_chamada + 'T00:00:00');
          const mesAno = format(dataLocal, 'yyyy-MM');
          
          if (!acc[mesAno]) {
            acc[mesAno] = { total: 0, presentes: 0 };
          }
          
          acc[mesAno].total += 1;
          if (presenca.presente) {
            acc[mesAno].presentes += 1;
          }
          
          return acc;
        }, {});
        
        console.log('Presenças por mês:', presencaPorMes); // Debug
        
        // Converter para formato do gráfico e garantir que todos os meses estejam presentes
        const dadosGrafico = ultimos6Meses.map(mesAno => {
          const [ano, mes] = mesAno.split('-');
          const dados = presencaPorMes[mesAno] || { total: 0, presentes: 0 };
          const dataMes = new Date(parseInt(ano), parseInt(mes) - 1, 1);
            
            return {
              mes: format(dataMes, 'MMM', { locale: ptBR }),
            frequencia: dados.total > 0 ? Math.round((dados.presentes / dados.total) * 100) : 0,
            total: dados.total
            };
        });
        
        console.log('Dados do gráfico:', dadosGrafico);
        setFrequenciaData(dadosGrafico);
      } catch (error) {
        setError(error instanceof Error ? error.message : "Erro ao carregar dados");
      } finally {
        setLoading(false);
      }
    };
    
    fetchFrequenciaGeral();
  }, [user]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Frequência Geral por Mês</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
            <p className="text-gray-500">Carregando dados...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Frequência Geral por Mês</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-red-500">
            <AlertCircle size={24} />
            <p>{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (frequenciaData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Frequência Geral por Mês</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center">
          <p className="text-gray-500">Nenhum dado de frequência encontrado.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Frequência Geral por Mês</CardTitle>
      </CardHeader>
      <CardContent className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={frequenciaData}
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
            <Bar 
              dataKey="frequencia" 
              name="Frequência" 
              fill="#8884d8" 
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default FrequenciaGeralChart;
