/**
 * Gestor (Admin Dashboard) Service
 * 
 * Business logic for management dashboard analytics.
 * Note: Uses type assertions for custom RPCs not in generated types.
 */

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/core';
import type {
    KpiData,
    KpiAdminData,
    TurmaComparisonData,
    AlunoRiscoData,
    AlunoFaltasConsecutivasData,
    UltimaObservacaoData,
    TurmaMetadata,
    PresencaRecente,
    UltimaPresenca,
    FrequenciaDisciplinaData,
    FaltasDiaSemanaData,
    DashboardGestorData
} from '../types/gestor.types';

const log = logger.child('GestorService');

/**
 * Helper function to call RPC with type coercion and error handling.
 */
async function safeCallRpc(name: string, params?: Record<string, unknown>) {
    try {
        const result = await (supabase.rpc as (name: string, params?: Record<string, unknown>) => ReturnType<typeof supabase.rpc>)(name, params);
        return result;
    } catch (e) {
        log.warn(`RPC ${name} failed`, { error: String(e) });
        return { data: null, error: e };
    }
}

export const gestorService = {
    /**
     * Gets all dashboard data in parallel
     */
    async getDashboardData(escolaId: string, filtroAnoLetivoId?: string): Promise<DashboardGestorData> {
        log.info('Loading dashboard data', { escolaId, filtroAnoLetivoId });

        // Safe RPC calls with error handling
        const kpiPromise = safeCallRpc('get_escola_kpis', { 
            _escola_id: escolaId,
            _ano_letivo_id: filtroAnoLetivoId ? filtroAnoLetivoId : null
        });
        const kpiAdminPromise = safeCallRpc('get_kpis_administrativos', { _escola_id: escolaId });
        const comparativoPromise = safeCallRpc('get_comparativo_turmas', {
            p_escola_id: escolaId,
            p_ano_letivo_id: filtroAnoLetivoId ? filtroAnoLetivoId : null
        });
        // Alunos em risco: Limite de 5 faltas (ajuste conforme regra da escola)
        const riscoPromise = safeCallRpc('get_alunos_em_risco_anual', { 
            limite_faltas: 5, 
            _escola_id: escolaId,
            _ano_letivo_id: filtroAnoLetivoId ? filtroAnoLetivoId : null
        });
        const consecPromise = safeCallRpc('get_alunos_faltas_consecutivas', { dias_seguidos: 3, _escola_id: escolaId });
        const obsPromise = safeCallRpc('get_ultimas_observacoes', { limite: 10, _escola_id: escolaId });
        const freqPromise = safeCallRpc('get_frequencia_por_disciplina', {
            p_escola_id: escolaId,
            p_ano_letivo_id: filtroAnoLetivoId ? filtroAnoLetivoId : null
        });

        // Direct Supabase queries
        const turmasPromise = supabase.from('turmas').select('id, nome, turno').eq('escola_id', escolaId).order('nome');
        // Server-side day-of-week aggregation (avoids JS timezone bugs)
        const faltasDiaSemanaPromise = safeCallRpc('get_faltas_por_dia_semana', {
            _escola_id: escolaId,
            _dias: 15,
            _ano_letivo_id: filtroAnoLetivoId ? filtroAnoLetivoId : null
        });

        const [
            kpiRes,
            kpiAdminRes,
            comparativoResult,
            riscoRes,
            consecRes,
            obsRes,
            turmasListRes,
            faltasDiaSemanaRes,
            freqRes
        ] = await Promise.all([
            kpiPromise,
            kpiAdminPromise,
            comparativoPromise,
            riscoPromise,
            consecPromise,
            obsPromise,
            turmasPromise,
            faltasDiaSemanaPromise,
            freqPromise
        ]);

        // Log errors for debugging
        if (kpiRes.error) log.warn('get_escola_kpis failed', { error: String(kpiRes.error) });
        if (comparativoResult.error) log.warn('get_comparativo_turmas failed', { error: String(comparativoResult.error) });
        if (turmasListRes.error) log.warn('turmas query failed', { error: String(turmasListRes.error) });

        return {
            kpis: (kpiRes.data as unknown as KpiData) ?? null,
            kpisAdmin: (kpiAdminRes.data as unknown as KpiAdminData) ?? null,
            turmaComparison: (comparativoResult.data as unknown as TurmaComparisonData[]) ?? [],
            alunosRisco: (riscoRes.data as unknown as AlunoRiscoData[]) ?? [],
            alunosConsecutivos: (consecRes.data as unknown as AlunoFaltasConsecutivasData[]) ?? [],
            ultimasObservacoes: (obsRes.data as unknown as UltimaObservacaoData[]) ?? [],
            turmasDisponiveis: (turmasListRes.data as TurmaMetadata[]) ?? [],
            faltasPorDiaSemana: (faltasDiaSemanaRes.data as unknown as FaltasDiaSemanaData[]) ?? [],
            frequenciaDisciplina: (freqRes.data as unknown as FrequenciaDisciplinaData[]) ?? []
        };
    },

    /**
     * Gets last attendances for a specific student
     */
    async getUltimasPresencasAluno(alunoId: string): Promise<UltimaPresenca[]> {
        log.debug('Getting ultimas presencas', { alunoId });

        const { data, error } = await safeCallRpc('get_ultimas_presencas_aluno', {
            p_aluno_id: alunoId
        });

        if (error) {
            log.error('Failed to get ultimas presencas', error);
            return [];
        }

        return ((data as unknown as UltimaPresenca[]) ?? []).slice(0, 3);
    },

    /**
     * Gets last attendances for multiple students in batch (eliminates N+1)
     */
    async getUltimasPresencasBatch(alunoIds: string[]): Promise<Map<string, UltimaPresenca[]>> {
        if (!alunoIds.length) return new Map();
        
        const { data, error } = await safeCallRpc('get_ultimas_presencas_batch', {
            p_aluno_ids: alunoIds
        });

        if (error || !data) {
            log.warn('Batch presencas failed, falling back', { error: String(error) });
            return new Map();
        }

        const map = new Map<string, UltimaPresenca[]>();
        for (const row of (data as any[])) {
            const arr = map.get(row.aluno_id) || [];
            arr.push({ data_chamada: row.data_chamada, presente: row.presente });
            map.set(row.aluno_id, arr);
        }
        return map;
    },

    /**
     * Gets escola KPIs only
     */
    async getKpis(escolaId: string): Promise<KpiData | null> {
        const { data, error } = await safeCallRpc('get_escola_kpis', { _escola_id: escolaId });

        if (error) {
            log.error('Failed to get KPIs', error);
            return null;
        }

        return data as unknown as KpiData;
    },

    /**
     * Gets admin KPIs (pending items count)
     */
    async getKpisAdmin(escolaId: string): Promise<KpiAdminData | null> {
        const { data, error } = await safeCallRpc('get_kpis_administrativos', { _escola_id: escolaId });

        if (error) {
            log.error('Failed to get admin KPIs', error);
            return null;
        }

        return data as unknown as KpiAdminData;
    }
};
