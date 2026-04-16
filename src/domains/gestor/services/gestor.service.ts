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
     * Resumo mensal de chamadas para exportação
     */
    async getResumoMensal(escolaId: string, anoLetivoId?: string | null): Promise<{
        mesBase: string;
        mes: string;
        chamadasRealizadas: number;
        totalPresencas: number;
        totalFaltas: number;
        percentualFaltas: number;
    }[]> {
        log.debug('Getting resumo mensal', { escolaId, anoLetivoId });

        let dataInicio: string | null = null;
        let dataFim: string | null = null;

        if (anoLetivoId) {
            const { data: anoLetivo } = await supabase
                .from('anos_letivos')
                .select('data_inicio, data_fim')
                .eq('id', anoLetivoId)
                .single();
            if (anoLetivo) {
                dataInicio = anoLetivo.data_inicio;
                dataFim = anoLetivo.data_fim;
            }
        }

        let query = supabase
            .from('presencas')
            .select('data_chamada, presente, falta_justificada, turma_id')
            .eq('escola_id', escolaId);

        if (dataInicio) query = query.gte('data_chamada', dataInicio);
        if (dataFim) query = query.lte('data_chamada', dataFim);

        const { data, error } = await query;
        if (error || !data) {
            log.error('Failed to fetch presencas for resumo', { error: String(error) });
            return [];
        }

        const mapByMonth = new Map<string, { presencas: number, faltas: number, rollCalls: Set<string> }>();
        const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

        for (const p of data) {
            let mesBase = '';
            let dataLocalStr = '';

            if (p.data_chamada && p.data_chamada.includes('T')) {
                // É ISO timestamp vindo do DB. Força conversão exata para UTC-3 (America/Sao_Paulo)
                // independente da máquina (Node ou Browser) estar em UTC ou outro fuso.
                const d = new Date(p.data_chamada);
                const spTime = new Intl.DateTimeFormat('en-US', {
                    timeZone: 'America/Sao_Paulo',
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                }).format(d);
                // spTime template is "MM/DD/YYYY" using en-US
                const [mes, dia, ano] = spTime.split('/');
                mesBase = `${ano}-${mes}`;
                dataLocalStr = `${ano}-${mes}-${dia}`;
            } else if (p.data_chamada) {
                // É apenas data (yyyy-MM-dd) que já está formatada correta
                mesBase = p.data_chamada.substring(0, 7);
                dataLocalStr = p.data_chamada;
            }

            if (!mapByMonth.has(mesBase)) {
                mapByMonth.set(mesBase, { presencas: 0, faltas: 0, rollCalls: new Set() });
            }
            const agg = mapByMonth.get(mesBase)!;
            if (p.presente) agg.presencas++;
            else agg.faltas++;
            
            if (p.turma_id && dataLocalStr) {
                agg.rollCalls.add(`${dataLocalStr}_${p.turma_id}`);
            }
        }

        const result = Array.from(mapByMonth.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([mesBase, agg]) => {
                const [ano, mes] = mesBase.split('-');
                const mesNum = parseInt(mes, 10);
                const totalRegistros = agg.presencas + agg.faltas;
                const percentualFaltas = totalRegistros > 0 ? (agg.faltas / totalRegistros) * 100 : 0;
                return {
                    mesBase,
                    mes: `${monthNames[mesNum - 1]} ${ano}`,
                    chamadasRealizadas: agg.rollCalls.size,
                    totalPresencas: agg.presencas,
                    totalFaltas: agg.faltas,
                    percentualFaltas
                };
            });

        return result;
    },

    /**
     * Busca ativa resumo para alunos selecionados
     */
    async getBuscaAtivaResumo(escolaId: string, alunoIds: string[]): Promise<Map<string, { contatado: boolean, ultimoContato?: string, totalContatos: number, ultimoStatus?: string, historico: any[] }>> {
        if (!alunoIds.length) return new Map();

        const { data, error } = await supabase
            .from('registros_contato_busca_ativa' as any)
            .select('aluno_id, data_contato, status_funil, forma_contato, justificativa_faltas, monitor_responsavel')
            .eq('escola_id', escolaId)
            .in('aluno_id', alunoIds)
            .order('data_contato', { ascending: false });

        if (error) {
            log.warn('Failed to fetch registros busca ativa', { error: String(error) });
            return new Map();
        }

        const map = new Map<string, { contatado: boolean, ultimoContato?: string, totalContatos: number, ultimoStatus?: string, historico: any[] }>();
        for (const row of ((data as any[]) || [])) {
            const existing = map.get(row.aluno_id);
            if (!existing) {
                map.set(row.aluno_id, { 
                    contatado: true, 
                    ultimoContato: row.data_contato, 
                    totalContatos: 1,
                    ultimoStatus: row.status_funil,
                    historico: [row]
                });
            } else {
                existing.totalContatos++;
                existing.historico.push(row);
            }
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
