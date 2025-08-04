import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
// Adicionado CartesianGrid para o novo gráfico
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Sidebar from '@/components/layout/Sidebar';
import { PageHeader } from '@/components/ui/page-header';
import { Badge } from '@/components/ui/badge';
import { ControlledPagination } from '@/components/ui/controlled-pagination';
// CORREÇÃO: 'BookWarning' foi trocado por 'BookCopy'
import { CheckCircle2, XCircle, AlertTriangle, FileText, BookCopy, MessageSquareQuote } from 'lucide-react';
// --- ADIÇÃO: Importando o novo gráfico de evolução do aluno ---
import EvolucaoAlunoChart from '@/components/dashboard/EvolucaoAlunoChart';


// --- Novas Tipagens Adicionadas ---
interface KpiAdminData {
  atestados_pendentes: number;
  justificativas_a_rever: number;
}
// CORREÇÃO: A interface foi atualizada para refletir a saída da função SQL de porcentagem
interface FaltasDiaSemanaData {
  dia_semana_nome: string;
  percentual_faltas: number;
}
// CORREÇÃO: Interface de observações atualizada para os campos que você pediu
interface UltimaObservacaoData {
  aluno_nome: string;
  aluno_matricula: string;
  titulo: string;
  descricao: string;
}

// Tipagens (assumindo que as funções SQL retornam estes campos)
interface KpiData {
  taxa_presenca_geral: number;
  total_alunos: number;
}
interface TurmaComparisonData {
  turma_nome: string;
  taxa_presenca: number;
}
interface AlunoRiscoData {
  aluno_id: string; // Adicionado para chamadas de RPC
  aluno_nome: string;
  turma_nome: string;
  total_faltas: number;
}
interface AlunoFaltasConsecutivasData {
  aluno_id: string; // Adicionado para chamadas de RPC
  aluno_nome: string;
  turma_nome: string;
  ultima_falta: string;
  contagem_faltas_consecutivas: number;
}
interface UltimaPresenca {
  data_chamada: string;
  presente: boolean;
}

const ITEMS_PER_PAGE = 10;

// --- Subcomponente para a Lista de Alunos ---
// (Sem modificações nesta seção)
function AlunoListItem({ aluno, tipo }: { aluno: AlunoRiscoData | AlunoFaltasConsecutivasData; tipo: 'risco' | 'consecutivo' }) {
  const [ultimasPresencas, setUltimasPresencas] = useState<UltimaPresenca[]>([]);

  useEffect(() => {
    async function fetchPresencas() {
      // @ts-ignore - Supabase RPC pode não ter tipagem perfeita aqui
      const { data } = await supabase.rpc('get_ultimas_presencas_aluno', { p_aluno_id: aluno.aluno_id });
      if (data) {
        setUltimasPresencas(data);
      }
    }
    // @ts-ignore
    if (aluno.aluno_id) {
      fetchPresencas();
    }
    // @ts-ignore
  }, [aluno.aluno_id]);

  return (
    <li className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 border rounded-lg transition-colors hover:bg-muted/50">
      <div className="mb-2 sm:mb-0">
        <span className="font-medium">{aluno.aluno_nome}</span>
        <p className="text-sm text-muted-foreground">{aluno.turma_nome}</p>
      </div>
      <div className="flex w-full sm:w-auto justify-between items-center gap-4">
        <div className="flex gap-1.5" title="Últimas 3 chamadas">
          {ultimasPresencas.map((p, index) => (
            p.presente
              ? <CheckCircle2 key={index} className="h-5 w-5 text-green-500" title={`Presente em ${new Date(p.data_chamada).toLocaleDateString()}`} />
              : <XCircle key={index} className="h-5 w-5 text-red-500" title={`Faltou em ${new Date(p.data_chamada).toLocaleDateString()}`} />
          ))}
        </div>
        <Badge variant={tipo === 'risco' ? 'destructive' : 'warning'}>
            {/* @ts-ignore */}
          {aluno.total_faltas || aluno.contagem_faltas_consecutivas} Faltas
        </Badge>
      </div>
    </li>
  );
}


