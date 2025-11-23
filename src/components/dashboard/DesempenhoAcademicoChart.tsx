import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";

export function DesempenhoAcademicoChart() {
  const { user } = useAuth();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!user?.escola_id) return;
      
      // Busca notas com o nome da disciplina
      const { data: notas, error } = await supabase
        .from("notas")
        .select(`
          valor,
          disciplina:disciplinas(nome)
        `)
        .eq("escola_id", user.escola_id);

      if (!error && notas) {
        // Agrupar e calcular média por disciplina
        const grupos: Record<string, { total: number; count: number }> = {};

        notas.forEach((n: any) => {
          const nome = n.disciplina?.nome || "Outros";
          if (!grupos[nome]) grupos[nome] = { total: 0, count: 0 };
          grupos[nome].total += Number(n.valor);
          grupos[nome].count += 1;
        });

        const chartData = Object.entries(grupos)
          .map(([name, stats]) => ({
            name,
            media: parseFloat((stats.total / stats.count).toFixed(1))
          }))
          .sort((a, b) => a.media - b.media); // Ordenar da menor para maior média (ajuda a ver dificuldade)

        setData(chartData);
      }
      setLoading(false);
    }
    fetchData();
  }, [user?.escola_id]);

  if (loading) return <Skeleton className="h-[300px] w-full" />;

  return (
    <Card className="col-span-4">
      <CardHeader>
        <CardTitle>Desempenho Acadêmico Médio por Disciplina</CardTitle>
      </CardHeader>
      <CardContent className="pl-2">
        <div className="h-[300px] w-full">
          {data.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                <XAxis type="number" domain={[0, 10]} hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  width={100} 
                  tick={{ fontSize: 12 }} 
                  interval={0}
                />
                <Tooltip 
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="media" radius={[0, 4, 4, 0]} barSize={20}>
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.media < 6 ? "#ef4444" : "#8884d8"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-gray-400 text-sm">
              Nenhuma nota lançada ainda.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}