/**
 * Atestados Service
 * 
 * Business logic for medical certificates.
 */

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/core';
import { format } from 'date-fns';
import type {
    Atestado,
    AtestadoStatus,
    AtestadoInsert,
    AtestadoFilter,
    AtestadoPaginatedResult
} from '../types/atestado.types';

const log = logger.child('AtestadosService');

export const atestadosService = {
    /**
     * Gets approved atestados valid for today
     */
    async getAtestadosVigentes(): Promise<Atestado[]> {
        const hoje = format(new Date(), 'yyyy-MM-dd');
        log.debug('Getting atestados vigentes', { data: hoje });

        const { data, error } = await supabase
            .from('atestados')
            .select('*')
            .eq('status', 'aprovado')
            .lte('data_inicio', hoje)
            .gte('data_fim', hoje);

        if (error) {
            log.error('Failed to get atestados', error);
            return [];
        }

        return (data || []) as Atestado[];
    },

    /**
     * Gets paginated atestados with filtering
     */
    async findPaginated(
        filter: AtestadoFilter,
        page: number = 1,
        pageSize: number = 10
    ): Promise<AtestadoPaginatedResult> {
        log.debug('Finding atestados paginated', { filter, page, pageSize });

        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        let query = supabase
            .from('atestados')
            .select('*, alunos!inner(nome, turmas(nome))', { count: 'exact' });

        if (filter.status) {
            query = query.eq('status', filter.status);
        }

        if (filter.searchTerm) {
            query = query.ilike('alunos.nome', `%${filter.searchTerm}%`);
        }

        if (filter.dateFrom) {
            query = query.gte('data_inicio', filter.dateFrom);
        }

        if (filter.dateTo) {
            query = query.lte('data_fim', filter.dateTo);
        }

        query = query.order('created_at', { ascending: false }).range(from, to);

        const { data, error, count } = await query;

        if (error) {
            log.error('Failed to find atestados', error);
            throw new Error(error.message);
        }

        return {
            data: (data || []) as Atestado[],
            count: count ?? 0
        };
    },

    /**
     * Creates or updates an atestado
     */
    async upsert(atestado: AtestadoInsert): Promise<void> {
        log.info('Upserting atestado', { alunoId: atestado.aluno_id });

        const { error } = await supabase
            .from('atestados')
            .upsert(atestado as any);

        if (error) {
            log.error('Failed to upsert atestado', error);
            throw new Error(error.message);
        }
    },

    /**
     * Updates atestado status
     */
    async updateStatus(id: string, status: AtestadoStatus): Promise<void> {
        log.info('Updating atestado status', { id, status });

        const { error } = await supabase
            .from('atestados')
            .update({ status })
            .eq('id', id);

        if (error) {
            log.error('Failed to update status', error);
            throw new Error(error.message);
        }
    },

    /**
     * Deletes an atestado
     */
    async delete(id: string): Promise<void> {
        log.info('Deleting atestado', { id });

        const { error } = await supabase
            .from('atestados')
            .delete()
            .eq('id', id);

        if (error) {
            log.error('Failed to delete atestado', error);
            throw new Error(error.message);
        }
    },

    /**
     * Groups atestados by aluno_id for quick lookup
     */
    groupByAluno(atestados: Atestado[]): Record<string, Atestado[]> {
        const map: Record<string, Atestado[]> = {};

        for (const att of atestados) {
            if (!map[att.aluno_id]) {
                map[att.aluno_id] = [];
            }
            map[att.aluno_id].push(att);
        }

        return map;
    }
};
