import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Aluno {
  id: string;
  nome: string;
  matricula: string;
  faltas: number;
  frequencia: number;
  turma_id: string;
  user_id?: string;
}

interface TurmaInfo {
  id: string;
  nome: string;
  numero_sala: string;
  totalAlunos?: number;
  alunosFaltosos?: number;
  alunosPresentes?: number;
  percentualPresencaHoje?: number;
}

export function useAlunosTurma(turmaId?: string, campos: string[] = ["id", "nome", "matricula", "turma_id"]) {
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [turmaInfo, setTurmaInfo] = useState<TurmaInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAlunos = async () => {
    if (!turmaId) return;

    setLoading(true);

    try {
      // 1. Garante que 'user_id' e 'turma_id' sempre sejam buscados
      const camposObrigatorios = ["id", "turma_id", "user_id"];
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
        .select(camposParaBuscar.join(", "))
        .eq("turma_id", turmaId)
        .order("nome");

      if (alunosError) {
        throw alunosError;
      }

      // ============================================
      // CORREÇÃO DO BUG: Cálculo de frequência por aluno
      // ============================================
      // Buscar TODAS as presenças da turma (não só faltas)
      const { data: todasPresencas, error: errorPresencas } = await supabase
        .from("presencas")
        .select("aluno_id, presente, falta_justificada")
        .eq("turma_id", turmaId);

      if (errorPresencas) {
        console.error("Erro ao buscar presenças:", errorPresencas);
        throw errorPresencas;
      }

      // Calcular estatísticas POR ALUNO individualmente
      // Isso garante que alunos transferidos tenham cálculo correto
      const statsMap = new Map<string, { total: number; faltas: number }>();
      todasPresencas?.forEach((p) => {
        const current = statsMap.get(p.aluno_id) || { total: 0, faltas: 0 };
        current.total++;
        // Falta = não presente E não justificada
        if (!p.presente && !p.falta_justificada) {
          current.faltas++;
        }
        statsMap.set(p.aluno_id, current);
      });

      // ============================================
      // NOVA FUNCIONALIDADE: Estatísticas do dia atual
      // ============================================
      const hoje = new Date().toISOString().split('T')[0];
      const { data: presencasHoje } = await supabase
        .from("presencas")
        .select("aluno_id, presente")
        .eq("turma_id", turmaId)
        .eq("data_chamada", hoje);

      const faltososHoje = presencasHoje?.filter(p => !p.presente).length || 0;
      const presentesHoje = presencasHoje?.filter(p => p.presente).length || 0;
      const totalRegistrosHoje = presencasHoje?.length || 0;
      const percentualPresencaHoje = totalRegistrosHoje > 0
        ? Math.round((presentesHoje / totalRegistrosHoje) * 100)
        : undefined; // undefined indica que a chamada não foi realizada hoje

      // Process students with CORRECT attendance calculation
      const processedAlunos = alunosData.map((aluno) => {
        const stats = statsMap.get(aluno.id) || { total: 0, faltas: 0 };

        // FÓRMULA CORRETA:
        // Frequência = (Total de chamadas do aluno - Faltas não justificadas) / Total de chamadas * 100
        // Se não há chamadas para o aluno, frequência = 100% (não negativo!)
        const frequencia = stats.total > 0
          ? Math.round(((stats.total - stats.faltas) / stats.total) * 100)
          : 100;

        return {
          ...aluno,
          faltas: stats.faltas,
          frequencia: Math.max(0, Math.min(100, frequencia)) // Garantir entre 0-100%
        };
      });

      // Atualizar turmaInfo com estatísticas completas
      setTurmaInfo({
        ...turmaData,
        totalAlunos: alunosData.length,
        alunosFaltosos: faltososHoje,
        alunosPresentes: presentesHoje,
        percentualPresencaHoje
      });

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