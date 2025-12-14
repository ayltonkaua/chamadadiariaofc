/**
 * Ingresso Service
 * 
 * Business logic for event tickets and check-in.
 */

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/core';
import type { EventoPublico, CheckinRegistro, AlunoIngresso } from '../types/ingresso.types';

const log = logger.child('IngressoService');

export const ingressoService = {
    /**
     * Get active event for a school (for student ticket)
     */
    async getActiveEvento(escolaId: string): Promise<EventoPublico | null> {
        log.debug('Getting active evento', { escolaId });

        const { data, error } = await (supabase as any)
            .from('eventos')
            .select('*')
            .eq('escola_id', escolaId)
            .eq('ativo', true)
            .order('data_evento', { ascending: false })
            .limit(1);

        if (error) {
            log.error('Failed to get active evento', error);
            return null;
        }

        return data && data.length > 0 ? data[0] : null;
    },

    /**
     * Record a check-in
     */
    async registrarCheckin(
        eventoId: string,
        tipo: 'aluno' | 'convidado' | 'staff',
        alunoId?: string,
        convidadoId?: string
    ): Promise<CheckinRegistro> {
        log.info('Recording checkin', { eventoId, tipo, alunoId, convidadoId });

        const { data, error } = await (supabase as any)
            .from('eventos_checkins')
            .insert({
                evento_id: eventoId,
                tipo,
                aluno_id: alunoId,
                convidado_id: convidadoId
            })
            .select()
            .single();

        if (error) {
            log.error('Failed to record checkin', error);
            throw new Error(error.message);
        }

        return data as CheckinRegistro;
    },

    /**
     * Get student info by matricula (for scanner)
     */
    async getAlunoByMatricula(matricula: string, escolaId: string): Promise<AlunoIngresso | null> {
        log.debug('Getting aluno by matricula', { matricula });

        const { data, error } = await supabase
            .from('alunos')
            .select('id, nome, matricula, turmas(nome)')
            .eq('matricula', matricula)
            .eq('escola_id', escolaId)
            .single();

        if (error) {
            log.error('Failed to get aluno', error);
            return null;
        }

        return data as AlunoIngresso;
    },

    /**
     * Validate if aluno already checked in
     */
    async verificarCheckinExistente(eventoId: string, alunoId: string): Promise<boolean> {
        const { data, error } = await (supabase as any)
            .from('eventos_checkins')
            .select('id')
            .eq('evento_id', eventoId)
            .eq('aluno_id', alunoId)
            .limit(1);

        if (error || !data) return false;
        return data.length > 0;
    },

    /**
     * Get check-in count for an event
     */
    async getCheckinCount(eventoId: string): Promise<number> {
        const { count, error } = await (supabase as any)
            .from('eventos_checkins')
            .select('id', { count: 'exact', head: true })
            .eq('evento_id', eventoId);

        if (error) return 0;
        return count || 0;
    }
};
