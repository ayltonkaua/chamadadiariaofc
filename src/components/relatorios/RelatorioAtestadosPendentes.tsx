import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { Eye, User, GraduationCap, AlertCircle } from 'lucide-react';
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationLink, PaginationNext } from '@/components/ui/pagination';

interface AtestadoPendente {
  aluno_id: string;
  nome_aluno: string;
  nome_turma: string;
  pendentes_count: number;
  total_records: number;
}

const PAGE_SIZE = 10;

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

      // Nota: Certifique-se que a função RPC 'get_alunos_com_atestados_pendentes' existe no banco
      // Se não existir, você precisará criá-la ou usar uma consulta direta.
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
          setTotalPages(Math.ceil(reportData[0].total_records / PAGE_SIZE));
        } else {
          setTotalPages(0);
        }
      }
      setLoading(false);
    }
    fetchData();
  }, [user, currentPage]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Alunos com Atestados Pendentes</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground flex flex-col items-center">
            <div className="bg-green-50 p-3 rounded-full mb-3">
                <AlertCircle className="h-6 w-6 text-green-600" />
            </div>
            <p>Nenhum atestado pendente no momento.</p>
          </div>
        ) : (
          <>
            {/* --- VISÃO DESKTOP (Tabela) --- */}
            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Aluno</TableHead>
                    <TableHead>Turma</TableHead>
                    <TableHead className="text-right">Qtd. Pendente</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((item) => (
                    <TableRow key={item.aluno_id}>
                      <TableCell className="font-medium">{item.nome_aluno}</TableCell>
                      <TableCell>{item.nome_turma}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">
                          {item.pendentes_count} pendente(s)
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="outline" size="sm" className="h-8">
                          <Link to="/atestados">
                            <Eye className="mr-2 h-3 w-3" /> Revisar
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* --- VISÃO MOBILE (Cards) --- */}
            <div className="space-y-3 sm:hidden">
              {data.map((item) => (
                <Card key={item.aluno_id} className="bg-slate-50/50 border shadow-sm">
                  <CardHeader className="p-4 pb-2">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-500" />
                          {item.nome_aluno}
                        </CardTitle>
                        <CardDescription className="text-xs flex items-center gap-2">
                          <GraduationCap className="h-3 w-3" />
                          {item.nome_turma}
                        </CardDescription>
                      </div>
                      <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white border-0">
                        {item.pendentes_count}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardFooter className="p-3 pt-0 bg-white/50 rounded-b-lg border-t">
                    <Button asChild className="w-full mt-2 bg-white text-primary border border-input hover:bg-accent hover:text-accent-foreground h-9">
                      <Link to="/atestados">
                        <Eye className="mr-2 h-4 w-4" /> Ver Atestados
                      </Link>
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </>
        )}
      </CardContent>

      {/* Paginação */}
      {totalPages > 1 && (
        <CardFooter className="flex justify-center border-t pt-4 pb-4">
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