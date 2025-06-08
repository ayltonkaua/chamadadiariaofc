
import React, { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAttendance } from "@/contexts/AttendanceContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const AttendanceCalendar: React.FC = () => {
  const { selectedDate, setSelectedDate, attendanceRecords, selectedClass } = useAttendance();
  const [date, setDate] = useState<Date | undefined>(new Date(selectedDate));

  // Datas que possuem registros de presença para a turma selecionada
  const attendanceDates = new Set(
    attendanceRecords
      .filter((record) => record.classId === selectedClass)
      .map((record) => record.date)
  );

  // Função para verificar se uma data tem registro de presença
  const hasAttendanceRecord = (date: Date) => {
    const dateString = format(date, "yyyy-MM-dd");
    return attendanceDates.has(dateString);
  };

  const handleDateSelect = (newDate: Date | undefined) => {
    setDate(newDate);
    if (newDate) {
      setSelectedDate(format(newDate, "yyyy-MM-dd"));
    }
  };

  return (
    <Card className="w-full shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Calendário de Chamadas</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !date && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={handleDateSelect}
                initialFocus
                modifiers={{
                  hasAttendance: (date) => hasAttendanceRecord(date),
                }}
                modifiersClassNames={{
                  hasAttendance: "bg-purple-100 font-bold text-purple-700",
                }}
                className="p-3"
              />
            </PopoverContent>
          </Popover>

          <p className="mt-4 text-sm text-gray-500">
            Data selecionada: {date ? format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : "Nenhuma"}
          </p>
          
          <div className="mt-2 text-xs">
            <div className="flex items-center gap-1 mt-1">
              <div className="w-3 h-3 bg-purple-100 rounded-full"></div>
              <span>Dias com chamada registrada</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AttendanceCalendar;
