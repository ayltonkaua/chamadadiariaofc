import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";

interface ChamadaHistorico {
  data: string;
  presentes: number;
  faltosos: number;
  total: number;
  presencas: Array<{
    aluno_id: string;
    presente: boolean;
  }>;
}

interface TurmaInfo {
  nome: string;
  numero_sala: string;
}

export const useHistoricoChamada = (turmaId: string | undefined) => {
  const [turma, setTurma] = useState<TurmaInfo | null>(null);
  const [historico, setHistorico] = useState<ChamadaHistorico[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const carregarDados = async () => {
    if (!turmaId) return;
    setLoading(true);

    try {
      // Load class info
      const { data: turmaDados } = await supabase
        .from("turmas")
        .select("nome, numero_sala")
        .eq("id", turmaId)
        .single();

      if (turmaDados) {
        setTurma(turmaDados);
      }

      // Get total student count
      const { count: totalAlunos } = await supabase
        .from("alunos")
        .select("id", { count: "exact", head: true })
        .eq("turma_id", turmaId);
      
      // Query attendance data for the class
      const { data: presencas, error } = await supabase
        .from("presencas")
        .select("data_chamada, presente, aluno_id")
        .eq("turma_id", turmaId)
        .order("data_chamada", { ascending: false });
      
      if (error) {
        console.error("Error fetching attendance:", error);
        throw error;
      }

      if (presencas && presencas.length > 0) {
        // Agrupar presenças por data
        const chamadas = presencas.reduce((acc: Record<string, { 
          presentes: number; 
          faltosos: number;
          presencas: Array<{ aluno_id: string; presente: boolean }>;
        }>, curr) => {
          const dataFormatada = curr.data_chamada;
          
          if (!acc[dataFormatada]) {
            acc[dataFormatada] = { 
              presentes: 0, 
              faltosos: 0,
              presencas: []
            };
          }
          
          if (curr.presente) {
            acc[dataFormatada].presentes += 1;
          } else {
            acc[dataFormatada].faltosos += 1;
          }

          acc[dataFormatada].presencas.push({
            aluno_id: curr.aluno_id,
            presente: curr.presente
          });
          
          return acc;
        }, {});

        // Converter para array e adicionar total de alunos
        const historicoFormatado: ChamadaHistorico[] = Object.keys(chamadas).map((data) => ({
          data,
          presentes: chamadas[data].presentes,
          faltosos: chamadas[data].faltosos,
          total: totalAlunos || 0,
          presencas: chamadas[data].presencas
        }));

        // Ordenar por data (mais recente primeiro)
        const historicoOrdenado = historicoFormatado.sort((a, b) => 
          new Date(b.data).getTime() - new Date(a.data).getTime()
        );

        setHistorico(historicoOrdenado);
      } else {
        setHistorico([]);
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao carregar os dados da chamada.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const editarChamada = async (data: string, novasPresencas: Array<{ aluno_id: string; presente: boolean }>) => {
    try {
      // Primeiro, deletar todas as presenças da data
      const { error: deleteError } = await supabase
        .from("presencas")
        .delete()
        .eq("turma_id", turmaId)
        .eq("data_chamada", data);

      if (deleteError) throw deleteError;

      // Inserir as novas presenças
      const presencasParaInserir = novasPresencas.map(presenca => ({
        aluno_id: presenca.aluno_id,
        turma_id: turmaId,
        presente: presenca.presente,
        data_chamada: data
      }));

      const { error: insertError } = await supabase
        .from("presencas")
        .insert(presencasParaInserir);

      if (insertError) throw insertError;

      // Recarregar os dados
      await carregarDados();

      toast({
        title: "Chamada atualizada",
        description: "A chamada foi atualizada com sucesso.",
      });
    } catch (error) {
      console.error("Erro ao editar chamada:", error);
      toast({
        title: "Erro ao atualizar",
        description: "Ocorreu um erro ao atualizar a chamada.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const excluirChamada = async (data: string) => {
    try {
      const { error } = await supabase
        .from("presencas")
        .delete()
        .eq("turma_id", turmaId)
        .eq("data_chamada", data);

      if (error) throw error;

      // Recarregar os dados
      await carregarDados();

      toast({
        title: "Chamada excluída",
        description: "A chamada foi excluída com sucesso.",
      });
    } catch (error) {
      console.error("Erro ao excluir chamada:", error);
      toast({
        title: "Erro ao excluir",
        description: "Ocorreu um erro ao excluir a chamada.",
        variant: "destructive",
      });
      throw error;
    }
  };

  useEffect(() => {
    carregarDados();
  }, [turmaId]);

  return { turma, historico, loading, editarChamada, excluirChamada };
};

