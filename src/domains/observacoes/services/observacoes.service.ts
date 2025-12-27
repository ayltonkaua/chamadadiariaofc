/**
 * Observacoes Service v2.0
 * 
 * 🚨 REFATORADO PARA OFFLINE-FIRST
 * 
 * ANTES: Chamava supabase diretamente (falha se offline)
 * AGORA: Salva localmente via ObservacaoAtom, sincroniza via SyncManager
 * 
 * 🚫 DO NOT ACCESS SUPABASE HERE - Use offlineStorage + SyncManager
 */

import { logger, ValidationError } from '@/core';
import {
    createObservacaoAtom,
    saveObservacaoAtom
} from '@/lib/offlineStorage';
import { triggerSync } from '@/lib/SyncManager';
import type { Observacao } from '../types/observacao.types';

const log = logger.child('ObservacoesService');

export interface SalvarObservacaoResult {
    localSaved: boolean;
    syncTriggered: boolean;
    observacaoId: string;
}

export const observacoesService = {
    /**
     * Saves an observation - OFFLINE-FIRST
     * 
     * 1. Validates input
     * 2. Creates ObservacaoAtom in IndexedDB
     * 3. Triggers sync if online (non-blocking)
     * 4. Returns immediately after local save
     */
    async salvar(observacao: Observacao): Promise<SalvarObservacaoResult> {
        log.info('Saving observacao (offline-first)', {
            alunoId: observacao.aluno_id,
            data: observacao.data_observacao
        });

        // Validation
        if (!observacao.user_id) {
            throw new ValidationError('Usuário não autenticado');
        }

        if (!observacao.titulo?.trim()) {
            throw new ValidationError('Título é obrigatório');
        }

        if (!observacao.escola_id) {
            throw new ValidationError('Escola não identificada');
        }

        // Create atom
        const atom = createObservacaoAtom(
            observacao.escola_id,
            observacao.turma_id,
            observacao.aluno_id,
            observacao.user_id,
            observacao.data_observacao,
            observacao.titulo.trim(),
            observacao.descricao?.trim() || ''
        );

        // Save locally (CRITICAL: must succeed before returning)
        await saveObservacaoAtom(atom);
        log.info('ObservacaoAtom saved locally', { id: atom.id });

        // Trigger sync if online (non-blocking)
        let syncTriggered = false;
        if (navigator.onLine) {
            triggerSync().catch(err => {
                log.warn('Sync trigger failed', { error: err.message });
            });
            syncTriggered = true;
        }

        return {
            localSaved: true,
            syncTriggered,
            observacaoId: atom.id
        };
    }
};
