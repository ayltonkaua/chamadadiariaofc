import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";

// Aceita a lista de IDs das turmas filtradas
export function DesempenhoAcademicoChart({ turmasIds }: { turmasIds: string[] }) {
  const { user } = useAuth();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!user?.escola_id) return;
      setLoading(true);
      
      // Busca notas trazendo também a turma do aluno para podermos filtrar
      let query = supabase
        .from("notas")
        .select(`
          valor,
          disciplina:disciplinas(nome),
          aluno:alunos!inner(turma_id) 
        `)
        .eq("escola_id", user.escola_id);

      // Se houver filtro de turmas, aplica diretamente no banco para ser mais leve
      if (turmasIds.length > 0) {
        query = query.in('aluno.turma_id', turmasIds);
      }

      const { data: notas, error } = await query;

      if (!error && notas) {
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
          .sort((a, b) => a.media - b.media);

        setData(chartData);
      }
      setLoading(false);
    }
    fetchData();
  }, [user?.escola_id, turmasIds]); // Recarrega quando os IDs das turmas mudam

  if (loading) return <Skeleton className="h-[300px] w-full" />;

  return (
    <Card className="col-span-4 h-full shadow-sm border-gray-200">
      <CardHeader>
        <CardTitle className="text-lg text-gray-800">Desempenho Acadêmico</CardTitle>
      </CardHeader>
      <CardContent className="pl-2 h-[300px]">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
              <XAxis type="number" domain={[0, 10]} hide />
              <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} interval={0} />
              <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px' }} />
              <Bar dataKey="media" radius={[0, 4, 4, 0]} barSize={15}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.media < 6 ? "#ef4444" : "#8884d8"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-gray-400 text-sm">
            Sem dados para o filtro atual.
          </div>
        )}
      </CardContent>
    </Card>
  );
}