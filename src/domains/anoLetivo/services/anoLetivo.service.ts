/**
 * Ano Letivo Service
 * 
 * Business logic for academic year management.
 * 
 * NOTE: After running migrations, regenerate Supabase types:
 * npx supabase gen types typescript --local > src/integrations/supabase/types.ts
 */

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/core';
import type {
    AnoLetivo,
    AnoLetivoInsert,
    AnoLetivoComStats,
    MigracaoResult
} from '../types/anoLetivo.types';

const log = logger.child('AnoLetivoService');

export const anoLetivoService = {
    /**
     * Get all academic years for a school with stats
     */
    async getAll(escolaId: string): Promise<AnoLetivoComStats[]> {
        log.debug('Fetching all anos letivos', { escolaId });

        // Using any to bypass type checking until types are regenerated
        const { data, error } = await (supabase as any)
            .rpc('get_anos_letivos_com_stats', { p_escola_id: escolaId });

        if (error) {
            log.error('Error fetching anos letivos', { error });
            throw new Error('Erro ao buscar anos letivos');
        }

        return (data || []) as AnoLetivoComStats[];
    },

    /**
     * Get the active academic year for a school
     */
    async getAtivo(escolaId: string): Promise<AnoLetivo | null> {
        log.debug('Fetching active ano letivo', { escolaId });

        // Using any to bypass type checking until types are regenerated
        const { data, error } = await (supabase as any)
            .from('anos_letivos')
            .select('*')
            .eq('escola_id', escolaId)
            .eq('status', 'aberto')
            .maybeSingle();

        if (error) {
            log.error('Error fetching active ano', { error });
            throw new Error('Erro ao buscar ano letivo ativo');
        }

        return data as AnoLetivo | null;
    },

    /**
     * Check if school has an active year
     */
    async hasAnoAtivo(escolaId: string): Promise<boolean> {
        const { data } = await (supabase as any)
            .rpc('has_ano_letivo_ativo', { p_escola_id: escolaId });
        return !!data;
    },

    /**
     * Create a new academic year
     */
    async criar(dados: AnoLetivoInsert): Promise<AnoLetivo> {
        log.info('Creating new ano letivo', { ano: dados.ano });

        const { data, error } = await (supabase as any)
            .from('anos_letivos')
            .insert({
                ...dados,
                status: dados.status || 'aberto'
            })
            .select()
            .single();

        if (error) {
            log.error('Error creating ano letivo', { error });
            if (error.code === '23505') {
                throw new Error(`Já existe um ano letivo ${dados.ano} para esta escola`);
            }
            throw new Error('Erro ao criar ano letivo');
        }

        return data as AnoLetivo;
    },

    /**
     * Migrate existing data to a new academic year
     */
    async migrarDadosExistentes(
        escolaId: string,
        ano: number,
        nome: string,
        dataInicio: string,
        dataFim: string
    ): Promise<MigracaoResult> {
        log.info('Migrating existing data to ano letivo', { escolaId, ano });

        const { data, error } = await (supabase as any)
            .rpc('migrar_para_ano_letivo', {
                p_escola_id: escolaId,
                p_ano: ano,
                p_nome: nome,
                p_data_inicio: dataInicio,
                p_data_fim: dataFim
            });

        if (error) {
            log.error('Error migrating data', { error });
            throw new Error(error.message || 'Erro ao migrar dados');
        }

        return data as MigracaoResult;
    },

    /**
     * Close an academic year
     */
    async fechar(anoLetivoId: string): Promise<{ success: boolean; message: string }> {
        log.info('Closing ano letivo', { anoLetivoId });

        const { data, error } = await (supabase as any)
            .rpc('fechar_ano_letivo', { p_ano_letivo_id: anoLetivoId });

        if (error) {
            log.error('Error closing ano letivo', { error });
            throw new Error(error.message || 'Erro ao fechar ano letivo');
        }

        return data as { success: boolean; message: string };
    },

    /**
     * Get count of orphan classes (without ano_letivo_id)
     */
    async countTurmasOrfas(escolaId: string): Promise<number> {
        const { count, error } = await supabase
            .from('turmas')
            .select('*', { count: 'exact', head: true })
            .eq('escola_id', escolaId)
            .is('ano_letivo_id' as any, null);

        if (error) {
            log.error('Error counting orphan turmas', { error });
            return 0;
        }

        return count || 0;
    }
};
