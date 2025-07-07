// src/pages/RelatoriosPage.tsx

import { useState } from "react";
import { addDays, format } from "date-fns";
import { DateRange } from "react-day-picker";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlunosFaltososReport } from "@/components/relatorios/AlunosFaltososReport";
import { TaxaPresencaTurmaReport } from "@/components/relatorios/TaxaPresencaTurmaReport";
import { RelatorioAtestados } from "@/components/relatorios/RelatorioAtestados";
import { RelatorioAtestadosPendentes } from "@/components/relatorios/RelatorioAtestadosPendentes"; // NOVO
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";

function RelatoriosPage() {
  const [date, setDate] = useState<DateRange | undefined>({
    from: addDays(new Date(), -30),
    to: new Date(),
  });

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Relatórios de Gestão</h1>
        <p className="text-muted-foreground">
          Analise o desempenho e a frequência da sua escola.
        </p>
      </header>

      <div className="flex items-center space-x-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              id="date"
              variant={"outline"}
              className={cn(
                "w-[300px] justify-start text-left font-normal",
                !date && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date?.from ? (
                date.to ? (
                  <>
                    {format(date.from, "LLL dd, y")} -{" "}
                    {format(date.to, "LLL dd, y")}
                  </>
                ) : (
                  format(date.from, "LLL dd, y")
                )
              ) : (
                <span>Selecione um período</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={date?.from}
              selected={date}
              onSelect={setDate}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
      </div>

      <Tabs defaultValue="taxa-turma">
        {/* MODIFICADO: Adicionada nova aba e ajustado o grid */}
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 md:w-fit">
          <TabsTrigger value="taxa-turma">Índices por Turma</TabsTrigger>
          <TabsTrigger value="alunos-faltosos">Alunos Faltosos</TabsTrigger>
          <TabsTrigger value="atestados">Aprovados</TabsTrigger>
          <TabsTrigger value="atestados-pendentes">Pendentes</TabsTrigger>
        </TabsList>
        
        <TabsContent value="taxa-turma" className="mt-4">
          <TaxaPresencaTurmaReport dateRange={date} />
        </TabsContent>
        <TabsContent value="alunos-faltosos" className="mt-4">
          <AlunosFaltososReport dateRange={date} />
        </TabsContent>
        <TabsContent value="atestados" className="mt-4">
          <RelatorioAtestados dateRange={date} />
        </TabsContent>
        {/* NOVO: Conteúdo da nova aba */}
        <TabsContent value="atestados-pendentes" className="mt-4">
          <RelatorioAtestadosPendentes />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default RelatoriosPage;