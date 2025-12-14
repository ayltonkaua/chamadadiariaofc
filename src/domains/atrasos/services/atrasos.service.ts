/**
 * Atrasos (Tardy Records) Service
 * 
 * Business logic for tardy/late arrival records.
 */

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/core';
import type { RegistroAtraso, RegistroAtrasoInsert } from '../types/atraso.types';

const log = logger.child('AtrasosService');

export const atrasosService = {
    /**
     * Gets all tardy records
     */
    async findAll(): Promise<RegistroAtraso[]> {
        log.debug('Finding all atrasos');

        const { data, error } = await supabase
            .from('registros_atrasos')
            .select('*')
            .order('data_atraso', { ascending: false });

        if (error) {
            log.error('Failed to get atrasos', error);
            throw new Error(error.message);
        }

        return (data || []) as RegistroAtraso[];
    },

    /**
     * Creates a new tardy record
     */
    async create(registro: RegistroAtrasoInsert): Promise<void> {
        log.info('Creating atraso', { alunoId: registro.aluno_id, data: registro.data_atraso });

        const { error } = await supabase
            .from('registros_atrasos')
            .insert(registro as any);

        if (error) {
            log.error('Failed to create atraso', error);
            throw new Error(error.message);
        }
    },

    /**
     * Updates an existing tardy record
     */
    async update(id: string, registro: RegistroAtrasoInsert): Promise<void> {
        log.info('Updating atraso', { id });

        const { error } = await supabase
            .from('registros_atrasos')
            .update({
                aluno_id: registro.aluno_id,
                data_atraso: registro.data_atraso,
                horario_registro: registro.horario_registro
            })
            .eq('id', id);

        if (error) {
            log.error('Failed to update atraso', error);
            throw new Error(error.message);
        }
    },

    /**
     * Deletes a tardy record
     */
    async delete(id: string): Promise<void> {
        log.info('Deleting atraso', { id });

        const { error } = await supabase
            .from('registros_atrasos')
            .delete()
            .eq('id', id);

        if (error) {
            log.error('Failed to delete atraso', error);
            throw new Error(error.message);
        }
    }
};
