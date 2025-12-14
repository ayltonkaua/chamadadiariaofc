/**
 * Pesquisas Service
 * 
 * Business logic for survey management.
 */

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/core';
import type { Pesquisa, PerguntaPesquisa, RespostaPesquisa, PesquisaInsert } from '../types/pesquisas.types';

const log = logger.child('PesquisasService');

export const pesquisasService = {
    /**
     * Load all surveys for a user
     */
    async loadPesquisas(userId: string): Promise<Pesquisa[]> {
        log.debug('Loading pesquisas', { userId });

        const { data, error } = await (supabase as any)
            .from('pesquisas')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            log.error('Failed to load pesquisas', error);
            throw new Error(error.message);
        }

        return (data || []) as Pesquisa[];
    },

    /**
     * Get a single survey by ID
     */
    async getPesquisaById(id: string): Promise<Pesquisa | null> {
        const { data, error } = await (supabase as any)
            .from('pesquisas')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            log.error('Failed to get pesquisa', error);
            return null;
        }

        return data as Pesquisa;
    },

    /**
     * Get a survey by slug (for public access)
     */
    async getPesquisaBySlug(slug: string): Promise<Pesquisa | null> {
        const { data, error } = await (supabase as any)
            .from('pesquisas')
            .select('*')
            .eq('slug', slug)
            .eq('status', 'ativa')
            .single();

        if (error) {
            log.error('Failed to get pesquisa by slug', error);
            return null;
        }

        return data as Pesquisa;
    },

    /**
     * Create a new survey
     */
    async createPesquisa(pesquisa: PesquisaInsert): Promise<Pesquisa> {
        log.info('Creating pesquisa', { titulo: pesquisa.titulo });

        const { data, error } = await (supabase as any)
            .from('pesquisas')
            .insert(pesquisa)
            .select()
            .single();

        if (error) {
            log.error('Failed to create pesquisa', error);
            throw new Error(error.message);
        }

        return data as Pesquisa;
    },

    /**
     * Delete a survey
     */
    async deletePesquisa(id: string): Promise<void> {
        log.warn('Deleting pesquisa', { id });

        const { error } = await (supabase as any)
            .from('pesquisas')
            .delete()
            .eq('id', id);

        if (error) throw new Error(error.message);
    },

    /**
     * Load questions for a survey
     */
    async loadPerguntas(pesquisaId: string): Promise<PerguntaPesquisa[]> {
        const { data, error } = await (supabase as any)
            .from('pesquisas_perguntas')
            .select('*')
            .eq('pesquisa_id', pesquisaId)
            .order('ordem', { ascending: true });

        if (error) {
            log.error('Failed to load perguntas', error);
            return [];
        }

        return (data || []) as PerguntaPesquisa[];
    },

    /**
     * Save questions for a survey
     */
    async savePerguntas(pesquisaId: string, perguntas: Omit<PerguntaPesquisa, 'id'>[]): Promise<void> {
        // Delete existing questions
        await (supabase as any)
            .from('pesquisas_perguntas')
            .delete()
            .eq('pesquisa_id', pesquisaId);

        // Insert new questions
        if (perguntas.length > 0) {
            const { error } = await (supabase as any)
                .from('pesquisas_perguntas')
                .insert(perguntas);

            if (error) throw new Error(error.message);
        }
    },

    /**
     * Load responses for a survey
     */
    async loadRespostas(pesquisaId: string): Promise<RespostaPesquisa[]> {
        const { data, error } = await (supabase as any)
            .from('pesquisas_respostas')
            .select('*')
            .eq('pesquisa_id', pesquisaId)
            .order('created_at', { ascending: false });

        if (error) {
            log.error('Failed to load respostas', error);
            return [];
        }

        return (data || []) as RespostaPesquisa[];
    },

    /**
     * Submit a response to a survey
     */
    async submitResposta(pesquisaId: string, perguntaId: string, resposta: string): Promise<void> {
        const { error } = await (supabase as any)
            .from('pesquisas_respostas')
            .insert({
                pesquisa_id: pesquisaId,
                pergunta_id: perguntaId,
                resposta
            });

        if (error) throw new Error(error.message);
    }
};
