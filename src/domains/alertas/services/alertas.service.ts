/**
 * Alertas Service
 * 
 * Business logic for attendance alerts.
 */

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/core';
import type { AlertaFrequencia, AlertaGerado } from '../types/alerta.types';
import { LIMITE_FALTAS_PERCENTUAL } from '../types/alerta.types';

const log = logger.child('AlertasService');

/**
 * Service for managing attendance alerts
 */
export const alertasService = {
    /**
     * Gets attendance statistics for a school (uses RPC)
     */
    async getAlertasFrequencia(escolaId: string): Promise<AlertaFrequencia[]> {
        log.debug('Getting alertas frequencia', { escolaId });

        const { data, error } = await supabase
            .rpc('get_alertas_frequencia', { _escola_id: escolaId });

        if (error) {
            log.error('Failed to get alertas', error.message);
            throw new Error(error.message);
        }

        return (data || []) as AlertaFrequencia[];
    },

    /**
     * Generates alert objects from frequency statistics
     */
    gerarAlertas(stats: AlertaFrequencia[], limite: number = LIMITE_FALTAS_PERCENTUAL): AlertaGerado[] {
        const alertas: AlertaGerado[] = [];

        for (const stat of stats) {
            const taxa = Number(stat.percentual_faltas);

            if (taxa >= limite) {
                alertas.push({
                    id: stat.aluno_id,
                    alunoNome: stat.nome,
                    turmaNome: stat.turma_nome || 'Turma',
                    mensagem: `O(A) aluno(a) atingiu ${taxa}% de faltas.`,
                    tipo: 'Faltas Elevadas',
                    dadosAdicionais: {
                        totalAulas: Number(stat.total_aulas),
                        totalFaltas: Number(stat.total_faltas),
                        taxaFaltas: taxa,
                    },
                });
            }
        }

        return alertas.sort((a, b) => a.alunoNome.localeCompare(b.alunoNome));
    },

    /**
     * Gets generated alerts for a school (combines fetch + generation)
     */
    async getAlertas(escolaId: string): Promise<AlertaGerado[]> {
        const stats = await this.getAlertasFrequencia(escolaId);
        return this.gerarAlertas(stats);
    }
};
