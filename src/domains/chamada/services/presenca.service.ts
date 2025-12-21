/**
 * Presenca (Attendance) Service v2.0
 * 
 * CONVERGÊNCIA TOTAL - OFFLINE FIRST
 * 
 * Regras:
 * - TODA chamada salva primeiro no IndexedDB
 * - NUNCA escreve direto no Supabase
 * - Sync acontece via SyncManager (background)
 * - Retorno IMEDIATO após persistência local
 */

import { logger, ValidationError } from '@/core';
import {
    createChamadaAtom,
    saveChamadaAtom as saveToIndexedDB,
    chamadaExists,
    deleteSession,
    type ChamadaAtom,
    type RegistroPresenca
} from '@/lib/offlineStorage';
import { triggerSync } from '@/lib/SyncManager';
import type {
    ChamadaPayload,
    StatusPresenca
} from '../types/presenca.types';

const log = logger.child('PresencaService');

// =============================================================================
// TYPES
// =============================================================================

export interface SaveChamadaResult {
    /** Always true after local save - never fails after IndexedDB write */
    localSaved: true;
    /** ID of the ChamadaAtom created */
    chamadaId: string;
    /** Number of attendance records */
    registrosCount: number;
    /** Whether sync was triggered (if online) */
    syncTriggered: boolean;
}

// =============================================================================
// MAIN SERVICE
// =============================================================================

/**
 * Service for managing attendance records
 * 
 * CRITICAL: This is offline-first. All writes go to IndexedDB first.
 */
export const presencaService = {

    /**
     * ÚNICO PONTO DE ENTRADA para salvar chamada.
     * 
     * Comportamento:
     * 1. Valida payload
     * 2. Gera UUID + idempotencyKey
     * 3. Cria ChamadaAtom
     * 4. Persiste no IndexedDB
     * 5. Se online, dispara sync (não aguarda)
     * 6. Retorna sucesso imediatamente
     * 
     * GARANTIAS:
     * - Dados NUNCA são perdidos após retorno
     * - Funciona 100% offline
     * - Idempotente (mesma turma+data = update)
     */
    async salvarChamada(payload: ChamadaPayload): Promise<SaveChamadaResult> {
        log.info('[OFFLINE-FIRST] Saving chamada', {
            turmaId: payload.turmaId,
            data: payload.dataChamada,
            count: payload.registros.length
        });

        // =========================================================================
        // 1. VALIDATION
        // =========================================================================
        if (!payload.turmaId) {
            throw new ValidationError('Turma é obrigatória', { field: 'turmaId' });
        }
        if (!payload.escolaId) {
            throw new ValidationError('Escola é obrigatória', { field: 'escolaId' });
        }
        if (!payload.dataChamada) {
            throw new ValidationError('Data da chamada é obrigatória', { field: 'dataChamada' });
        }
        if (payload.registros.length === 0) {
            throw new ValidationError('Nenhum registro de presença');
        }

        // =========================================================================
        // 2. BUILD REGISTROS
        // =========================================================================
        const registros: RegistroPresenca[] = payload.registros.map(r => ({
            aluno_id: r.alunoId,
            presente: r.presente,
            falta_justificada: r.faltaJustificada ?? false
        }));

        // =========================================================================
        // 3. CHECK IF CHAMADA ALREADY EXISTS (update case)
        // =========================================================================
        const existing = await chamadaExists(
            payload.escolaId,
            payload.turmaId,
            payload.dataChamada
        );

        let chamada: ChamadaAtom;

        if (existing) {
            // UPDATE: Replace registros, reset status to pending
            log.info('[OFFLINE-FIRST] Updating existing chamada', { id: existing.id });
            chamada = {
                ...existing,
                registros,
                status: 'pending',
                attempts: 0,
                lastError: undefined,
                updated_at: Date.now()
            };
        } else {
            // CREATE: New ChamadaAtom with UUID + idempotencyKey
            chamada = createChamadaAtom(
                payload.escolaId,
                payload.turmaId,
                payload.dataChamada,
                registros
            );
        }

        // =========================================================================
        // 4. PERSIST TO INDEXEDDB (CRITICAL - POINT OF NO RETURN)
        // =========================================================================
        try {
            await saveToIndexedDB(chamada);
            log.info('[OFFLINE-FIRST] Chamada saved to IndexedDB', {
                id: chamada.id,
                idempotencyKey: chamada.idempotencyKey
            });
        } catch (error) {
            // This should NEVER happen in production
            log.error('[OFFLINE-FIRST] CRITICAL: Failed to save to IndexedDB', { error });
            throw new ValidationError('Falha ao salvar localmente. Tente novamente.');
        }

        // =========================================================================
        // 5. CLEAR SESSION DRAFT
        // =========================================================================
        try {
            await deleteSession(payload.turmaId, payload.dataChamada);
        } catch {
            // Non-critical, ignore
        }

        // =========================================================================
        // 6. TRIGGER SYNC IF ONLINE (NON-BLOCKING)
        // =========================================================================
        let syncTriggered = false;

        if (navigator.onLine) {
            // Fire and forget - don't await
            triggerSync().catch(err => {
                log.warn('[OFFLINE-FIRST] Sync trigger failed (will retry)', { err });
            });
            syncTriggered = true;
        }

        // =========================================================================
        // 7. RETURN SUCCESS IMMEDIATELY
        // =========================================================================
        return {
            localSaved: true,
            chamadaId: chamada.id,
            registrosCount: registros.length,
            syncTriggered
        };
    },

    /**
     * Converts visual status to database values
     */
    statusToDb(status: StatusPresenca): { presente: boolean; falta_justificada: boolean } {
        switch (status) {
            case 'presente':
                return { presente: true, falta_justificada: false };
            case 'falta':
                return { presente: false, falta_justificada: false };
            case 'atestado':
                return { presente: false, falta_justificada: true };
        }
    },

    /**
     * Converts database values to visual status
     */
    dbToStatus(presente: boolean, faltaJustificada: boolean): StatusPresenca {
        if (presente) return 'presente';
        if (faltaJustificada) return 'atestado';
        return 'falta';
    }
};

// =============================================================================
// LEGACY FUNCTIONS - DEPRECATED
// =============================================================================

/**
 * @deprecated Use presencaService.salvarChamada() instead.
 * These functions are kept for backward compatibility but will be removed.
 */
export const legacyPresencaService = {
    /** @deprecated */
    async findByTurmaAndDate() {
        console.warn('[DEPRECATED] findByTurmaAndDate - use RPC instead');
        return [];
    },

    /** @deprecated */
    async getHistorico() {
        console.warn('[DEPRECATED] getHistorico - use RPC instead');
        return [];
    },

    /** @deprecated */
    async getHistoricoAluno() {
        console.warn('[DEPRECATED] getHistoricoAluno - use RPC instead');
        return [];
    },

    /** @deprecated */
    async editarChamada() {
        console.warn('[DEPRECATED] editarChamada - use salvarChamada instead');
    },

    /** @deprecated */
    async excluirChamada() {
        console.warn('[DEPRECATED] excluirChamada - use RPC instead');
    }
};
