import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';

interface TurmaStats {
  turma_id: string;
  nome_turma: string;
  total_presentes: number;
  total_faltas: number;
  taxa_presenca: number;
}

interface Props {
  dateRange: DateRange | undefined;
}

export function TaxaPresencaTurmaReport({ dateRange }: Props) {
  const { user } = useAuth();
  const [data, setData] = useState<TurmaStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!user?.escola_id) return;
      setLoading(true);
      const { data: reportData, error } = await supabase.rpc('get_estatisticas_turmas', {
        _escola_id: user.escola_id,
        _data_inicio: dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : null,
        _data_fim: dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : null,
      });
      if (error) {
        console.error('Erro ao buscar estatísticas das turmas:', error);
      } else {
        setData(reportData || []);
      }
      setLoading(false);
    }
    fetchData();
  }, [user, dateRange]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Índices de Presença por Turma</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-[250px] w-full" />
        ) : data.length > 0 ? (
          <>
            <div className="h-[250px] mb-8">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="nome_turma" fontSize={12} tickLine={false} axisLine={false} angle={-45} textAnchor="end" height={60} />
                  <YAxis unit="%" domain={[0, 100]} />
                  <Tooltip
                    formatter={(value) => [`${Number(value).toFixed(1)}%`, "Frequência"]}
                  />
                  <Bar dataKey="taxa_presenca" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Turma</TableHead>
                  <TableHead>Taxa de Presença</TableHead>
                  <TableHead className="text-right">Presentes / Faltas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((turma) => (
                  <TableRow key={turma.turma_id}>
                    <TableCell>{turma.nome_turma}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={turma.taxa_presenca} className="w-full" />
                        <span>{turma.taxa_presenca.toFixed(1)}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{turma.total_presentes} / {turma.total_faltas}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        ) : (
          <p className="text-center text-muted-foreground mt-4">Nenhuma turma ou dado de presença encontrado para o período.</p>
        )}
      </CardContent>
    </Card>
  );
}