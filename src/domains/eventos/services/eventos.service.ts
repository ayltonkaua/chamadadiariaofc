/**
 * Eventos Service
 * 
 * Business logic for event management.
 */

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/core';
import type { Evento, EventoStaff, EventoConvidado, AlunoSearchResult } from '../types/eventos.types';

const log = logger.child('EventosService');

export const eventosService = {
    /**
     * Load all events for a school
     */
    async loadEventos(escolaId: string): Promise<Evento[]> {
        log.debug('Loading eventos', { escolaId });

        const { data, error } = await (supabase as any)
            .from('eventos')
            .select('*, eventos_checkins(count)')
            .eq('escola_id', escolaId)
            .order('data_evento', { ascending: false });

        if (error) {
            // Fallback without checkin count
            const { data: dataFallback } = await (supabase as any)
                .from('eventos')
                .select('*')
                .eq('escola_id', escolaId)
                .order('data_evento', { ascending: false });
            return dataFallback || [];
        }

        return data || [];
    },

    /**
     * Create a new event (deactivates others)
     */
    async createEvento(nome: string, dataEvento: string, escolaId: string): Promise<Evento> {
        log.info('Creating evento', { nome, dataEvento, escolaId });

        // Deactivate existing events
        await (supabase as any)
            .from('eventos')
            .update({ ativo: false })
            .eq('escola_id', escolaId);

        const { data, error } = await (supabase as any)
            .from('eventos')
            .insert({
                nome,
                data_evento: dataEvento,
                escola_id: escolaId,
                ativo: true
            })
            .select()
            .single();

        if (error) {
            log.error('Failed to create evento', error);
            throw new Error(error.message);
        }

        return data;
    },

    /**
     * Delete an event
     */
    async deleteEvento(id: string): Promise<void> {
        log.warn('Deleting evento', { id });

        const { error } = await (supabase as any)
            .from('eventos')
            .delete()
            .eq('id', id);

        if (error) throw new Error(error.message);
    },

    /**
     * Load staff/monitors for an event
     */
    async loadStaff(eventoId: string): Promise<EventoStaff[]> {
        const { data } = await (supabase as any)
            .from('eventos_staff')
            .select('*, alunos(id, nome)')
            .eq('evento_id', eventoId);

        return data || [];
    },

    /**
     * Search for potential staff members
     */
    async searchStaff(query: string, escolaId: string): Promise<AlunoSearchResult[]> {
        if (!query || query.length < 2) return [];

        const { data } = await supabase
            .from('alunos')
            .select('id, nome, turmas!inner(nome, escola_id)')
            .ilike('nome', `%${query}%`)
            .limit(5);

        return (data || []).filter((a: any) => {
            const turma = a.turmas;
            if (Array.isArray(turma)) return turma.some((t: any) => t.escola_id === escolaId);
            return turma?.escola_id === escolaId;
        }) as AlunoSearchResult[];
    },

    /**
     * Add a monitor to an event
     */
    async addMonitor(eventoId: string, alunoId: string): Promise<void> {
        const { error } = await (supabase as any)
            .from('eventos_staff')
            .insert({ evento_id: eventoId, aluno_id: alunoId });

        if (error) throw new Error(error.message);
    },

    /**
     * Remove a monitor from an event
     */
    async removeMonitor(staffId: string): Promise<void> {
        await (supabase as any)
            .from('eventos_staff')
            .delete()
            .eq('id', staffId);
    },

    /**
     * Load guests for an event
     */
    async loadGuests(eventoId: string): Promise<EventoConvidado[]> {
        const { data } = await (supabase as any)
            .from('eventos_convidados')
            .select('*')
            .eq('evento_id', eventoId)
            .order('created_at', { ascending: false });

        return data || [];
    },

    /**
     * Add a guest to an event
     */
    async addGuest(eventoId: string, nome: string, tipo: string): Promise<void> {
        const { error } = await (supabase as any)
            .from('eventos_convidados')
            .insert({
                evento_id: eventoId,
                nome,
                tipo
            });

        if (error) throw new Error(error.message);
    },

    /**
     * Remove a guest from an event
     */
    async removeGuest(guestId: string): Promise<void> {
        await (supabase as any)
            .from('eventos_convidados')
            .delete()
            .eq('id', guestId);
    },

    /**
     * Search students for printing tickets
     */
    async searchAlunosForPrint(query: string): Promise<AlunoSearchResult[]> {
        if (!query || query.length < 2) return [];

        const { data } = await supabase
            .from('alunos')
            .select('id, nome, matricula, turmas(nome)')
            .or(`nome.ilike.%${query}%,matricula.ilike.%${query}%`)
            .limit(10);

        return (data || []) as AlunoSearchResult[];
    }
};
