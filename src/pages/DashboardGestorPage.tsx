import { useEffect, useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ControlledPagination } from '@/components/ui/controlled-pagination';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  CheckCircle2, XCircle, AlertTriangle, FileText, BookCopy,
  MessageSquareQuote, TrendingUp, Users, Filter, Check,
  ChevronsUpDown, Calendar, Loader2, RefreshCw
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from "@/components/ui/scroll-area";
import { DesempenhoAcademicoChart } from "@/components/dashboard/DesempenhoAcademicoChart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useDashboardGestor } from '@/hooks';
import {
  gestorService,
  type KpiData,
  type KpiAdminData,
  type TurmaComparisonData,
  type AlunoRiscoData,
  type AlunoFaltasConsecutivasData,
  type UltimaObservacaoData,
  type TurmaMetadata,
  type PresencaRecente,
  type UltimaPresenca
} from '@/domains';

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
        const data = await gestorService.getUltimasPresencasAluno(aluno.aluno_id);
        if (!isMounted) return;
        setUltimasPresencas(data);
      } catch (err) { }
    }
    if (aluno.aluno_id) fetchPresencas();
    return () => { isMounted = false; };
  }, [aluno.aluno_id]);

  const getBadgeInfo = () => {
    switch (tipo) {
      case 'risco':
        return { text: `${(aluno as AlunoRiscoData).total_faltas} Faltas`, className: 'bg-red-100 text-red-700 hover:bg-red-200 border-red-200' };
      case 'consecutivo':
        return { text: `${(aluno as AlunoFaltasConsecutivasData).contagem_faltas_consecutivas} Seguidas`, className: 'bg-orange-100 text-orange-700 hover:bg-orange-200 border-orange-200' };
      default:
        return { text: '', className: '' };
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
        <Badge variant="outline" className={badgeInfo.className}>{badgeInfo.text}</Badge>
      </div>
    </li>
  );
}

// --- PÁGINA PRINCIPAL ---
import { useEscolaConfig } from "@/contexts/EscolaConfigContext";

