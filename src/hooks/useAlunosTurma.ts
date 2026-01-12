/**
 * useAlunosTurma Hook v2.0
 * 
 * 🚨 REFATORADO PARA OFFLINE-FIRST
 * 
 * ANTES: Chamava supabase diretamente (4 queries)
 * AGORA: Usa dataProvider (IndexedDB primeiro, fallback Supabase)
 * 
 * 🚫 DO NOT ACCESS SUPABASE HERE - Use dataProvider only
 */

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import {
  getAlunosByTurma,
  getTurmaById,
  getPresencasByTurma,
  type AlunoData
} from "@/lib/dataProvider";

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
  totalAlunos?: number;
  alunosFaltosos?: number;
  alunosPresentes?: number;
  percentualPresencaHoje?: number;
}

export function useAlunosTurma(turmaId?: string, campos: string[] = ["id", "nome", "matricula", "turma_id"]) {
  const { user } = useAuth();
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [turmaInfo, setTurmaInfo] = useState<TurmaInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const fetchAlunos = useCallback(async () => {
    if (!turmaId) return;

    setLoading(true);

    try {
      // 1. Get turma info via dataProvider (OFFLINE-FIRST)
      const turmaResult = await getTurmaById(turmaId);

      if (!turmaResult.data) {
        console.warn('[useAlunosTurma] Turma not found in cache or network');
        setLoading(false);
        return;
      }

      const turmaData = turmaResult.data;

      // 2. Get alunos via dataProvider (OFFLINE-FIRST)
      const alunosResult = await getAlunosByTurma(turmaId, user?.escola_id);
      const alunosData = alunosResult.data;

      // 3. Get presencas (ALWAYS fetch - provider handles offline/merge)
      let presencasData: any[] = [];
      let presencasHojeData: any[] = [];

      try {
        const presencasResult = await getPresencasByTurma(turmaId);
        presencasData = presencasResult.data;

        // Filter today's presencas
        const hoje = format(new Date(), 'yyyy-MM-dd');
        presencasHojeData = presencasData.filter((p: any) => p.data_chamada === hoje);
      } catch (err) {
        console.warn('Error fetching presencas:', err);
      }

      // 4. Calculate stats per student
      const statsMap = new Map<string, { total: number; faltas: number }>();
      presencasData.forEach((p: any) => {
        const current = statsMap.get(p.aluno_id) || { total: 0, faltas: 0 };
        current.total++;
        if (!p.presente && !p.falta_justificada) {
          current.faltas++;
        }
        statsMap.set(p.aluno_id, current);
      });

      // 5. Calculate today's stats
      const faltososHoje = presencasHojeData.filter(p => !p.presente).length;
      const presentesHoje = presencasHojeData.filter(p => p.presente).length;
      const totalRegistrosHoje = presencasHojeData.length;
      const percentualPresencaHoje = totalRegistrosHoje > 0
        ? Math.round((presentesHoje / totalRegistrosHoje) * 100)
        : undefined;

      // 6. Process students with attendance stats
      const processedAlunos = alunosData.map((aluno) => {
        const stats = statsMap.get(aluno.id) || { total: 0, faltas: 0 };
        const frequencia = stats.total > 0
          ? Math.round(((stats.total - stats.faltas) / stats.total) * 100)
          : 100;

        return {
          id: aluno.id,
          nome: aluno.nome,
          matricula: aluno.matricula,
          turma_id: aluno.turma_id,
          faltas: stats.faltas,
          frequencia: Math.max(0, Math.min(100, frequencia))
        };
      });

      // 7. Update state
      setTurmaInfo({
        id: turmaData.id,
        nome: turmaData.nome,
        numero_sala: turmaData.numero_sala || '',
        totalAlunos: alunosData.length,
        alunosFaltosos: faltososHoje,
        alunosPresentes: presentesHoje,
        percentualPresencaHoje
      });

      setAlunos(processedAlunos.sort((a, b) => a.nome.localeCompare(b.nome)));

      // Log source for debugging
      console.log('[useAlunosTurma] Data loaded', {
        turmaSource: turmaResult.source,
        alunosSource: alunosResult.source,
        alunosCount: alunosData.length,
        isOffline: !navigator.onLine
      });

    } catch (error) {
      console.error("[useAlunosTurma] Error loading data:", error);
    } finally {
      setLoading(false);
    }
  }, [turmaId, user?.escola_id]);

  // Listen for online/offline changes
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      fetchAlunos(); // Refresh when coming online
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [fetchAlunos]);

  // Initial fetch
  useEffect(() => {
    fetchAlunos();
  }, [fetchAlunos]);

  const refreshAlunos = useCallback(() => {
    fetchAlunos();
  }, [fetchAlunos]);

  return {
    alunos,
    setAlunos,
    turmaInfo,
    loading,
    refreshAlunos,
    isOffline // Expose offline status for UI
  };
}