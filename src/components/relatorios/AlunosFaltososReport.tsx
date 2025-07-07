import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { DateRange } from 'react-day-picker';

// Componentes da UI
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationLink, PaginationNext } from '@/components/ui/pagination';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { History, FileSpreadsheet, Loader2, FileText } from 'lucide-react';

// Tipos
interface Faltoso {
  aluno_id: string;
  nome_aluno: string;
  matricula: string;
  turma_id: string;
  nome_turma: string;
  total_faltas: number;
  total_records: number;
}
interface Turma {
  id: string;
  nome: string;
}
type AtestadoStatus = 'aprovado' | 'pendente';

// Constantes
const MIN_FALTAS = 8;
const PAGE_SIZE = 10;

interface Props {
  dateRange: DateRange | undefined;
}

export function AlunosFaltososReport({ dateRange }: Props) {
  const { user } = useAuth();
  const [data, setData] = useState<Faltoso[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [atestadoStatus, setAtestadoStatus] = useState<Map<string, AtestadoStatus>>(new Map());

  // Estados para filtros e paginação
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [selectedTurma, setSelectedTurma] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  // Efeito para debounce da busca por nome
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1); // Reseta a página ao buscar
    }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Efeito para buscar as turmas disponíveis para o filtro
  useEffect(() => {
    async function fetchTurmas() {
      if (!user?.escola_id) return;
      const { data: turmasData } = await supabase.from('turmas').select('id, nome').eq('escola_id', user.escola_id).order('nome');
      setTurmas(turmasData || []);
    }
    fetchTurmas();
  }, [user]);

  // Efeito principal para buscar os dados do relatório
  useEffect(() => {
    async function fetchData() {
      if (!user?.escola_id) return;
      setLoading(true);

      const { data: reportData, error } = await supabase.rpc('get_ranking_faltosos', {
        _escola_id: user.escola_id,
        _min_faltas: MIN_FALTAS,
        _nome_filtro: debouncedSearchTerm,
        _turma_id_filtro: selectedTurma,
        _page_size: PAGE_SIZE,
        _page_number: currentPage
      });

      if (error) {
        toast({ title: "Erro ao buscar relatório", description: error.message, variant: 'destructive' });
        setData([]);
        setTotalPages(0);
      } else {
        const faltososData = reportData || [];
        setData(faltososData);
        setTotalPages(faltososData.length > 0 ? Math.ceil(faltososData[0].total_records / PAGE_SIZE) : 0);
        
        if (faltososData.length > 0) {
          const studentIds = faltososData.map(s => s.aluno_id);
          const { data: atestados } = await supabase.from('atestados').select('aluno_id, status').in('aluno_id', studentIds).in('status', ['aprovado', 'pendente']);
          
          const statusMap = new Map<string, AtestadoStatus>();
          atestados?.forEach(atestado => {
            if (statusMap.get(atestado.aluno_id) !== 'aprovado') {
              statusMap.set(atestado.aluno_id, atestado.status as AtestadoStatus);
            }
          });
          setAtestadoStatus(statusMap);
        }
      }
      setLoading(false);
    }
    fetchData();
  }, [user, debouncedSearchTerm, selectedTurma, currentPage, toast]);

  const handleTurmaChange = (turmaId: string) => {
    setSelectedTurma(turmaId === 'todas' ? null : turmaId);
    setCurrentPage(1);
  };
  
  // LÓGICA DE EXPORTAÇÃO ATIVADA
  const handleExport = async () => {
    if (!user?.escola_id) return;
    setIsExporting(true);
    try {
      // Chama a função RPC para buscar TODOS os dados, ignorando a paginação
      const { data: allData, error } = await supabase.rpc('get_ranking_faltosos', {
        _escola_id: user.escola_id,
        _min_faltas: MIN_FALTAS,
        _nome_filtro: debouncedSearchTerm,
        _turma_id_filtro: selectedTurma
      });

      if (error || !allData || allData.length === 0) {
        throw error || new Error("Nenhum dado retornado para exportação.");
      }

      // Formata os dados para a planilha com os cabeçalhos desejados
      const formattedData = allData.map(aluno => ({
        'Nome do Aluno': aluno.nome_aluno,
        'Matrícula': aluno.matricula,
        'Turma': aluno.nome_turma,
        'Quantidade de Faltas': aluno.total_faltas,
      }));

      const worksheet = XLSX.utils.json_to_sheet(formattedData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Alunos Faltosos');
      
      // Ajusta a largura das colunas para melhor visualização
      worksheet["!cols"] = [
          { wch: 35 }, // Largura da coluna "Nome do Aluno"
          { wch: 15 }, // Largura da coluna "Matrícula"
          { wch: 20 }, // Largura da coluna "Turma"
          { wch: 20 }, // Largura da coluna "Quantidade de Faltas"
      ];

      // Gera o arquivo e inicia o download
      XLSX.writeFile(workbook, 'Relatorio_Alunos_Faltosos.xlsx');
      toast({ title: "Sucesso!", description: "O download do seu relatório foi iniciado." });

    } catch (err: any) {
      console.error("Erro ao exportar:", err);
      toast({ title: "Erro ao exportar", description: err.message || "Não foi possível gerar o arquivo Excel.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Alunos com 8 ou mais faltas</CardTitle>
        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <Input
            placeholder="Filtrar por nome do aluno..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-auto flex-grow"
          />
          <Select onValueChange={handleTurmaChange} defaultValue="todas">
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Filtrar por turma" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as Turmas</SelectItem>
              {turmas.map((turma) => (
                <SelectItem key={turma.id} value={turma.id}>{turma.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleExport} disabled={isExporting || loading || data.length === 0} className="w-full sm:w-auto">
            {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
            Exportar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[...Array(PAGE_SIZE)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aluno</TableHead>
                <TableHead>Turma</TableHead>
                <TableHead className="text-center">Total de Faltas</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((aluno) => (
                <TableRow key={aluno.aluno_id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span>{aluno.nome_aluno}</span>
                      {atestadoStatus.get(aluno.aluno_id) === 'aprovado' && (
                        <TooltipProvider>
                          <Tooltip><TooltipTrigger><FileText className="h-4 w-4 text-green-500" /></TooltipTrigger><TooltipContent><p>Possui atestado(s) aprovado(s)</p></TooltipContent></Tooltip>
                        </TooltipProvider>
                      )}
                      {atestadoStatus.get(aluno.aluno_id) === 'pendente' && (
                        <TooltipProvider>
                          <Tooltip><TooltipTrigger><FileText className="h-4 w-4 text-yellow-500" /></TooltipTrigger><TooltipContent><p>Possui atestado(s) pendente(s)</p></TooltipContent></Tooltip>
                        </TooltipProvider>
                      )}
                      <span className="text-muted-foreground text-xs">({aluno.matricula})</span>
                    </div>
                  </TableCell>
                  <TableCell>{aluno.nome_turma}</TableCell>
                  <TableCell className="text-center font-bold text-lg">{aluno.total_faltas}</TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="icon">
                      <Link to={`/turmas/${aluno.turma_id}/alunos/${aluno.aluno_id}`} title="Ver Histórico do Aluno">
                        <History className="h-4 w-4" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {!loading && data.length === 0 && <p className="text-center text-muted-foreground mt-4 py-8">Nenhum aluno encontrado com os filtros aplicados.</p>}
      </CardContent>
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