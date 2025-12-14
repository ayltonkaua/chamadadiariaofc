/**
 * Portal Aluno Service
 * 
 * Business logic for the student portal.
 * Handles fetching student data, attendance, benefits, and medical certificates.
 */

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/core';
import type { StudentData, MeusAtestados, Beneficio, AlunoInfo } from '../types/portalAluno.types';

const log = logger.child('PortalAlunoService');

export const portalAlunoService = {
    /**
     * Fetches complete student data including attendance statistics
     */
    async getStudentData(alunoId: string): Promise<StudentData> {
        log.debug('Fetching student data', { alunoId });

        // 1. Get student + class info
        const { data: alunoInfo, error: alunoError } = await (supabase as any)
            .from('alunos')
            .select('matricula, turma_id, turmas(nome), nome_responsavel, telefone_responsavel, endereco')
            .eq('id', alunoId)
            .single();

        if (alunoError) {
            log.error('Failed to fetch student info', alunoError);
            throw new Error('Não foi possível carregar dados do aluno');
        }

        // 2. Get attendance stats
        const { count: totalAulasRegistradas, error: errorTotal } = await supabase
            .from('presencas')
            .select('id', { count: 'exact', head: true })
            .eq('aluno_id', alunoId);

        if (errorTotal) {
            log.error('Failed to count total classes', errorTotal);
            throw new Error('Erro ao calcular frequência');
        }

        const { count: totalFaltasRegistradas, error: errorFaltas } = await supabase
            .from('presencas')
            .select('id', { count: 'exact', head: true })
            .eq('aluno_id', alunoId)
            .eq('presente', false);

        if (errorFaltas) {
            log.error('Failed to count absences', errorFaltas);
            throw new Error('Erro ao calcular faltas');
        }

        const aulas = totalAulasRegistradas || 0;
        const faltas = totalFaltasRegistradas || 0;
        const freq = aulas > 0 ? Math.round(((aulas - faltas) / aulas) * 100) : 100;

        // 3. Determine status
        let status: StudentData['status'] = 'Excelente';
        if (freq < 75) status = 'Crítico';
        else if (freq < 85) status = 'Atenção';
        else if (freq < 100) status = 'Regular';

        // 4. Check for incomplete data
        const dadosIncompletos = !alunoInfo.nome_responsavel ||
            !alunoInfo.telefone_responsavel ||
            !alunoInfo.endereco;

        log.info('Student data loaded', { freq, status, aulas, faltas });

        return {
            turma: alunoInfo.turmas?.nome || 'Sem Turma',
            matricula: alunoInfo.matricula,
            frequencia: freq,
            status,
            totalAulas: aulas,
            totalFaltas: faltas,
            dadosIncompletos
        };
    },

    /**
     * Fetches student's benefits via RPC
     */
    async getBeneficios(): Promise<Beneficio[]> {
        log.debug('Fetching benefits');

        try {
            const { data, error } = await (supabase as any).rpc('get_beneficios_aluno');

            if (error) {
                log.error('Failed to fetch benefits', error);
                return [];
            }

            log.info('Benefits loaded', { count: data?.length || 0 });
            return Array.isArray(data) ? data : [];
        } catch (error) {
            log.error('Exception fetching benefits', error);
            return [];
        }
    },

    /**
     * Fetches student's medical certificates
     */
    async getMeusAtestados(alunoId: string): Promise<MeusAtestados[]> {
        log.debug('Fetching student certificates', { alunoId });

        const { data, error } = await supabase
            .from('atestados')
            .select('*')
            .eq('aluno_id', alunoId)
            .order('created_at', { ascending: false });

        if (error) {
            log.error('Failed to fetch certificates', error);
            throw new Error('Erro ao carregar atestados');
        }

        log.info('Certificates loaded', { count: data?.length || 0 });
        return (data || []) as MeusAtestados[];
    },

    /**
     * Fetches all portal data in a single call
     */
    async getPortalData(alunoId: string): Promise<{
        studentData: StudentData;
        beneficios: Beneficio[];
    }> {
        log.debug('Fetching complete portal data', { alunoId });

        const [studentData, beneficios] = await Promise.all([
            this.getStudentData(alunoId),
            this.getBeneficios()
        ]);

        return { studentData, beneficios };
    }
};
