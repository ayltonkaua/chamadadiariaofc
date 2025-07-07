import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '../ui/button';
import { Link } from 'react-router-dom';
import { Eye } from 'lucide-react';
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationLink, PaginationNext } from '@/components/ui/pagination';

interface AtestadoPendente {
  aluno_id: string;
  nome_aluno: string;
  nome_turma: string;
  pendentes_count: number;
  total_records: number; // Campo para o total de registros
}

const PAGE_SIZE = 10; // Define quantos itens por página

export function RelatorioAtestadosPendentes() {
  const { user } = useAuth();
  const [data, setData] = useState<AtestadoPendente[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    async function fetchData() {
      if (!user?.escola_id) return;
      setLoading(true);

      const { data: reportData, error } = await supabase.rpc('get_alunos_com_atestados_pendentes', {
        _escola_id: user.escola_id,
        _page_size: PAGE_SIZE,
        _page_number: currentPage,
      });

      if (error) {
        console.error('Erro ao buscar atestados pendentes:', error);
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
  }, [user, currentPage]); // Adiciona currentPage como dependência

  return (
    <Card>
      <CardHeader>
        <CardTitle>Alunos com Atestados Pendentes</CardTitle>
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
                <TableHead className="text-right">Atestados Pendentes</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item) => (
                <TableRow key={item.aluno_id}>
                  <TableCell>{item.nome_aluno}</TableCell>
                  <TableCell>{item.nome_turma}</TableCell>
                  <TableCell className="text-right font-bold">{item.pendentes_count}</TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="outline" size="sm">
                       <Link to="/atestados">
                         <Eye className="mr-2 h-4 w-4" /> Ver Atestados
                       </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {!loading && data.length === 0 && <p className="text-center text-muted-foreground mt-4">Nenhum aluno com atestados pendentes.</p>}
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