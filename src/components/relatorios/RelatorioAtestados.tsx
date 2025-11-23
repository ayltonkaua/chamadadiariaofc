import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationLink, PaginationNext } from '@/components/ui/pagination';
import { Badge } from '@/components/ui/badge';
import { User, GraduationCap, FileCheck } from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';

interface AtestadoData {
  aluno_id: string;
  nome_aluno: string;
  nome_turma: string;
  total_atestados: number;
  total_records: number;
}

interface Props {
  dateRange?: DateRange | undefined;
}

const PAGE_SIZE = 10;

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
          setTotalPages(Math.ceil(reportData[0].total_records / PAGE_SIZE));
        } else {
          setTotalPages(0);
        }
      }
      setLoading(false);
    }
    fetchData();
  }, [user, dateRange, currentPage]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Alunos com Mais Atestados Aprovados</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground flex flex-col items-center">
             <FileCheck className="h-8 w-8 text-gray-300 mb-2" />
             <p>Nenhum atestado encontrado para o período selecionado.</p>
          </div>
        ) : (
          <>
            {/* --- VISÃO DESKTOP (TABELA) --- */}
            <div className="hidden sm:block">
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
                      <TableCell className="font-medium">{item.nome_aluno}</TableCell>
                      <TableCell>{item.nome_turma}</TableCell>
                      <TableCell className="text-right font-bold">
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          {item.total_atestados}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* --- VISÃO MOBILE (CARDS) --- */}
            <div className="space-y-3 sm:hidden">
              {data.map((item) => (
                <Card key={item.aluno_id} className="bg-slate-50/50 border shadow-sm p-4">
                  <div className="flex justify-between items-center">
                    <div className="space-y-1">
                      <div className="font-semibold text-sm flex items-center gap-2">
                        <User className="h-4 w-4 text-gray-500" />
                        {item.nome_aluno}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <GraduationCap className="h-3.5 w-3.5" />
                        {item.nome_turma}
                      </div>
                    </div>
                    <div className="text-center pl-4 border-l ml-4">
                      <span className="text-[10px] uppercase text-muted-foreground font-bold block">Total</span>
                      <span className="text-lg font-bold text-green-700">{item.total_atestados}</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
      </CardContent>

      {/* Paginação */}
      {totalPages > 1 && (
        <CardFooter className="flex justify-center pt-2 pb-6">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  href="#" 
                  onClick={(e) => { e.preventDefault(); setCurrentPage(p => Math.max(1, p - 1)); }} 
                  className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''} 
                />
              </PaginationItem>
              <PaginationItem>
                <span className="px-4 text-sm text-muted-foreground">
                  Página {currentPage} de {totalPages}
                </span>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext 
                  href="#" 
                  onClick={(e) => { e.preventDefault(); setCurrentPage(p => Math.min(totalPages, p + 1)); }} 
                  className={currentPage === totalPages ? 'pointer-events-none opacity-50' : ''} 
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </CardFooter>
      )}
    </Card>
  );
}