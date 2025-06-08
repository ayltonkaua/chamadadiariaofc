
import React, { createContext, useState, useContext, ReactNode, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Student {
  id: string;
  name: string;
  enrollment: string; // Matrícula
  class: string; // Turma
}

interface AttendanceRecord {
  date: string;
  classId: string;
  studentId: string;
  present: boolean;
}

interface ClassData {
  id: string;
  name: string;
  students: Student[];
}

interface AttendanceContextType {
  classes: ClassData[];
  attendanceRecords: AttendanceRecord[];
  selectedDate: string;
  selectedClass: string | null;
  markAttendance: (studentId: string, present: boolean) => void;
  saveAttendance: () => void;
  setSelectedDate: (date: string) => void;
  setSelectedClass: (classId: string) => void;
  getStudentAttendance: (enrollment: string, name: string) => {
    name: string;
    enrollment: string;
    totalClasses: number;
    absences: number;
  } | null;
  fetchClasses: () => Promise<void>;
}

const AttendanceContext = createContext<AttendanceContextType | undefined>(undefined);

export const AttendanceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [currentAttendance, setCurrentAttendance] = useState<Map<string, boolean>>(new Map());

  // Carregar turmas e alunos do Supabase
  const fetchClasses = async () => {
    const { data: turmas, error: errorTurmas } = await supabase.from("turmas").select("id, nome");
    if (errorTurmas || !turmas) {
      setClasses([]);
      return;
    }
    const classesWithStudents: ClassData[] = [];
    for (const turma of turmas) {
      const { data: alunos } = await supabase
        .from("alunos")
        .select("id, nome, matricula, turma_id")
        .eq("turma_id", turma.id);

      classesWithStudents.push({
        id: turma.id,
        name: turma.nome,
        students: (alunos || []).map((aluno) => ({
          id: aluno.id,
          name: aluno.nome,
          enrollment: aluno.matricula,
          class: aluno.turma_id,
        })),
      });
    }
    setClasses(classesWithStudents);
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  // Marcar presença/falta temporariamente
  const markAttendance = (studentId: string, present: boolean) => {
    const newAttendance = new Map(currentAttendance);
    newAttendance.set(studentId, present);
    setCurrentAttendance(newAttendance);
  };

  // Salvar registro de presença
  const saveAttendance = async () => {
    if (!selectedClass) return;
    const newRecords: AttendanceRecord[] = [];
    const presencasParaInserir: any[] = [];
    currentAttendance.forEach((present, studentId) => {
      newRecords.push({
        date: selectedDate,
        classId: selectedClass,
        studentId,
        present,
      });
      presencasParaInserir.push({
        aluno_id: studentId,
        turma_id: selectedClass,
        presente: present,
        data_chamada: selectedDate,
      });
    });

    await supabase.from("presencas").insert(presencasParaInserir);
    setAttendanceRecords([...attendanceRecords, ...newRecords]);
    setCurrentAttendance(new Map());
  };

  // Obter dados de presença do aluno
  const getStudentAttendance = (enrollment: string, name: string) => {
    // Procurar o aluno nas turmas carregadas
    let student: Student | undefined;
    let foundClass: ClassData | undefined;
    for (const classData of classes) {
      student = classData.students.find(
        (s) => s.enrollment === enrollment && s.name.toLowerCase() === name.toLowerCase()
      );
      if (student) {
        foundClass = classData;
        break;
      }
    }
    if (!student || !foundClass) return null;
    // Aqui, considera-se ausência apenas dos registros já carregados localmente
    const classAttendances = attendanceRecords.filter(
      (record) => record.classId === foundClass?.id
    );
    const uniqueDates = new Set(classAttendances.map(record => record.date));
    const totalClasses = uniqueDates.size;
    const studentAbsences = attendanceRecords.filter(
      (record) => record.studentId === student?.id && !record.present
    ).length;
    return {
      name: student.name,
      enrollment: student.enrollment,
      totalClasses,
      absences: studentAbsences,
    };
  };

  const value = {
    classes,
    attendanceRecords,
    selectedDate,
    selectedClass,
    markAttendance,
    saveAttendance,
    setSelectedDate,
    setSelectedClass,
    getStudentAttendance,
    fetchClasses,
  };

  return <AttendanceContext.Provider value={value}>{children}</AttendanceContext.Provider>;
};

export const useAttendance = (): AttendanceContextType => {
  const context = useContext(AttendanceContext);
  if (context === undefined) {
    throw new Error("useAttendance deve ser usado dentro de um AttendanceProvider");
  }
  return context;
};
