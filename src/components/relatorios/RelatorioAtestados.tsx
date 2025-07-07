import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationLink, PaginationNext } from '@/components/ui/pagination';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';

interface AtestadoData {
  aluno_id: string;
  nome_aluno: string;
  nome_turma: string;
  total_atestados: number;
  total_records: number; // Campo para o total de registros
}

interface Props {
  dateRange: DateRange | undefined;
}

const PAGE_SIZE = 10; // Define quantos itens por página

export function RelatorioAtestados({ dateRange }: Props) {
  const { user } = useAuth();
  const [data, setData] = useState<AtestadoData[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    async function fetchData() {
      if (!user?.escola_id) return;
      setLoading(true);

      const { data: reportData, error } = await supabase.rpc('get_relatorio_atestados', {
        _escola_id: user.escola_id,
        _data_inicio: dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : null,
        _data_fim: dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : null,
        _page_size: PAGE_SIZE,
        _page_number: currentPage,
      });

      if (error) {
        console.error('Erro ao buscar relatório de atestados:', error);
        setData([]);
        setTotalPages(0);
      } else {
        setData(reportData || []);
        if (reportData && reportData.length > 0) {
          // Calcula o total de páginas com base no total de registros retornado pela função
          setTotalPages(Math.ceil(reportData[0].total_records / PAGE_SIZE));
        } else {
          setTotalPages(0);
        }
      }
      setLoading(false);
    }
    fetchData();
  }, [user, dateRange, currentPage]); // Adiciona currentPage como dependência

  return (
    <Card>
      <CardHeader>
        <CardTitle>Alunos com Mais Atestados Aprovados</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aluno</TableHead>
                <TableHead>Turma</TableHead>
                <TableHead className="text-right">Total de Atestados</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item) => (
                <TableRow key={item.aluno_id}>
                  <TableCell>{item.nome_aluno}</TableCell>
                  <TableCell>{item.nome_turma}</TableCell>
                  <TableCell className="text-right font-bold">{item.total_atestados}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {!loading && data.length === 0 && <p className="text-center text-muted-foreground mt-4">Nenhum atestado encontrado para o período selecionado.</p>}
      </CardContent>
      {/* Adiciona o componente de paginação no rodapé do card */}
      {totalPages > 1 && (
        <CardFooter>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); setCurrentPage(p => Math.max(1, p - 1)); }} disabled={currentPage === 1} />
              </PaginationItem>
              <PaginationItem>
                <span className="px-4 text-sm">Página {currentPage} de {totalPages}</span>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext href="#" onClick={(e) => { e.preventDefault(); setCurrentPage(p => Math.min(totalPages, p + 1)); }} disabled={currentPage === totalPages} />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </CardFooter>
      )}
    </Card>
  );
}