// --- Componente Principal da Página ---
export default function DashboardGestorPage() {
  const [kpis, setKpis] = useState<KpiData | null>(null);
  const [turmaData, setTurmaData] = useState<TurmaComparisonData[]>([]);
  const [alunosRisco, setAlunosRisco] = useState<AlunoRiscoData[]>([]);
  const [alunosFaltasConsecutivas, setAlunosFaltasConsecutivas] = useState<AlunoFaltasConsecutivasData[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados de Paginação
  const [riscoCurrentPage, setRiscoCurrentPage] = useState(1);
  const [consecutivasCurrentPage, setConsecutivasCurrentPage] = useState(1);

  // --- Novos Estados Adicionados ---
  const [kpisAdmin, setKpisAdmin] = useState<KpiAdminData | null>(null);
  const [faltasDiaSemana, setFaltasDiaSemana] = useState<FaltasDiaSemanaData[]>([]);
  const [ultimasObservacoes, setUltimasObservacoes] = useState<UltimaObservacaoData[]>([]);

  // Memoização para itens paginados
  const paginatedAlunosRisco = useMemo(() => {
    const startIndex = (riscoCurrentPage - 1) * ITEMS_PER_PAGE;
    return alunosRisco.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [alunosRisco, riscoCurrentPage]);

  const paginatedAlunosConsecutivos = useMemo(() => {
    const startIndex = (consecutivasCurrentPage - 1) * ITEMS_PER_PAGE;
    return alunosFaltasConsecutivas.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [alunosFaltasConsecutivas, consecutivasCurrentPage]);


  useEffect(() => {
    async function fetchDashboardData() {
      try {
        setLoading(true);
        // --- Chamadas RPC Adicionadas ao Promise.all ---
        const [
            kpiResult, 
            turmaResult, 
            riscoResult, 
            consecutivasResult,
            kpiAdminResult,
            faltasDiaResult,
            obsResult
        ] = await Promise.all([
          supabase.rpc('get_escola_kpis').select().single(),
          supabase.rpc('get_comparativo_turmas'),
          supabase.rpc('get_alunos_em_risco_anual', { limite_faltas: 16 }),
          supabase.rpc('get_alunos_faltas_consecutivas', { dias_seguidos: 3 }),
          supabase.rpc('get_kpis_administrativos').select().single(),
          supabase.rpc('get_faltas_por_dia_semana'),
          supabase.rpc('get_ultimas_observacoes')
        ]);

        if (kpiResult.data) setKpis(kpiResult.data);
        if (turmaResult.data) setTurmaData(turmaResult.data);
        if (riscoResult.data) setAlunosRisco(riscoResult.data);
        if (consecutivasResult.data) {
          setAlunosFaltasConsecutivas(consecutivasResult.data);
        }

        // --- Atribuição dos novos dados aos novos estados ---
        if (kpiAdminResult.data) setKpisAdmin(kpiAdminResult.data);
        if (faltasDiaResult.data) setFaltasDiaSemana(faltasDiaResult.data);
        if (obsResult.data) setUltimasObservacoes(obsResult.data);

      } catch (err) {
        console.error("Erro ao buscar dados do dashboard:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchDashboardData();
  }, []);


  return (
    <Sidebar>
      <PageHeader title="Relatórios de Gestão" description="Uma visão completa e estratégica da gestão escolar." />
      <div className="container mx-auto p-2 sm:p-4 space-y-6">
        
        {loading ? <p className='p-4'>Carregando dados do dashboard...</p> : (
          <>
            {/* LINHA 1: KPIs */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Presença Geral</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{kpis?.taxa_presenca_geral?.toFixed(1) ?? 'N/A'}%</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total de Alunos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{kpis?.total_alunos ?? 'N/A'}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Atestados Pendentes</CardTitle>
                    <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{kpisAdmin?.atestados_pendentes ?? '0'}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Justificativas a Rever</CardTitle>
                    <BookCopy className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{kpisAdmin?.justificativas_a_rever ?? '0'}</div>
                </CardContent>
              </Card>
            </div>
            
            {/* LINHA 2: Gráficos de Frequência */}
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Frequência por Turma</CardTitle>
                </CardHeader>
                <CardContent className="h-[350px] w-full pl-0">
                  <ResponsiveContainer>
                    <BarChart data={turmaData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                      <XAxis dataKey="turma_nome" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis fontSize={12} tickLine={false} axisLine={false} unit="%" />
                      <Tooltip cursor={{fill: 'transparent'}} formatter={(value: number) => `${value.toFixed(1)}%`} />
                      <Legend wrapperStyle={{fontSize: "0.8rem"}} />
                      <Bar dataKey="taxa_presenca" fill="var(--color-primary, #6D28D9)" name="Presença" radius={[4, 4, 0, 0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                    <CardTitle>Padrão de Ausências na Semana</CardTitle>
                </CardHeader>
                <CardContent className="h-[350px] w-full pl-0">
                  <ResponsiveContainer>
                    <BarChart data={faltasDiaSemana} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="dia_semana_nome" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis fontSize={12} tickLine={false} axisLine={false} unit="%" />
                      <Tooltip cursor={{fill: 'transparent'}} formatter={(value: number) => `${value.toFixed(1)}%`} />
                      <Legend wrapperStyle={{fontSize: "0.8rem"}} />
                      <Bar dataKey="percentual_faltas" fill="var(--color-secondary, #F59E0B)" name="% de Faltas" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* LINHA 3: Listas de Alunos e Radar de Comportamento */}
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2 grid gap-6">
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive"/> Alunos em Situação Crítica</CardTitle><p className='text-sm text-muted-foreground'>Alunos com 16 ou mais faltas durante o ano.</p></CardHeader>
                  <CardContent>
                    <ul className="space-y-3">{paginatedAlunosRisco.map((aluno) => (<AlunoListItem key={aluno.aluno_id} aluno={aluno} tipo="risco" />))}</ul>
                    <ControlledPagination totalItems={alunosRisco.length} itemsPerPage={ITEMS_PER_PAGE} currentPage={riscoCurrentPage} onPageChange={setRiscoCurrentPage}/>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-yellow-500"/> Alunos com Faltas Consecutivas</CardTitle><p className='text-sm text-muted-foreground'>Alunos que faltaram 3 ou mais dias seguidos recentemente.</p></CardHeader>
                  <CardContent>
                    <ul className="space-y-3">{paginatedAlunosConsecutivos.map((aluno) => (<AlunoListItem key={aluno.aluno_id} aluno={aluno} tipo="consecutivo" />))}</ul>
                    <ControlledPagination totalItems={alunosFaltasConsecutivas.length} itemsPerPage={ITEMS_PER_PAGE} currentPage={consecutivasCurrentPage} onPageChange={setConsecutivasCurrentPage}/>
                  </CardContent>
                </Card>
              </div>

              <Card className="lg:col-span-1">
                <CardHeader><CardTitle className="flex items-center gap-2"><MessageSquareQuote className="h-5 w-5 text-sky-500" /> Radar de Comportamento</CardTitle><p className='text-sm text-muted-foreground'>Últimas observações registradas.</p></CardHeader>
                <CardContent>
                  <ul className="space-y-4">
                    {ultimasObservacoes.length > 0 ? ultimasObservacoes.map((obs, index) => (
                      <li key={index} className="flex flex-col border-b pb-2 last:border-b-0">
                        <span className="font-semibold">{obs.titulo}</span>
                        <p className="text-sm text-muted-foreground mt-1">"{obs.descricao}"</p>
                        <span className="text-xs text-muted-foreground mt-2">Aluno(a): {obs.aluno_nome} ({obs.aluno_matricula})</span>
                      </li>
                    )) : (
                      <p className="text-sm text-muted-foreground">Nenhuma observação recente.</p>
                    )}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </Sidebar>
  );
}