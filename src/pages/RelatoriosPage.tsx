import { useState, useEffect } from "react";
import { addDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import {
  Users,
  AlertTriangle,
  Grid,
  FileText,
  Calendar as CalendarIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { gestorService } from "@/domains";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// Importe seus componentes de relatório
import { AlunosFaltososReport } from "@/components/relatorios/AlunosFaltososReport";
import { TaxaPresencaTurmaReport } from "@/components/relatorios/TaxaPresencaTurmaReport";
import { RelatorioAtestados } from "@/components/relatorios/RelatorioAtestados";
import { RelatorioAtestadosPendentes } from "@/components/relatorios/RelatorioAtestadosPendentes";

// Componente para o seletor de período
function DateRangePicker({
  date,
  setDate,
}: {
  date: DateRange | undefined;
  setDate: (date: DateRange | undefined) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id="date"
          variant={"outline"}
          className={cn(
            "w-full sm:w-[280px] justify-start text-left font-normal bg-card",
            !date && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date?.from ? (
            date.to ? (
              <>
                {format(date.from, "dd 'de' LLL, y", { locale: ptBR })} -{' '}
                {format(date.to, "dd 'de' LLL, y", { locale: ptBR })}
              </>
            ) : (
              format(date.from, "dd 'de' LLL, y", { locale: ptBR })
            )
          ) : (
            <span>Selecione um período</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <Calendar
          initialFocus
          mode="range"
          defaultMonth={date?.from}
          selected={date}
          onSelect={setDate}
          numberOfMonths={2}
          locale={ptBR}
        />
      </PopoverContent>
    </Popover>
  );
}

// Componente para os Cards de Resumo coloridos
const SummaryCard = ({
  title,
  value,
  icon: Icon,
  colorClass,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  colorClass: string;
}) => {
  return (
    <Card className={cn("text-white relative overflow-hidden", colorClass)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <Icon className="absolute -right-2 -bottom-2 h-16 w-16 text-white/20" />
      </CardContent>
    </Card>
  );
};

// Página de Relatórios
export default function RelatoriosPage() {
  const [date, setDate] = useState<DateRange | undefined>({
    from: addDays(new Date(), -30),
    to: new Date(),
  });

  const [summaryData, setSummaryData] = useState({
    alunosMatriculados: 0,
    faltososHoje: 0,
    turmasCadastradas: 0,
    atestadosPendentes: 0
  });

  const { user } = useAuth();

  useEffect(() => {
    async function fetchDashboardStats() {
      if (!user?.escola_id) return;

      try {
        // Usa gestorService em vez de supabase.rpc direto
        const kpis = await gestorService.getKpis(user.escola_id);
        const kpisAdmin = await gestorService.getKpisAdmin(user.escola_id);

        if (kpis && kpisAdmin) {
          setSummaryData({
            alunosMatriculados: kpis.total_alunos || 0,
            faltososHoje: 0, // Não temos este dado no KPI atual
            turmasCadastradas: 0, // Não temos este dado no KPI atual
            atestadosPendentes: kpisAdmin.atestados_pendentes || 0,
          });
        }
      } catch (err) {
        console.error("Erro ao carregar stats:", err);
      }
    }

    fetchDashboardStats();
  }, [user?.escola_id]);

  return (
    <main className="flex-1 space-y-6 bg-muted/40 p-4 md:p-8">
      {/* 1. Cabeçalho da página */}
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Página Inicial</h1>
          <p className="text-muted-foreground">
            Bem-vindo ao sistema de chamadas
          </p>
        </div>
        <DateRangePicker date={date} setDate={setDate} />
      </div>

      {/* 2. Seção de Cards de Resumo (KPIs) */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Alunos Matriculados"
          value={summaryData.alunosMatriculados}
          icon={Users}
          colorClass="bg-green-500"
        />
        <SummaryCard
          title="Alunos Faltosos Hoje"
          value={summaryData.faltososHoje}
          icon={AlertTriangle}
          colorClass="bg-yellow-500"
        />
        <SummaryCard
          title="Turmas Cadastradas"
          value={summaryData.turmasCadastradas}
          icon={Grid}
          colorClass="bg-sky-500"
        />
        <SummaryCard
          title="Atestados Pendentes"
          value={summaryData.atestadosPendentes}
          icon={FileText}
          colorClass="bg-red-500"
        />
      </section>

      {/* 3. Seção de Relatórios Detalhados */}
      <section className="space-y-6">
        <h2 className="text-xl font-semibold tracking-tight">
          Relatórios Detalhados
        </h2>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Card: Taxa de Presença */}
          <Card>
            <CardHeader>
              <CardTitle>Taxa de Presença por Turma</CardTitle>
            </CardHeader>
            <CardContent>
              <TaxaPresencaTurmaReport dateRange={date} />
            </CardContent>
          </Card>

          {/* Card: Alunos Faltosos */}
          <Card>
            <CardHeader>
              <CardTitle>Alunos com Mais Ausências</CardTitle>
            </CardHeader>
            <CardContent>
              <AlunosFaltososReport dateRange={date} />
            </CardContent>
          </Card>

          {/* Card: Atestados Pendentes */}
          <Card>
            <CardHeader>
              <CardTitle>Atestados Pendentes</CardTitle>
            </CardHeader>
            <CardContent>
              <RelatorioAtestadosPendentes />
            </CardContent>
          </Card>

          {/* Card: Atestados Aprovados */}
          <Card>
            <CardHeader>
              <CardTitle>Atestados Aprovados</CardTitle>
            </CardHeader>
            <CardContent>
              <RelatorioAtestados dateRange={date} />
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}