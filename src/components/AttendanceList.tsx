
import React, { useState, useEffect } from "react";
import { useAttendance } from "@/contexts/AttendanceContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface AttendanceState {
  [studentId: string]: boolean | null;
}

const AttendanceList: React.FC = () => {
  const { classes, selectedClass, markAttendance, saveAttendance } = useAttendance();
  const [attendanceState, setAttendanceState] = useState<AttendanceState>({});
  const [isSaving, setIsSaving] = useState(false);

  // Encontrar a turma selecionada
  const currentClass = classes.find((c) => c.id === selectedClass);

  // Resetar o estado quando a turma muda
  useEffect(() => {
    const initialState: AttendanceState = {};
    if (currentClass) {
      currentClass.students.forEach((student) => {
        initialState[student.id] = null;
      });
    }
    setAttendanceState(initialState);
  }, [selectedClass, currentClass]);

  // Marcar presença ou falta
  const handleAttendance = (studentId: string, present: boolean) => {
    setAttendanceState((prev) => ({
      ...prev,
      [studentId]: present,
    }));
    markAttendance(studentId, present);
  };

  const handleSaveAttendance = async () => {
    try {
      setIsSaving(true);
      await saveAttendance();
      toast({
        title: "Chamada salva",
        description: "A chamada foi registrada com sucesso.",
      });
      // Reset attendance state after saving
      const resetState: AttendanceState = {};
      if (currentClass) {
        currentClass.students.forEach((student) => {
          resetState[student.id] = null;
        });
      }
      setAttendanceState(resetState);
    } catch (error) {
      toast({
        title: "Erro ao salvar",
        description: "Ocorreu um erro ao salvar a chamada.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!currentClass) {
    return (
      <div className="flex justify-center items-center h-48 bg-gray-50 border rounded-lg">
        <p className="text-gray-500">Selecione uma turma para visualizar a lista de alunos</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold mb-4">Lista de Alunos - {currentClass.name}</h2>
      
      <div className="grid gap-4">
        {currentClass.students.map((student) => (
          <Card key={student.id} className="overflow-hidden">
            <CardContent className="p-0">
              <div className="flex items-center justify-between p-4 border-b">
                <div className="flex-1">
                  <h3 className="font-medium">{student.name}</h3>
                  <p className="text-sm text-gray-500">Matrícula: {student.enrollment}</p>
                </div>
                <div className="flex space-x-2">
                  <Button
                    size="sm"
                    variant={attendanceState[student.id] === true ? "default" : "outline"}
                    className={`${
                      attendanceState[student.id] === true
                        ? "bg-green-600 hover:bg-green-700"
                        : "border-green-600 text-green-600 hover:bg-green-50"
                    }`}
                    onClick={() => handleAttendance(student.id, true)}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Presente
                  </Button>
                  <Button
                    size="sm"
                    variant={attendanceState[student.id] === false ? "default" : "outline"}
                    className={`${
                      attendanceState[student.id] === false
                        ? "bg-red-600 hover:bg-red-700"
                        : "border-red-600 text-red-600 hover:bg-red-50"
                    }`}
                    onClick={() => handleAttendance(student.id, false)}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Falta
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button 
        className="w-full mt-6 bg-purple-600 hover:bg-purple-700" 
        onClick={handleSaveAttendance}
        disabled={isSaving}
      >
        {isSaving ? "Salvando..." : "Salvar Chamada"}
      </Button>
    </div>
  );
};

export default AttendanceList;
