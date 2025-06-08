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
  ResponsiveContainer,
  Legend 
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

interface TurmaFrequencia {
  nome: string;
  frequencia: number;
  totalPresencas: number;
  totalChamadas: number;
}

const ComparativoTurmasChart = () => {
  const { user } = useAuth();
  const [turmasData, setTurmasData] = useState<TurmaFrequencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTurmasFrequencia = async () => {
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
          .select("id, nome")
          .eq("user_id", user.id);
        
        if (turmasError) {
          throw new Error("Erro ao buscar turmas");
        }
        
        if (!turmas || turmas.length === 0) {
          setTurmasData([]);
          setLoading(false);
          return;
        }
        
        // Para cada turma, calcular frequência
        const turmasComFrequencia = await Promise.all(
          turmas.map(async (turma) => {
            try {
              // Buscar todas as presenças da turma
              const { data: presencas, error: presencasError } = await supabase
                .from("presencas")
                .select("presente")
                .eq("turma_id", turma.id);
              
              if (presencasError) {
                throw new Error(`Erro ao buscar presenças da turma ${turma.nome}`);
              }
              
              const totalPresencas = presencas?.filter(p => p.presente).length || 0;
              const totalChamadas = presencas?.length || 0;
              const percentualPresenca = totalChamadas > 0 
                ? Math.round((totalPresencas / totalChamadas) * 100) 
                : 0;
              
              return {
                nome: turma.nome,
                frequencia: percentualPresenca,
                totalPresencas,
                totalChamadas
              };
            } catch (error) {
              console.error(`Erro ao processar turma ${turma.nome}:`, error);
              return {
                nome: turma.nome,
                frequencia: 0,
                totalPresencas: 0,
                totalChamadas: 0
              };
            }
          })
        );
        
        setTurmasData(turmasComFrequencia);
      } catch (error) {
        setError(error instanceof Error ? error.message : "Erro ao carregar dados das turmas");
      } finally {
        setLoading(false);
      }
    };
    
    fetchTurmasFrequencia();
  }, [user]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Comparativo de Frequência por Turma</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500" />
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
          <CardTitle>Comparativo de Frequência por Turma</CardTitle>
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

  if (turmasData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Comparativo de Frequência por Turma</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center">
          <p className="text-gray-500">Nenhuma turma encontrada.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Comparativo de Frequência por Turma</CardTitle>
      </CardHeader>
      <CardContent className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={turmasData}
            margin={{
              top: 5,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="nome" />
            <YAxis domain={[0, 100]} unit="%" />
            <Tooltip 
              formatter={(value: number) => [`${value}%`, 'Frequência']}
              labelFormatter={(label) => `Turma: ${label}`}
            />
            <Legend />
            <Bar 
              dataKey="frequencia" 
              name="Frequência" 
              fill="#82ca9d" 
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default ComparativoTurmasChart;
