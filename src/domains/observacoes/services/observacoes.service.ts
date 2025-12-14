/**
 * Observacoes Service
 * 
 * Business logic for student observations.
 */

import { supabase } from '@/integrations/supabase/client';
import { logger, ValidationError, NetworkError } from '@/core';
import type { Observacao } from '../types/observacao.types';

const log = logger.child('ObservacoesService');

export const observacoesService = {
    /**
     * Saves or updates an observation
     */
    async salvar(observacao: Observacao): Promise<void> {
        log.info('Saving observacao', { alunoId: observacao.aluno_id, data: observacao.data_observacao });

        if (!navigator.onLine) {
            throw new NetworkError('Observações requerem conexão com internet.', true);
        }

        if (!observacao.user_id) {
            throw new ValidationError('Usuário não autenticado');
        }

        if (!observacao.titulo.trim()) {
            throw new ValidationError('Título é obrigatório');
        }

        const { error } = await supabase
            .from('observacoes_alunos')
            .upsert(observacao as any, { onConflict: 'aluno_id, data_observacao' });

        if (error) {
            log.error('Failed to save observacao', error.message);
            throw new Error(error.message);
        }
    }
};