export default function DashboardGestorPage() {
  const { config } = useEscolaConfig();
  const corPrimaria = config?.cor_primaria || "#3B82F6"; // Azul padrão se falhar
  const corSecundaria = config?.cor_secundaria || "#F59E0B";

  // --- USANDO CUSTOM HOOK ---
  const {
    kpis,
    kpisAdmin,
    ultimasObservacoes,
    filteredTurmaData,
    filteredAlunosRisco,
    filteredAlunosConsecutivos,
    chartAusenciasSemana,
    paginatedRisco,
    paginatedConsecutivos,
    riscoCurrentPage,
    setRiscoCurrentPage,
    consecutivasCurrentPage,
    setConsecutivasCurrentPage,
    turmasDisponiveis,
    filtroTurno,
    setFiltroTurno,
    turmasSelecionadas,
    setTurmasSelecionadas,
    filtroAno,
    setFiltroAno,
    activeTurmaIds,
    loading,
    statusMsg,
    refresh
  } = useDashboardGestor();

  // Toggle turma selection helper
  const toggleTurma = (turmaId: string) => {
    const newSelection = turmasSelecionadas.includes(turmaId)
      ? turmasSelecionadas.filter(id => id !== turmaId)
      : [...turmasSelecionadas, turmaId];
    setTurmasSelecionadas(newSelection);
  };

  const formatPercent = (num?: number | null) => {
    if (typeof num !== 'number') return '0%';
    return `${num.toFixed(1)}%`;
  };

  const formatNumber = (num?: number | null) => {
    if (typeof num !== 'number') return '0';
    return num.toString();
  };

  // --- RENDERIZAÇÃO ---
  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-gray-50/50">
        <Loader2 className="h-10 w-10 animate-spin" style={{ color: corPrimaria }} />
        <p className="text-gray-500 font-medium animate-pulse">{statusMsg}</p>
        <Button variant="link" onClick={() => window.location.reload()} className="text-xs text-gray-400 mt-4">
          Demorando muito? Recarregar
        </Button>
      </div>
    );
  }

  return (
    <main className="flex-1 space-y-6 bg-gray-50/50 p-4 md:p-8 min-h-screen animate-in fade-in duration-500">

      {/* HEADER E FILTROS */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Dashboard de Gestão</h1>
          <p className="text-gray-500 text-sm">Visão analítica em tempo real da escola.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={refresh} title="Atualizar dados">
            <RefreshCw className="h-4 w-4" />
          </Button>

          <div className="w-32">
            <Select value={filtroAno} onValueChange={setFiltroAno}>
              <SelectTrigger className="bg-white"><Calendar className="w-4 h-4 mr-2 text-gray-500" /> <SelectValue placeholder="Ano" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="2024">2024</SelectItem>
                <SelectItem value="2025">2025</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="w-40">
            <Select value={filtroTurno} onValueChange={setFiltroTurno}>
              <SelectTrigger className="bg-white"><Filter className="w-4 h-4 mr-2 text-gray-500" /> <SelectValue placeholder="Turno" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
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
                        onSelect={() => toggleTurma(turma.id)}
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
            <Button variant="ghost" onClick={() => { setTurmasSelecionadas([]); setFiltroTurno('todos'); }} className="text-red-500 hover:bg-red-50">Limpar Filtros</Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard title="Presença Geral" value={kpis ? formatPercent(kpis.taxa_presenca_geral) : '0%'} icon={TrendingUp} colorClass="bg-gradient-to-br from-blue-500 to-blue-600" loading={loading} />
        <SummaryCard title="Total de Alunos" value={kpis ? formatNumber(kpis.total_alunos) : '0'} icon={Users} colorClass="bg-gradient-to-br from-emerald-500 to-emerald-600" loading={loading} />
        <SummaryCard title="Atestados Pendentes" value={kpisAdmin ? formatNumber(kpisAdmin.atestados_pendentes) : '0'} icon={FileText} colorClass="bg-gradient-to-br from-rose-500 to-rose-600" loading={loading} />
        <SummaryCard title="Justificativas" value={kpisAdmin ? formatNumber(kpisAdmin.justificativas_a_rever) : '0'} icon={BookCopy} colorClass="bg-gradient-to-br from-amber-500 to-amber-600" loading={loading} />
      </section>

      {/* GRÁFICOS */}
      <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card className="shadow-sm border-gray-200">
          <CardHeader>
            <CardTitle className="text-lg text-gray-800">Frequência por Turma</CardTitle>
            <CardDescription>Comparativo filtrado.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {filteredTurmaData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={filteredTurmaData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="turma_nome" fontSize={11} tickLine={false} axisLine={false} tickMargin={10} minTickGap={5} />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} unit="%" width={35} />
                  <Tooltip
                    cursor={{ fill: '#F3F4F6' }}
                    contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" }}
                    labelStyle={{ color: "#374151", fontWeight: 600, marginBottom: "5px" }}
                  />
                  <Bar dataKey="taxa_presenca" fill={corPrimaria} radius={[6, 6, 0, 0]} name="Presença" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-gray-400">Sem dados para exibir</div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-gray-200">
          <CardHeader>
            <CardTitle className="text-lg text-gray-800">Ausências na Semana</CardTitle>
            <CardDescription>Últimos 15 dias.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartAusenciasSemana} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="dia_semana_nome" fontSize={11} tickLine={false} axisLine={false} tickMargin={10} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} unit="%" width={35} />
                <Tooltip
                  cursor={{ fill: '#F3F4F6' }}
                  contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" }}
                  labelStyle={{ color: "#374151", fontWeight: 600, marginBottom: "5px" }}
                />
                <Bar dataKey="percentual_faltas" fill={corSecundaria} radius={[6, 6, 0, 0]} name="% Faltas" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </section>

      {/* Desempenho Acadêmico */}
      <section className="grid grid-cols-1 gap-6">
        <div className="w-full">
          <DesempenhoAcademicoChart turmasIds={activeTurmaIds} />
        </div>
      </section>

      {/* LISTAS E TABELAS */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3 items-start">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="bg-red-50/50 pb-4 border-b border-red-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-700" />
                  <CardTitle className="text-red-700 text-lg">Alunos em Risco</CardTitle>
                </div>
                <Badge variant="outline" className="bg-white text-red-700 border-red-200">{filteredAlunosRisco.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filteredAlunosRisco.length > 0 ? (
                <ul className="divide-y divide-gray-100">
                  {paginatedRisco.map((aluno) => (<AlunoListItem key={aluno.aluno_id} aluno={aluno} tipo="risco" />))}
                </ul>
              ) : <div className="p-4 text-center text-gray-500">Nenhum aluno em risco crítico.</div>}

              <div className="p-2 border-t bg-gray-50/50 rounded-b-xl">
                <ControlledPagination totalItems={filteredAlunosRisco.length} itemsPerPage={ITEMS_PER_PAGE} currentPage={riscoCurrentPage} onPageChange={setRiscoCurrentPage} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="bg-orange-50/50 pb-4 border-b border-orange-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-700" />
                  <CardTitle className="text-orange-700 text-lg">Faltas Consecutivas</CardTitle>
                </div>
                <Badge variant="outline" className="bg-white text-orange-700 border-orange-200">{filteredAlunosConsecutivos.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filteredAlunosConsecutivos.length > 0 ? (
                <ul className="divide-y divide-gray-100">
                  {paginatedConsecutivos.map((aluno) => (<AlunoListItem key={aluno.aluno_id} aluno={aluno} tipo="consecutivo" />))}
                </ul>
              ) : <div className="p-4 text-center text-gray-500">Nenhum alerta de faltas consecutivas.</div>}
              <div className="p-2 border-t bg-gray-50/50 rounded-b-xl">
                <ControlledPagination totalItems={filteredAlunosConsecutivos.length} itemsPerPage={ITEMS_PER_PAGE} currentPage={consecutivasCurrentPage} onPageChange={setConsecutivasCurrentPage} />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1 h-full">
          <Card className="h-full flex flex-col">
            <CardHeader className="bg-sky-50/50 border-b border-sky-100 pb-4">
              <CardTitle className="flex items-center gap-2 text-sky-700 text-lg">
                <MessageSquareQuote className="h-5 w-5" /> Radar Pedagógico
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-0 overflow-hidden relative">
              <ScrollArea className="h-[600px] w-full p-4">
                <ul className="space-y-4">
                  {ultimasObservacoes.length > 0 ? ultimasObservacoes.map((obs, index) => (
                    <li key={index} className="flex flex-col bg-gray-50 p-4 rounded-lg border border-gray-100">
                      <span className="font-semibold text-gray-800 text-sm mb-2">{obs.titulo}</span>
                      <p className="text-sm text-gray-600 italic mb-3">"{obs.descricao}"</p>
                      <span className="text-xs font-medium text-gray-500 bg-white px-2 py-1 rounded border w-fit">{obs.aluno_nome}</span>
                    </li>
                  )) : <div className="text-center text-gray-400 mt-10">Nenhuma observação recente.</div>}
                </ul>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}