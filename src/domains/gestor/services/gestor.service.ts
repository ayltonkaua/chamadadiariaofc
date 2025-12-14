/**
 * Gestor (Admin Dashboard) Service
 * 
 * Business logic for management dashboard analytics.
 * Note: Uses type assertions for custom RPCs not in generated types.
 */

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/core';
import { subDays } from 'date-fns';
import type {
    KpiData,
    KpiAdminData,
    TurmaComparisonData,
    AlunoRiscoData,
    AlunoFaltasConsecutivasData,
    UltimaObservacaoData,
    TurmaMetadata,
    PresencaRecente,
    DashboardGestorData,
    UltimaPresenca
} from '../types/gestor.types';

const log = logger.child('GestorService');

/**
 * Helper function to call RPC with type coercion.
 * Called at runtime to ensure supabase is initialized.
 */
function callRpc(name: string, params?: Record<string, unknown>) {
    return (supabase.rpc as (name: string, params?: Record<string, unknown>) => ReturnType<typeof supabase.rpc>)(name, params);
}

export const gestorService = {
    /**
     * Gets all dashboard data in parallel
     */
    async getDashboardData(escolaId: string): Promise<DashboardGestorData> {
        log.info('Loading dashboard data', { escolaId });

        const [
            kpiRes,
            kpiAdminRes,
            turmaRes,
            riscoRes,
            consecRes,
            obsRes,
            turmasListRes,
            presencasRes
        ] = await Promise.all([
            callRpc('get_escola_kpis', { _escola_id: escolaId }),
            callRpc('get_kpis_administrativos', { _escola_id: escolaId }),
            callRpc('get_comparativo_turmas', { _escola_id: escolaId }),
            callRpc('get_alunos_em_risco_anual', { limite_faltas: 16, _escola_id: escolaId }),
            callRpc('get_alunos_faltas_consecutivas', { dias_seguidos: 3, _escola_id: escolaId }),
            callRpc('get_ultimas_observacoes', { limite: 10, _escola_id: escolaId }),
            supabase.from('turmas').select('id, nome, turno').order('nome'),
            supabase.from('presencas').select('data_chamada, presente, turma_id, escola_id')
                .gte('data_chamada', subDays(new Date(), 15).toISOString())
        ]);

        return {
            kpis: (kpiRes.data as unknown as KpiData) ?? null,
            kpisAdmin: (kpiAdminRes.data as unknown as KpiAdminData) ?? null,
            turmaComparison: (turmaRes.data as unknown as TurmaComparisonData[]) ?? [],
            alunosRisco: (riscoRes.data as unknown as AlunoRiscoData[]) ?? [],
            alunosConsecutivos: (consecRes.data as unknown as AlunoFaltasConsecutivasData[]) ?? [],
            ultimasObservacoes: (obsRes.data as unknown as UltimaObservacaoData[]) ?? [],
            turmasDisponiveis: (turmasListRes.data as TurmaMetadata[]) ?? [],
            presencasRecentes: (presencasRes.data as PresencaRecente[]) ?? []
        };
    },

    /**
     * Gets last attendances for a specific student
     */
    async getUltimasPresencasAluno(alunoId: string): Promise<UltimaPresenca[]> {
        log.debug('Getting ultimas presencas', { alunoId });

        const { data, error } = await callRpc('get_ultimas_presencas_aluno', {
            p_aluno_id: alunoId
        });

        if (error) {
            log.error('Failed to get ultimas presencas', error);
            return [];
        }

        return ((data as unknown as UltimaPresenca[]) ?? []).slice(0, 3);
    },

    /**
     * Gets escola KPIs only
     */
    async getKpis(escolaId: string): Promise<KpiData | null> {
        const { data, error } = await callRpc('get_escola_kpis', { _escola_id: escolaId });

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
        const { data, error } = await callRpc('get_kpis_administrativos', { _escola_id: escolaId });

        if (error) {
            log.error('Failed to get admin KPIs', error);
            return null;
        }

        return data as unknown as KpiAdminData;
    }
};
