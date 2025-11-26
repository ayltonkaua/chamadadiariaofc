import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Sidebar from '@/components/layout/Sidebar';
import { Badge } from '@/components/ui/badge';
import { ControlledPagination } from '@/components/ui/controlled-pagination';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { 
    CheckCircle2, 
    XCircle, 
    AlertTriangle, 
    FileText, 
    BookCopy, 
    MessageSquareQuote,
    TrendingUp,   
    Users,
    Filter,
    Check,
    ChevronsUpDown,
    Calendar
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from "@/components/ui/scroll-area";
import { DesempenhoAcademicoChart } from "@/components/dashboard/DesempenhoAcademicoChart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { subDays, format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext'; 

// --- Tipagens ---
interface KpiAdminData { atestados_pendentes: number; justificativas_a_rever: number; }
interface UltimaObservacaoData { aluno_nome: string; aluno_matricula?: string; titulo: string; descricao: string; created_at?: string; }
interface KpiData { taxa_presenca_geral: number; total_alunos: number; }
interface TurmaComparisonData { turma_nome: string; taxa_presenca: number; turma_id?: string; }
interface AlunoRiscoData { aluno_id: string; aluno_nome: string; turma_nome: string; total_faltas: number; }
interface AlunoFaltasConsecutivasData { aluno_id: string; aluno_nome: string; turma_nome: string; ultima_falta?: string; contagem_faltas_consecutivas: number; }
interface UltimaPresenca { data_chamada: string; presente: boolean; }
interface TurmaMetadata { id: string; nome: string; turno: string | null; }

const ITEMS_PER_PAGE = 5;

// --- Subcomponentes ---
const SummaryCard = ({ title, value, icon: Icon, colorClass, loading }: { title: string; value: string | number; icon: React.ElementType; colorClass: string; loading: boolean; }) => {
  if (loading) return <Skeleton className="h-28 w-full rounded-xl" />;
  return (
    <Card className={`text-white relative overflow-hidden ${colorClass} shadow-md border-0`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium opacity-90">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">
          {typeof value === 'number' ? value : value}
        </div>
        <Icon className="absolute -right-4 -bottom-4 h-24 w-24 text-white/10" />
      </CardContent>
    </Card>
  );
};

function AlunoListItem({ aluno, tipo }: { aluno: AlunoRiscoData | AlunoFaltasConsecutivasData; tipo: 'risco' | 'consecutivo' }) {
  const [ultimasPresencas, setUltimasPresencas] = useState<UltimaPresenca[]>([]);

  useEffect(() => {
    let isMounted = true;
    async function fetchPresencas() {
      try {
        // @ts-ignore - rpc params named conforme seu banco, adapte se necessário
        const resp = await supabase.rpc('get_ultimas_presencas_aluno', { p_aluno_id: aluno.aluno_id });
        if (!isMounted) return;
        if ((resp as any).error) {
          // console.warn('rpc error', (resp as any).error);
          return;
        }
        const data = (resp as any).data ?? [];
        setUltimasPresencas(data.slice(0, 3));
      } catch (err) {
        // console.error(err);
      }
    }
    // @ts-ignore
    if (aluno.aluno_id) fetchPresencas();
    return () => { isMounted = false; };
  }, [aluno.aluno_id]);

  const getBadgeInfo = () => {
    switch (tipo) {
      case 'risco':
        // @ts-ignore
        return { text: `${(aluno as AlunoRiscoData).total_faltas} Faltas`, variant: 'destructive', className: 'bg-red-100 text-red-700 hover:bg-red-200 border-red-200' };
      case 'consecutivo':
        // @ts-ignore
        return { text: `${(aluno as AlunoFaltasConsecutivasData).contagem_faltas_consecutivas} Seguidas`, variant: 'secondary', className: 'bg-orange-100 text-orange-700 hover:bg-orange-200 border-orange-200' };
      default:
        return { text: '', variant: 'default', className: '' };
    }
  };
  const badgeInfo = getBadgeInfo();

  return (
    <li className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border-b last:border-b-0 hover:bg-slate-50 transition-colors">
      <div className="mb-2 sm:mb-0">
        <span className="font-semibold text-gray-800 block">{aluno.aluno_nome}</span>
        <p className="text-sm text-gray-500 flex items-center gap-1">{aluno.turma_nome}</p>
      </div>
      <div className="flex w-full sm:w-auto justify-between items-center gap-4">
        <div className="flex gap-1">
            {ultimasPresencas.map((p, index) => (
              p.presente
                ? <CheckCircle2 key={index} className="h-4 w-4 text-emerald-500" />
                : <XCircle key={index} className="h-4 w-4 text-rose-500" />
            ))}
        </div>
        {/* @ts-ignore */}
        <Badge variant={badgeInfo.variant as any} className={badgeInfo.className}>{badgeInfo.text}</Badge>
      </div>
    </li>
  );
}

export default function DashboardGestorPage() {
  const { user } = useAuth();
  
  // --- ESTADOS ---
  const [kpis, setKpis] = useState<KpiData | null>(null);
  const [kpisAdmin, setKpisAdmin] = useState<KpiAdminData | null>(null);
  
  // Dados Brutos
  const [rawTurmaData, setRawTurmaData] = useState<TurmaComparisonData[]>([]);
  const [rawAlunosRisco, setRawAlunosRisco] = useState<AlunoRiscoData[]>([]);
  const [rawAlunosConsecutivos, setRawAlunosConsecutivos] = useState<AlunoFaltasConsecutivasData[]>([]);
  const [rawPresencasRecentes, setRawPresencasRecentes] = useState<any[]>([]); // Para cálculo dinâmico
  const [ultimasObservacoes, setUltimasObservacoes] = useState<UltimaObservacaoData[]>([]);
  
  // Loaders
  const [loadingKpis, setLoadingKpis] = useState(true);
  const [loadingCharts, setLoadingCharts] = useState(true);
  const [loadingLists, setLoadingLists] = useState(true);

  // Filtros
  const [turmasDisponiveis, setTurmasDisponiveis] = useState<TurmaMetadata[]>([]);
  const [filtroTurno, setFiltroTurno] = useState<string>("todos");
  const [turmasSelecionadas, setTurmasSelecionadas] = useState<string[]>([]);
  const [filtroAno, setFiltroAno] = useState<string>(new Date().getFullYear().toString());

  // Paginação
  const [riscoCurrentPage, setRiscoCurrentPage] = useState(1);
  const [consecutivasCurrentPage, setConsecutivasCurrentPage] = useState(1);

  // --- 1. FETCH METADADOS ---
  useEffect(() => {
    async function fetchTurmas() {
      if (!user?.escola_id) {
        setTurmasDisponiveis([]);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('turmas')
          .select('id, nome, turno')
          .eq('escola_id', user.escola_id)
          .order('nome', { ascending: true });
        if (error) {
          // console.warn('fetchTurmas error', error);
          setTurmasDisponiveis([]);
          return;
        }
        setTurmasDisponiveis(data ?? []);
      } catch (err) {
        // console.error(err);
        setTurmasDisponiveis([]);
      }
    }
    fetchTurmas();
  }, [user?.escola_id]);

  // --- 2. FETCH DADOS (Progressivo) ---
  useEffect(() => {
    if (!user?.escola_id) {
        // Sem escola: limpa estados e desativa loaders
        setKpis(null);
        setKpisAdmin(null);
        setRawTurmaData([]);
        setRawAlunosRisco([]);
        setRawAlunosConsecutivos([]);
        setRawPresencasRecentes([]);
        setUltimasObservacoes([]);
        setLoadingKpis(false); 
        setLoadingCharts(false);
        setLoadingLists(false);
        return;
    }

    const escolaId = user.escola_id;

    async function fetchKpis() {
        setLoadingKpis(true);
        try {
            // RPCs: supabase.rpc retorna { data, error }
            const kpiResp = await supabase.rpc('get_escola_kpis', { _escola_id: escolaId });
            const kpiAdminResp = await supabase.rpc('get_kpis_administrativos', { _escola_id: escolaId });

            if ((kpiResp as any).error) {
              // console.warn('get_escola_kpis error', (kpiResp as any).error);
              setKpis(null);
            } else {
              setKpis((kpiResp as any).data ?? null);
            }

            if ((kpiAdminResp as any).error) {
              // console.warn('get_kpis_administrativos error', (kpiAdminResp as any).error);
              setKpisAdmin(null);
            } else {
              setKpisAdmin((kpiAdminResp as any).data ?? null);
            }
        } catch (err) {
            // console.error(err);
            setKpis(null);
            setKpisAdmin(null);
        } finally {
            setLoadingKpis(false);
        }
    }

    async function fetchCharts() {
        setLoadingCharts(true);
        try {
            // Buscando comparativo de turmas via RPC (passando escola)
            const turmaResp = await supabase.rpc('get_comparativo_turmas', { _escola_id: escolaId });
            if ((turmaResp as any).error) {
              // console.warn('get_comparativo_turmas error', (turmaResp as any).error);
              setRawTurmaData([]);
            } else {
              setRawTurmaData((turmaResp as any).data ?? []);
            }

            // Presenças recentes (últimos 15 dias) filtrando por escola
            const dataLimite = subDays(new Date(), 15).toISOString();
            const { data: presencasRes, error: presError } = await supabase
                .from('presencas')
                .select('data_chamada, presente, turma_id, escola_id')
                .eq('escola_id', escolaId) 
                .gte('data_chamada', dataLimite);

            if (presError) {
              // console.warn('presencas error', presError);
              setRawPresencasRecentes([]);
            } else {
              setRawPresencasRecentes(presencasRes ?? []);
            }

        } catch (err) {
            // console.error(err);
            setRawTurmaData([]);
            setRawPresencasRecentes([]);
        } finally {
            setLoadingCharts(false);
        }
    }

    async function fetchLists() {
        setLoadingLists(true);
        try {
            const riscoResp = await supabase.rpc('get_alunos_em_risco_anual', { limite_faltas: 16, _escola_id: escolaId });
            const consecResp = await supabase.rpc('get_alunos_faltas_consecutivas', { dias_seguidos: 3, _escola_id: escolaId });
            const obsResp = await supabase.rpc('get_ultimas_observacoes', { limite: 10, _escola_id: escolaId });

            if ((riscoResp as any).error) {
              // console.warn('risco rpc error', (riscoResp as any).error);
              setRawAlunosRisco([]);
            } else {
              setRawAlunosRisco((riscoResp as any).data ?? []);
            }

            if ((consecResp as any).error) {
              // console.warn('consec rpc error', (consecResp as any).error);
              setRawAlunosConsecutivos([]);
            } else {
              setRawAlunosConsecutivos((consecResp as any).data ?? []);
            }

            if ((obsResp as any).error) {
              // console.warn('obs rpc error', (obsResp as any).error);
              setUltimasObservacoes([]);
            } else {
              setUltimasObservacoes((obsResp as any).data ?? []);
            }
        } catch (err) {
            // console.error(err);
            setRawAlunosRisco([]);
            setRawAlunosConsecutivos([]);
            setUltimasObservacoes([]);
        } finally {
            setLoadingLists(false);
        }
    }

    fetchKpis();
    fetchCharts();
    fetchLists();
  }, [filtroAno, user?.escola_id]);

  // --- 3. LÓGICA DE FILTRAGEM (Mantida) ---
  
  const activeTurmas = useMemo(() => {
    let filtered = turmasDisponiveis;
    if (filtroTurno !== "todos") {
        filtered = filtered.filter(t => t.turno === filtroTurno);
    }
    if (turmasSelecionadas.length > 0) {
        filtered = filtered.filter(t => turmasSelecionadas.includes(t.id));
    }
    return filtered;
  }, [turmasDisponiveis, filtroTurno, turmasSelecionadas]);

  const activeTurmaIds = useMemo(() => activeTurmas.map(t => t.id), [activeTurmas]);
  const activeTurmaNomes = useMemo(() => activeTurmas.map(t => t.nome), [activeTurmas]);

  const filteredTurmaData = useMemo(() => {
    if (!rawTurmaData || rawTurmaData.length === 0) return [];
    // Se o RPC já retorna somente turmas da escola, apenas filtramos por selecionadas
    if (activeTurmaNomes.length === 0) return rawTurmaData;
    return rawTurmaData.filter(item => activeTurmaNomes.includes(item.turma_nome));
  }, [rawTurmaData, activeTurmaNomes]);

  const chartAusenciasSemana = useMemo(() => {
    // Queremos garantir todos os dias da semana, mesmo que sem dados
    const presencasFiltradas = rawPresencasRecentes.filter(p => {
      // quando não houver filtro de turma, traz tudo da escola
      if (!activeTurmaIds || activeTurmaIds.length === 0) return true;
      return activeTurmaIds.includes(p.turma_id);
    });

    const diasMap = new Map<string, { total: number; faltas: number }>();
    // inicializa com todos os dias (abreviação em ptBR)
    const ordemDias = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
    ordemDias.forEach(d => diasMap.set(d, { total: 0, faltas: 0 }));

    presencasFiltradas.forEach(p => {
        try {
          const data = typeof p.data_chamada === 'string' ? parseISO(p.data_chamada) : new Date(p.data_chamada);
          const diaNome = format(data, 'EEE', { locale: ptBR }).replace('.', ''); // Ex: 'seg.'
          const diaCapitalized = diaNome.charAt(0).toUpperCase() + diaNome.slice(1);
          const chave = diaCapitalized.substring(0,3); // 'Seg'...
          if (!diasMap.has(chave)) diasMap.set(chave, { total: 0, faltas: 0 });
          const entry = diasMap.get(chave)!;
          entry.total++;
          if (!p.presente) entry.faltas++;
        } catch (err) {
          // skip parse errors
        }
    });

    const result = ordemDias.map(chave => {
      const dados = diasMap.get(chave) ?? { total: 0, faltas: 0 };
      return {
        dia_semana_nome: chave,
        percentual_faltas: dados.total > 0 ? parseFloat(((dados.faltas / dados.total) * 100).toFixed(1)) : 0
      };
    });

    return result;
  }, [rawPresencasRecentes, activeTurmaIds]);

  const filteredAlunosRisco = useMemo(() => {
    if (!rawAlunosRisco) return [];
    if (activeTurmaNomes.length === 0) return rawAlunosRisco;
    return rawAlunosRisco.filter(item => activeTurmaNomes.includes(item.turma_nome));
  }, [rawAlunosRisco, activeTurmaNomes]);

  const filteredAlunosConsecutivos = useMemo(() => {
    if (!rawAlunosConsecutivos) return [];
    if (activeTurmaNomes.length === 0) return rawAlunosConsecutivos;
    return rawAlunosConsecutivos.filter(item => activeTurmaNomes.includes(item.turma_nome));
  }, [rawAlunosConsecutivos, activeTurmaNomes]);

  // Paginação das listas filtradas
  const paginatedRisco = useMemo(() => {
    const start = (riscoCurrentPage - 1) * ITEMS_PER_PAGE;
    return filteredAlunosRisco.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredAlunosRisco, riscoCurrentPage]);

  const paginatedConsecutivos = useMemo(() => {
    const start = (consecutivasCurrentPage - 1) * ITEMS_PER_PAGE;
    return filteredAlunosConsecutivos.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredAlunosConsecutivos, consecutivasCurrentPage]);

  // Util helpers para exibição segura de números
  const formatPercent = (num?: number | null) => {
    if (typeof num !== 'number') return '0%';
    return `${num.toFixed(1)}%`;
  };

  const formatNumber = (num?: number | null) => {
    if (typeof num !== 'number') return '0';
    return num.toString();
  };

  return (
    <Sidebar>
      <main className="flex-1 space-y-6 bg-gray-50/50 p-4 md:p-8 min-h-screen">
        
        {/* HEADER E FILTROS */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-gray-900">Dashboard</h1>
                <p className="text-gray-500 text-sm">Monitoramento em tempo real.</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <div className="w-32">
                    <Select value={filtroAno} onValueChange={setFiltroAno}>
                        <SelectTrigger className="bg-white"><Calendar className="w-4 h-4 mr-2 text-gray-500"/> <SelectValue placeholder="Ano" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="2024">2024</SelectItem>
                            <SelectItem value="2025">2025</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="w-40">
                    <Select value={filtroTurno} onValueChange={setFiltroTurno}>
                        <SelectTrigger className="bg-white"><Filter className="w-4 h-4 mr-2 text-gray-500"/> <SelectValue placeholder="Turno" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todos">Todos os Turnos</SelectItem>
                            <SelectItem value="Manhã">Manhã</SelectItem>
                            <SelectItem value="Tarde">Tarde</SelectItem>
                            <SelectItem value="Noite">Noite</SelectItem>
                            <SelectItem value="Integral">Integral</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" className="justify-between bg-white w-[200px]">
                            {turmasSelecionadas.length > 0 ? `${turmasSelecionadas.length} turma(s)` : "Todas as turmas"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[200px] p-0">
                        <Command>
                            <CommandInput placeholder="Buscar turma..." />
                            <CommandList>
                                <CommandEmpty>Nenhuma turma.</CommandEmpty>
                                <CommandGroup>
                                    {turmasDisponiveis.map((turma) => (
                                        <CommandItem
                                            key={turma.id}
                                            value={turma.nome}
                                            onSelect={() => {
                                                setTurmasSelecionadas(prev => prev.includes(turma.id) ? prev.filter(id => id !== turma.id) : [...prev, turma.id])
                                            }}
                                        >
                                            <Check className={cn("mr-2 h-4 w-4", turmasSelecionadas.includes(turma.id) ? "opacity-100" : "opacity-0")} />
                                            {turma.nome}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
                
                {(turmasSelecionadas.length > 0 || filtroTurno !== 'todos') && (
                    <Button variant="ghost" onClick={() => { setTurmasSelecionadas([]); setFiltroTurno('todos'); }} className="text-red-500">Limpar</Button>
                )}
            </div>
        </div>
        
        {/* KPI Cards */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard title="Presença Geral" value={kpis ? formatPercent(kpis.taxa_presenca_geral) : '0%'} icon={TrendingUp} colorClass="bg-gradient-to-br from-blue-500 to-blue-600" loading={loadingKpis} />
            <SummaryCard title="Total de Alunos" value={kpis ? formatNumber(kpis.total_alunos) : '0'} icon={Users} colorClass="bg-gradient-to-br from-emerald-500 to-emerald-600" loading={loadingKpis} />
            <SummaryCard title="Atestados Pendentes" value={kpisAdmin ? formatNumber(kpisAdmin.atestados_pendentes) : '0'} icon={FileText} colorClass="bg-gradient-to-br from-rose-500 to-rose-600" loading={loadingKpis} />
            <SummaryCard title="Justificativas" value={kpisAdmin ? formatNumber(kpisAdmin.justificativas_a_rever) : '0'} icon={BookCopy} colorClass="bg-gradient-to-br from-amber-500 to-amber-600" loading={loadingKpis} />
        </section>
        
        {/* GRÁFICOS 1 e 2 (Filtram dinamicamente) */}
        {loadingCharts ? (
             <Skeleton className="h-[350px] w-full rounded-xl" />
        ) : (
            <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <Card className="shadow-sm border-gray-200">
                <CardHeader>
                  <CardTitle className="text-lg text-gray-800">Frequência por Turma</CardTitle>
                  <CardDescription>Comparativo filtrado.</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={filteredTurmaData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis dataKey="turma_nome" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis fontSize={12} tickLine={false} axisLine={false} unit="%" />
                      <Tooltip cursor={{fill: '#F3F4F6'}} contentStyle={{borderRadius: "8px"}} />
                      <Bar dataKey="taxa_presenca" fill="#3B82F6" radius={[4, 4, 0, 0]} name="Presença" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="shadow-sm border-gray-200">
                <CardHeader>
                    <CardTitle className="text-lg text-gray-800">Ausências na Semana</CardTitle>
                    <CardDescription>Padrão calculado dinamicamente (Últimos 15 dias).</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartAusenciasSemana} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis dataKey="dia_semana_nome" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis fontSize={12} tickLine={false} axisLine={false} unit="%" />
                      <Tooltip cursor={{fill: '#F3F4F6'}} contentStyle={{borderRadius: "8px"}} />
                      <Bar dataKey="percentual_faltas" fill="#F59E0B" radius={[4, 4, 0, 0]} name="% Faltas" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </section>
        )}

        {/* GRÁFICO 3: Desempenho Acadêmico (Recebe IDs para filtrar dentro do componente) */}
        <section className="grid grid-cols-1 gap-6">
            <div className="w-full">
                <DesempenhoAcademicoChart turmasIds={activeTurmaIds} />
            </div>
        </section>

        {/* LINHA 4: Listas (Filtradas) */}
        {loadingLists ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Skeleton className="h-[400px] col-span-2 rounded-xl" />
                <Skeleton className="h-[400px] col-span-1 rounded-xl" />
            </div>
        ) : (
            <section className="grid grid-cols-1 gap-6 lg:grid-cols-3 items-start">
              <div className="lg:col-span-2 space-y-6">
                <Card>
                  <CardHeader className="bg-red-50/50 pb-4 border-b border-red-100">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-red-700"/> 
                            <CardTitle className="text-red-700 text-lg">Alunos em Risco</CardTitle>
                        </div>
                        <Badge variant="outline" className="bg-white text-red-700 border-red-200">{filteredAlunosRisco.length}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ul className="divide-y divide-gray-100">
                        {paginatedRisco.map((aluno) => (<AlunoListItem key={aluno.aluno_id} aluno={aluno} tipo="risco" />))}
                    </ul>
                    <div className="p-2 border-t bg-gray-50/50 rounded-b-xl">
                        <ControlledPagination totalItems={filteredAlunosRisco.length} itemsPerPage={ITEMS_PER_PAGE} currentPage={riscoCurrentPage} onPageChange={setRiscoCurrentPage}/>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="bg-orange-50/50 pb-4 border-b border-orange-100">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-orange-700"/> 
                            <CardTitle className="text-orange-700 text-lg">Faltas Consecutivas</CardTitle>
                        </div>
                        <Badge variant="outline" className="bg-white text-orange-700 border-orange-200">{filteredAlunosConsecutivos.length}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ul className="divide-y divide-gray-100">
                        {paginatedConsecutivos.map((aluno) => (<AlunoListItem key={aluno.aluno_id} aluno={aluno} tipo="consecutivo" />))}
                    </ul>
                    <div className="p-2 border-t bg-gray-50/50 rounded-b-xl">
                        <ControlledPagination totalItems={filteredAlunosConsecutivos.length} itemsPerPage={ITEMS_PER_PAGE} currentPage={consecutivasCurrentPage} onPageChange={setConsecutivasCurrentPage}/>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="lg:col-span-1 h-full">
                <Card className="h-full flex flex-col">
                  <CardHeader className="bg-sky-50/50 border-b border-sky-100 pb-4">
                    <CardTitle className="flex items-center gap-2 text-sky-700 text-lg">
                        <MessageSquareQuote className="h-5 w-5" /> Radar
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 p-0 overflow-hidden relative">
                    <ScrollArea className="h-[600px] w-full p-4">
                        <ul className="space-y-4">
                        {ultimasObservacoes.map((obs, index) => (
                            <li key={index} className="flex flex-col bg-gray-50 p-4 rounded-lg border border-gray-100">
                                <span className="font-semibold text-gray-800 text-sm mb-2">{obs.titulo}</span>
                                <p className="text-sm text-gray-600 italic mb-3">"{obs.descricao}"</p>
                                <span className="text-xs font-medium text-gray-500 bg-white px-2 py-1 rounded border w-fit">{obs.aluno_nome}</span>
                            </li>
                        ))}
                        </ul>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </section>
        )}
      </main>
    </Sidebar>
  );
}