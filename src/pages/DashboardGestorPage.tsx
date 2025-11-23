import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Sidebar from '@/components/layout/Sidebar';
import { Badge } from '@/components/ui/badge';
import { ControlledPagination } from '@/components/ui/controlled-pagination';
import { 
    CheckCircle2, 
    XCircle, 
    AlertTriangle, 
    FileText, 
    BookCopy, 
    MessageSquareQuote,
    TrendingUp,   
    Users        
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from "@/components/ui/scroll-area";
// Importação do novo gráfico de notas
import { DesempenhoAcademicoChart } from "@/components/dashboard/DesempenhoAcademicoChart";

// --- Tipagens ---

interface KpiAdminData {
  atestados_pendentes: number;
  justificativas_a_rever: number;
}
interface FaltasDiaSemanaData {
  dia_semana_nome: string;
  percentual_faltas: number;
}
interface UltimaObservacaoData {
  aluno_nome: string;
  aluno_matricula: string;
  titulo: string;
  descricao: string;
  created_at?: string;
}
interface KpiData {
  taxa_presenca_geral: number;
  total_alunos: number;
}
interface TurmaComparisonData {
  turma_nome: string;
  taxa_presenca: number;
}
interface AlunoRiscoData {
  aluno_id: string;
  aluno_nome: string;
  turma_nome: string;
  total_faltas: number;
}
interface AlunoFaltasConsecutivasData {
  aluno_id: string;
  aluno_nome: string;
  turma_nome: string;
  ultima_falta: string;
  contagem_faltas_consecutivas: number;
}
interface UltimaPresenca {
  data_chamada: string;
  presente: boolean;
}

const ITEMS_PER_PAGE = 5;

// --- Subcomponentes ---

const SummaryCard = ({ title, value, icon: Icon, colorClass, loading }: { title: string; value: string | number; icon: React.ElementType; colorClass: string; loading: boolean; }) => {
  if (loading) {
    return <Skeleton className="h-28 w-full rounded-xl" />;
  }
  return (
    <Card className={`text-white relative overflow-hidden ${colorClass} shadow-md border-0`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium opacity-90">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
        <Icon className="absolute -right-4 -bottom-4 h-24 w-24 text-white/10" />
      </CardContent>
    </Card>
  );
};

function AlunoListItem({ aluno, tipo }: { aluno: AlunoRiscoData | AlunoFaltasConsecutivasData; tipo: 'risco' | 'consecutivo' }) {
  const [ultimasPresencas, setUltimasPresencas] = useState<UltimaPresenca[]>([]);

  useEffect(() => {
    async function fetchPresencas() {
      // @ts-ignore
      const { data } = await supabase.rpc('get_ultimas_presencas_aluno', { p_aluno_id: aluno.aluno_id });
      if (data) setUltimasPresencas(data.slice(0, 3));
    }
    // @ts-ignore
    if (aluno.aluno_id) fetchPresencas();
    // @ts-ignore
  }, [aluno.aluno_id]);
  
  const getBadgeInfo = () => {
    switch (tipo) {
      case 'risco':
        // @ts-ignore
        return { text: `${aluno.total_faltas} Faltas`, variant: 'destructive', className: 'bg-red-100 text-red-700 hover:bg-red-200 border-red-200' };
      case 'consecutivo':
        // @ts-ignore
        return { text: `${aluno.contagem_faltas_consecutivas} Seguidas`, variant: 'secondary', className: 'bg-orange-100 text-orange-700 hover:bg-orange-200 border-orange-200' };
      default:
        return { text: '', variant: 'default', className: '' };
    }
  };
  const badgeInfo = getBadgeInfo();

  return (
    <li className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border-b last:border-b-0 hover:bg-slate-50 transition-colors">
      <div className="mb-2 sm:mb-0">
        <span className="font-semibold text-gray-800 block">{aluno.aluno_nome}</span>
        <p className="text-sm text-gray-500 flex items-center gap-1">
             {aluno.turma_nome}
        </p>
      </div>
      <div className="flex w-full sm:w-auto justify-between items-center gap-4">
        <div className="flex gap-1" title="Últimas 3 chamadas">
            {ultimasPresencas.map((p, index) => (
              p.presente
                ? <CheckCircle2 key={index} className="h-4 w-4 text-emerald-500" />
                : <XCircle key={index} className="h-4 w-4 text-rose-500" />
            ))}
        </div>
        {/* @ts-ignore */}
        <Badge variant={badgeInfo.variant as any} className={badgeInfo.className}>
            {badgeInfo.text}
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
  const [riscoCurrentPage, setRiscoCurrentPage] = useState(1);
  const [consecutivasCurrentPage, setConsecutivasCurrentPage] = useState(1);
  const [kpisAdmin, setKpisAdmin] = useState<KpiAdminData | null>(null);
  const [faltasDiaSemana, setFaltasDiaSemana] = useState<FaltasDiaSemanaData[]>([]);
  const [ultimasObservacoes, setUltimasObservacoes] = useState<UltimaObservacaoData[]>([]);

  // Paginação
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
        const [
            kpiResult, turmaResult, riscoResult, consecutivasResult,
            kpiAdminResult, faltasDiaResult, obsResult
        ] = await Promise.all([
          supabase.rpc('get_escola_kpis').select().single(),
          supabase.rpc('get_comparativo_turmas'),
          supabase.rpc('get_alunos_em_risco_anual', { limite_faltas: 16 }),
          supabase.rpc('get_alunos_faltas_consecutivas', { dias_seguidos: 3 }),
          supabase.rpc('get_kpis_administrativos').select().single(),
          supabase.rpc('get_faltas_por_dia_semana'),
          supabase.rpc('get_ultimas_observacoes', {limite: 10}),
        ]);

        if (kpiResult.data) setKpis(kpiResult.data);
        if (turmaResult.data) setTurmaData(turmaResult.data);
        if (riscoResult.data) setAlunosRisco(riscoResult.data);
        if (consecutivasResult.data) setAlunosFaltasConsecutivas(consecutivasResult.data);
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
      <main className="flex-1 space-y-8 bg-gray-50/50 p-4 md:p-8 min-h-screen">
        <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Dashboard do Gestor</h1>
            <p className="text-gray-500">
                Visão estratégica e monitoramento em tempo real.
            </p>
        </div>
        
        {loading ? (
           <div className="space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
               {[1,2,3,4].map(i => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
             </div>
             <Skeleton className="h-[400px] w-full rounded-xl" />
           </div>
        ) : (
          <>
            {/* LINHA 1: KPIs */}
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <SummaryCard title="Presença Geral" value={`${kpis?.taxa_presenca_geral?.toFixed(1) ?? 'N/A'}%`} icon={TrendingUp} colorClass="bg-gradient-to-br from-blue-500 to-blue-600" loading={loading} />
                <SummaryCard title="Total de Alunos" value={kpis?.total_alunos ?? 'N/A'} icon={Users} colorClass="bg-gradient-to-br from-emerald-500 to-emerald-600" loading={loading} />
                <SummaryCard title="Atestados Pendentes" value={kpisAdmin?.atestados_pendentes ?? '0'} icon={FileText} colorClass="bg-gradient-to-br from-rose-500 to-rose-600" loading={loading} />
                <SummaryCard title="Justificativas" value={kpisAdmin?.justificativas_a_rever ?? '0'} icon={BookCopy} colorClass="bg-gradient-to-br from-amber-500 to-amber-600" loading={loading} />
            </section>
            
            {/* LINHA 2: Gráficos de Frequência */}
            <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <Card className="shadow-sm border-gray-200">
                <CardHeader>
                  <CardTitle className="text-lg text-gray-800">Frequência por Turma</CardTitle>
                  <CardDescription>Comparativo de presença entre classes.</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={turmaData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis dataKey="turma_nome" fontSize={12} tickLine={false} axisLine={false} tick={{fill: '#6B7280'}} />
                      <YAxis fontSize={12} tickLine={false} axisLine={false} tick={{fill: '#6B7280'}} unit="%" />
                      <Tooltip 
                        cursor={{fill: '#F3F4F6'}} 
                        contentStyle={{borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)"}}
                      />
                      <Bar dataKey="taxa_presenca" fill="#3B82F6" radius={[4, 4, 0, 0]} name="Presença" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="shadow-sm border-gray-200">
                <CardHeader>
                    <CardTitle className="text-lg text-gray-800">Ausências na Semana</CardTitle>
                    <CardDescription>Padrão de faltas por dia.</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={faltasDiaSemana} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis dataKey="dia_semana_nome" fontSize={12} tickLine={false} axisLine={false} tick={{fill: '#6B7280'}} />
                      <YAxis fontSize={12} tickLine={false} axisLine={false} tick={{fill: '#6B7280'}} unit="%" />
                      <Tooltip 
                        cursor={{fill: '#F3F4F6'}} 
                        contentStyle={{borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)"}}
                      />
                      <Bar dataKey="percentual_faltas" fill="#F59E0B" radius={[4, 4, 0, 0]} name="% Faltas" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </section>

            {/* LINHA 3: Desempenho Acadêmico (NOVO) */}
            <section className="grid grid-cols-1 gap-6">
                <div className="w-full">
                    <DesempenhoAcademicoChart />
                </div>
            </section>

            {/* LINHA 4: Listas e Radar */}
            <section className="grid grid-cols-1 gap-6 lg:grid-cols-3 items-start">
              {/* Coluna Esquerda: Listas de Risco */}
              <div className="lg:col-span-2 space-y-6">
                <Card className="shadow-sm border-gray-200">
                  <CardHeader className="bg-red-50/50 pb-4 border-b border-red-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2 text-red-700 text-lg">
                                <AlertTriangle className="h-5 w-5"/> Alunos em Situação Crítica
                            </CardTitle>
                            <CardDescription className="text-red-600/80 mt-1">
                                Acima de 16 faltas anuais.
                            </CardDescription>
                        </div>
                        <Badge variant="outline" className="bg-white text-red-700 border-red-200">
                            {alunosRisco.length} Alunos
                        </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ul className="divide-y divide-gray-100">
                        {paginatedAlunosRisco.length > 0 ? (
                            paginatedAlunosRisco.map((aluno) => (<AlunoListItem key={aluno.aluno_id} aluno={aluno} tipo="risco" />))
                        ) : (
                            <p className="p-8 text-center text-gray-500">Nenhum aluno em situação crítica.</p>
                        )}
                    </ul>
                    <div className="p-2 border-t bg-gray-50/50 rounded-b-xl">
                        <ControlledPagination totalItems={alunosRisco.length} itemsPerPage={ITEMS_PER_PAGE} currentPage={riscoCurrentPage} onPageChange={setRiscoCurrentPage}/>
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-sm border-gray-200">
                  <CardHeader className="bg-orange-50/50 pb-4 border-b border-orange-100">
                      <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2 text-orange-700 text-lg">
                                <AlertTriangle className="h-5 w-5"/> Faltas Consecutivas
                            </CardTitle>
                            <CardDescription className="text-orange-600/80 mt-1">
                                3 ou mais dias seguidos de ausência.
                            </CardDescription>
                        </div>
                        <Badge variant="outline" className="bg-white text-orange-700 border-orange-200">
                            {alunosFaltasConsecutivas.length} Alunos
                        </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ul className="divide-y divide-gray-100">
                        {paginatedAlunosConsecutivos.length > 0 ? (
                            paginatedAlunosConsecutivos.map((aluno) => (<AlunoListItem key={aluno.aluno_id} aluno={aluno} tipo="consecutivo" />))
                        ) : (
                            <p className="p-8 text-center text-gray-500">Nenhum aluno com faltas consecutivas recentes.</p>
                        )}
                    </ul>
                    <div className="p-2 border-t bg-gray-50/50 rounded-b-xl">
                        <ControlledPagination totalItems={alunosFaltasConsecutivas.length} itemsPerPage={ITEMS_PER_PAGE} currentPage={consecutivasCurrentPage} onPageChange={setConsecutivasCurrentPage}/>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Coluna Direita: Radar de Comportamento */}
              <div className="lg:col-span-1 h-full">
                <Card className="shadow-sm border-gray-200 h-full flex flex-col bg-white">
                  <CardHeader className="bg-sky-50/50 border-b border-sky-100 pb-4">
                    <CardTitle className="flex items-center gap-2 text-sky-700 text-lg">
                        <MessageSquareQuote className="h-5 w-5" /> Radar de Comportamento
                    </CardTitle>
                    <CardDescription className="text-sky-600/80 mt-1">
                        Feed de observações pedagógicas.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 p-0 overflow-hidden relative">
                    <ScrollArea className="h-[600px] w-full p-4">
                        <ul className="space-y-4">
                        {ultimasObservacoes.length > 0 ? ultimasObservacoes.map((obs, index) => (
                            <li key={index} className="flex flex-col bg-gray-50 p-4 rounded-lg border border-gray-100 hover:border-sky-200 transition-colors group">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="font-semibold text-gray-800 text-sm group-hover:text-sky-700 transition-colors">
                                        {obs.titulo}
                                    </span>
                                </div>
                                <p className="text-sm text-gray-600 italic mb-3 leading-relaxed">
                                    "{obs.descricao}"
                                </p>
                                <div className="flex items-center justify-between pt-2 border-t border-gray-200 mt-auto">
                                    <span className="text-xs font-medium text-gray-500 bg-white px-2 py-1 rounded border">
                                        {obs.aluno_nome}
                                    </span>
                                </div>
                            </li>
                        )) : (
                            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                                <MessageSquareQuote className="h-10 w-10 mb-2 opacity-20" />
                                <p className="text-sm">Nenhuma observação registrada.</p>
                            </div>
                        )}
                        </ul>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </section>
          </>
        )}
      </main>
    </Sidebar>
  );
}