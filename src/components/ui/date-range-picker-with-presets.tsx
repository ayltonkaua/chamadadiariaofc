import * as React from "react"
import { CalendarIcon } from "lucide-react"
import { addDays, format, startOfMonth, startOfYear, subDays } from "date-fns"
import { ptBR } from "date-fns/locale"
import { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

export function DateRangePickerWithPresets({
  className,
  date,
  setDate
}: React.HTMLAttributes<HTMLDivElement> & { date: DateRange | undefined, setDate: (date: DateRange | undefined) => void }) {
  
  const handlePresetChange = (value: string) => {
    const now = new Date();
    switch (value) {
        case "today": setDate({ from: now, to: now }); break;
        case "last7": setDate({ from: subDays(now, 6), to: now }); break;
        case "last30": setDate({ from: subDays(now, 29), to: now }); break;
        case "thisMonth": setDate({ from: startOfMonth(now), to: now }); break;
        case "thisYear": setDate({ from: startOfYear(now), to: now }); break;
    }
  }

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-full sm:w-[280px] justify-start text-left font-normal",
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
        <PopoverContent className="flex w-auto flex-col space-y-2 p-2" align="end">
            <Select onValueChange={handlePresetChange}>
                <SelectTrigger>
                    <SelectValue placeholder="Períodos rápidos" />
                </SelectTrigger>
                <SelectContent position="popper">
                    <SelectItem value="today">Hoje</SelectItem>
                    <SelectItem value="last7">Últimos 7 dias</SelectItem>
                    <SelectItem value="last30">Últimos 30 dias</SelectItem>
                    <SelectItem value="thisMonth">Este mês</SelectItem>
                    <SelectItem value="thisYear">Este ano</SelectItem>
                </SelectContent>
            </Select>
          <div className="rounded-md border">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={date?.from}
              selected={date}
              onSelect={setDate}
              numberOfMonths={2}
              locale={ptBR}
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}