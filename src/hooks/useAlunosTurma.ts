import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Aluno {
  id: string;
  nome: string;
  matricula: string;
  faltas: number;
  frequencia: number;
  turma_id: string;
}

interface TurmaInfo {
  id: string;
  nome: string;
  numero_sala: string;
}

export function useAlunosTurma(turmaId?: string, campos: string[] = ["id", "nome", "matricula", "turma_id"]) {
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [turmaInfo, setTurmaInfo] = useState<TurmaInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAlunos = async () => {
    if (!turmaId) return;
    
    setLoading(true);
    
    try {
      // Get turma info
      const { data: turmaData, error: turmaError } = await supabase
        .from("turmas")
        .select("id, nome, numero_sala")
        .eq("id", turmaId)
        .single();
      
      if (turmaError || !turmaData) {
        throw turmaError || new Error("Turma não encontrada");
      }

      // Get students
      const { data: alunosData, error: alunosError } = await supabase
        .from("alunos")
        .select(campos.join(", "))
        .eq("turma_id", turmaId)
        .order("nome");
      
      if (alunosError) {
        throw alunosError;
      }

      // Count unique dates for total classes
      const { data: datasChamada } = await supabase
        .from("presencas")
        .select("data_chamada")
        .eq("turma_id", turmaId)
        .order("data_chamada", { ascending: false });

      const datasUnicas = new Set(datasChamada?.map(p => p.data_chamada) || []);
      const totalAulas = datasUnicas.size || 0;

      // Process students with attendance data
      const processedAlunos = await Promise.all(
        alunosData.map(async (aluno) => {
          const { count: totalFaltas } = await supabase
            .from("presencas")
            .select("id", { count: "exact", head: true })
            .eq("aluno_id", aluno.id)
            .eq("presente", false);
          
          return {
            ...aluno,
            faltas: totalFaltas || 0,
            frequencia: totalAulas > 0 ? 
              Math.round(((totalAulas - (totalFaltas || 0)) / totalAulas) * 100) : 
              100
          };
        })
      );

      setTurmaInfo(turmaData);
      setAlunos(processedAlunos.sort((a, b) => a.nome.localeCompare(b.nome)));
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlunos();
  }, [turmaId]);

  const refreshAlunos = () => {
    fetchAlunos();
  };

  return {
    alunos,
    setAlunos,
    turmaInfo,
    loading,
    refreshAlunos
  };
}
