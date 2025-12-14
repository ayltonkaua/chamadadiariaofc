/**
 * Beneficios Service
 * 
 * Business logic for social programs and benefits.
 */

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/core';
import type { BeneficioRegistro } from '../types/beneficio.types';

const log = logger.child('BeneficiosService');

/**
 * Service for managing student benefits
 */
export const beneficiosService = {
    /**
     * Gets student's matricula by user_id
     */
    async getAlunoMatricula(userId: string): Promise<string | null> {
        log.debug('Getting aluno matricula', { userId });

        const { data, error } = await supabase
            .from('alunos')
            .select('matricula')
            .eq('user_id', userId)
            .single();

        if (error || !data) {
            log.warn('Aluno not found for user', { userId });
            return null;
        }

        return data.matricula;
    },

    /**
     * Gets benefits for a student by matricula
     */
    async getBeneficiosByMatricula(matricula: string): Promise<BeneficioRegistro[]> {
        log.debug('Getting beneficios by matricula', { matricula });

        const { data, error } = await supabase
            .from('programas_registros')
            .select(`
        *,
        programas_sociais (nome, ativo)
      `)
            .eq('matricula_beneficiario', matricula);

        if (error) {
            log.error('Failed to get beneficios', error.message);
            throw new Error(error.message);
        }

        // Filter only active programs
        const ativos = (data || []).filter(
            (b: any) => b.programas_sociais?.ativo
        );

        return ativos as BeneficioRegistro[];
    },

    /**
     * Gets all benefits for a user (combines matricula lookup + benefits fetch)
     */
    async getBeneficiosForUser(userId: string): Promise<{
        matricula: string | null;
        beneficios: BeneficioRegistro[];
    }> {
        const matricula = await this.getAlunoMatricula(userId);

        if (!matricula) {
            return { matricula: null, beneficios: [] };
        }

        const beneficios = await this.getBeneficiosByMatricula(matricula);

        return { matricula, beneficios };
    }
};
