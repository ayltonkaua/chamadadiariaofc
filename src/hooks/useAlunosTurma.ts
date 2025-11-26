import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Aluno {
  id: string;
  nome: string;
  matricula: string;
  faltas: number;
  frequencia: number;
  turma_id: string;
  user_id?: string; // Campo opcional
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
      // 1. Garante que 'user_id' e 'turma_id' sempre sejam buscados, 
      //    mesmo que a página não tenha pedido explicitamente.
      const camposObrigatorios = ["id", "turma_id", "user_id"];
      // Une os campos pedidos com os obrigatórios e remove duplicatas
      const camposParaBuscar = [...new Set([...campos, ...camposObrigatorios])];

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
        .select(camposParaBuscar.join(", ")) // Usa a lista combinada
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

      // Fetch all absences for the class in one go
      const { data: todasFaltas, error: errorFaltas } = await supabase
        .from("presencas")
        .select("aluno_id")
        .eq("turma_id", turmaId)
        .eq("presente", false);

      if (errorFaltas) {
        console.error("Erro ao buscar faltas:", errorFaltas);
        throw errorFaltas;
      }

      // Map absences count by student ID
      const faltasMap = new Map<string, number>();
      todasFaltas?.forEach((falta) => {
        const current = faltasMap.get(falta.aluno_id) || 0;
        faltasMap.set(falta.aluno_id, current + 1);
      });

      // Process students with attendance data
      const processedAlunos = alunosData.map((aluno) => {
        const totalFaltas = faltasMap.get(aluno.id) || 0;

        return {
          ...aluno,
          faltas: totalFaltas,
          frequencia: totalAulas > 0 ?
            Math.round(((totalAulas - totalFaltas) / totalAulas) * 100) :
            100
        };
      });

      setTurmaInfo(turmaData);
      setAlunos(processedAlunos.sort((a, b) => a.nome.localeCompare(b.nome)) as Aluno[]);
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