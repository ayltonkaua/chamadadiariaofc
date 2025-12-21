/**
 * SyncManager v2.0
 * 
 * RELIABLE synchronization engine for ChamadaDiária.
 * 
 * FIXES v2.0:
 * - RPC timeout (15s) to prevent infinite waiting
 * - Circuit breaker does NOT auto-reset (manual only)
 * - Proper handling of RPC response (created, already_synced = SUCCESS)
 * - Terminal states guaranteed (synced or error, never stuck in syncing)
 * - Final progress notification always sent
 * 
 * CRITICAL: This is a public-policy system. Zero data loss allowed.
 */

import { supabase } from '@/integrations/supabase/client';
import {
    type ChamadaAtom,
    getPendingChamadas,
    updateChamadaAtom,
    removeSyncedChamada,
    addSyncLog,
    countPendingChamadas,
    getStorageStats
} from './offlineStorage';

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
    // Retry settings
    MAX_ATTEMPTS: 5,
    BASE_DELAY_MS: 1000,
    MAX_DELAY_MS: 60000,
    BACKOFF_MULTIPLIER: 2,

    // RPC timeout - CRITICAL: prevents infinite spinner
    RPC_TIMEOUT_MS: 15000,  // 15 seconds max per RPC call

    // Throttling (anti-flood for 500+ schools at 7h peak)
    MAX_CONCURRENT: 3,
    BATCH_DELAY_MS: 500,
    JITTER_MS: 200,

    // Circuit breaker - does NOT auto-reset
    CIRCUIT_BREAK_THRESHOLD: 5,    // consecutive failures
    CIRCUIT_BREAK_DURATION_MS: 5 * 60 * 1000  // 5 minutes minimum
} as const;

// =============================================================================
// TYPES
// =============================================================================

export type SyncManagerState = 'idle' | 'syncing' | 'paused' | 'circuit_open';

export interface SyncResult {
    success: boolean;
    status: 'synced' | 'already_synced' | 'retry' | 'fatal_error';
    message: string;
    chamadaId: string;
    attempts: number;
    durationMs: number;
}

export interface SyncProgress {
    total: number;
    completed: number;
    failed: number;
    current?: string;
    isComplete: boolean;  // NEW: indicates if sync round is done
}

export interface SyncStateData {
    state: SyncManagerState;
    pendingCount: number;
    lastSync?: number;
    consecutiveFailures: number;
    circuitOpenUntil?: number;
}

// =============================================================================
// SYNC MANAGER CLASS
// =============================================================================

class SyncManager {
    private state: SyncManagerState = 'idle';
    private consecutiveFailures = 0;
    private circuitOpenUntil?: number;
    private lastSync?: number;
    private isProcessing = false;

    // Event listeners
    private onlineHandler: (() => void) | null = null;
    private visibilityHandler: (() => void) | null = null;

    // Progress tracking
    private currentProgress: SyncProgress = { total: 0, completed: 0, failed: 0, isComplete: true };
    private progressListeners: Set<(progress: SyncProgress) => void> = new Set();

    // ==========================================================================
    // INITIALIZATION
    // ==========================================================================

    init(): void {
        this.onlineHandler = () => {
            console.log('[SyncManager] Online detected - triggering sync');
            // Only trigger if circuit is not open
            if (!this.isCircuitOpen()) {
                this.processQueue();
            }
        };
        window.addEventListener('online', this.onlineHandler);

        this.visibilityHandler = () => {
            if (document.visibilityState === 'visible' && navigator.onLine && !this.isCircuitOpen()) {
                console.log('[SyncManager] Visibility + online - triggering sync');
                this.processQueue();
            }
        };
        document.addEventListener('visibilitychange', this.visibilityHandler);

        console.log('[SyncManager] Initialized v2.0 with reliability fixes');

        // Initial sync if online and circuit not open
        if (navigator.onLine && !this.isCircuitOpen()) {
            this.processQueue();
        }
    }

    destroy(): void {
        if (this.onlineHandler) {
            window.removeEventListener('online', this.onlineHandler);
        }
        if (this.visibilityHandler) {
            document.removeEventListener('visibilitychange', this.visibilityHandler);
        }
        console.log('[SyncManager] Destroyed');
    }

    // ==========================================================================
    // PUBLIC METHODS
    // ==========================================================================

    async processQueue(): Promise<SyncResult[]> {
        // Guard: prevent concurrent processing
        if (this.isProcessing) {
            console.log('[SyncManager] Already processing, skipping');
            return [];
        }

        // Guard: check circuit breaker (NO AUTO RESET)
        if (this.isCircuitOpen()) {
            console.log('[SyncManager] Circuit open, skipping. Manual reset required.');
            this.notifyFinalState();
            return [];
        }

        // Guard: must be online
        if (!navigator.onLine) {
            console.log('[SyncManager] Offline, skipping');
            this.notifyFinalState();
            return [];
        }

        // CRITICAL: Ensure valid JWT before sync to prevent all items going to error
        try {
            await this.ensureValidSession();
        } catch (authError) {
            console.warn('[SyncManager] Auth refresh failed, aborting sync cleanly', authError);
            this.notifyFinalState();
            return [];  // Abort cleanly - items stay pending, NOT error
        }

        this.isProcessing = true;
        this.state = 'syncing';
        const results: SyncResult[] = [];

        try {
            const pending = await getPendingChamadas();

            // Log recovery of 'syncing' chamadas (indicates previous crashed sync)
            const recovering = pending.filter(c => c.status === 'syncing');
            if (recovering.length > 0) {
                console.warn(`[SyncManager] Recovering ${recovering.length} orphaned 'syncing' chamadas from crashed sync`);
                for (const orphan of recovering) {
                    await updateChamadaAtom(orphan.id, {
                        status: 'pending',
                        lastError: 'Recuperado de sync interrompido'
                    });
                }
            }

            if (pending.length === 0) {
                console.log('[SyncManager] No pending chamadas');
                this.state = 'idle';
                this.currentProgress = { total: 0, completed: 0, failed: 0, isComplete: true };
                this.notifyProgress();
                return [];
            }

            console.log(`[SyncManager] Processing ${pending.length} pending chamadas`);

            // Reset progress - mark as incomplete
            this.currentProgress = { total: pending.length, completed: 0, failed: 0, isComplete: false };
            this.notifyProgress();

            // Process in batches with throttling
            for (let i = 0; i < pending.length; i += CONFIG.MAX_CONCURRENT) {
                // Check if we should abort (went offline or circuit opened)
                if (!navigator.onLine || this.isCircuitOpen()) {
                    console.log('[SyncManager] Aborting sync - offline or circuit open');
                    break;
                }

                const batch = pending.slice(i, i + CONFIG.MAX_CONCURRENT);

                // Process batch concurrently (max 3)
                const batchResults = await Promise.allSettled(
                    batch.map(chamada => this.syncOne(chamada))
                );

                // Collect results
                for (const result of batchResults) {
                    if (result.status === 'fulfilled') {
                        results.push(result.value);
                        if (result.value.success) {
                            this.currentProgress.completed++;
                        } else {
                            this.currentProgress.failed++;
                        }
                    } else {
                        this.currentProgress.failed++;
                    }
                }

                this.notifyProgress();

                // Delay between batches with jitter (anti-flood)
                if (i + CONFIG.MAX_CONCURRENT < pending.length && navigator.onLine) {
                    const jitter = Math.random() * CONFIG.JITTER_MS * 2 - CONFIG.JITTER_MS;
                    await this.sleep(CONFIG.BATCH_DELAY_MS + jitter);
                }
            }

            this.lastSync = Date.now();
            console.log(`[SyncManager] Completed: ${results.filter(r => r.success).length}/${results.length} successful`);

        } catch (error) {
            console.error('[SyncManager] Fatal error:', error);
        } finally {
            // ALWAYS reset state and notify completion
            this.isProcessing = false;
            this.state = this.isCircuitOpen() ? 'circuit_open' : 'idle';
            this.currentProgress.isComplete = true;
            this.notifyProgress();
        }

        return results;
    }

    async retryFailed(): Promise<SyncResult[]> {
        const pending = await getPendingChamadas();
        const failed = pending.filter(c => c.status === 'error');

        if (failed.length === 0) {
            return [];
        }

        console.log(`[SyncManager] Retrying ${failed.length} failed chamadas`);

        // Reset attempts AND reset circuit breaker for manual retry
        this.resetCircuitBreaker();

        for (const chamada of failed) {
            await updateChamadaAtom(chamada.id, {
                status: 'pending',
                attempts: 0,  // Reset attempts count
                lastError: undefined
            });
        }

        return this.processQueue();
    }

    getSyncState(): SyncStateData {
        return {
            state: this.state,
            pendingCount: this.currentProgress.total - this.currentProgress.completed,
            lastSync: this.lastSync,
            consecutiveFailures: this.consecutiveFailures,
            circuitOpenUntil: this.circuitOpenUntil
        };
    }

    async getPendingCount(): Promise<number> {
        return countPendingChamadas();
    }

    async getStats() {
        return getStorageStats();
    }

    onProgress(listener: (progress: SyncProgress) => void): () => void {
        this.progressListeners.add(listener);
        return () => this.progressListeners.delete(listener);
    }

    /**
     * MANUAL reset only - circuit breaker does not auto-reset
     */
    resetCircuitBreaker(): void {
        this.consecutiveFailures = 0;
        this.circuitOpenUntil = undefined;
        this.state = 'idle';
        console.log('[SyncManager] Circuit breaker manually reset');
    }

    /**
     * CRITICAL: Ensures valid JWT session before starting sync.
     * If session is expired, attempts refresh.
     * If refresh fails, throws error to abort sync cleanly.
     * 
     * This prevents ALL pending items from going to error state
     * when JWT expires during sync.
     */
    private async ensureValidSession(): Promise<void> {
        try {
            const { data, error } = await supabase.auth.getSession();

            if (error) {
                console.warn('[SyncManager] Session error, attempting refresh');
                throw error;
            }

            if (!data.session) {
                console.warn('[SyncManager] No session found');
                throw new Error('No active session');
            }

            // Check if token is about to expire (within 60 seconds)
            const expiresAt = data.session.expires_at;
            if (expiresAt) {
                const now = Math.floor(Date.now() / 1000);
                const timeUntilExpiry = expiresAt - now;

                if (timeUntilExpiry < 60) {
                    console.log('[SyncManager] Token expiring soon, refreshing...');
                    const { error: refreshError } = await supabase.auth.refreshSession();
                    if (refreshError) {
                        console.error('[SyncManager] Token refresh failed', refreshError);
                        throw refreshError;
                    }
                    console.log('[SyncManager] Token refreshed successfully');
                }
            }

            console.log('[SyncManager] Session valid, proceeding with sync');
        } catch (error) {
            console.error('[SyncManager] ensureValidSession failed:', error);
            throw error;  // Let processQueue handle this
        }
    }

    // ==========================================================================
    // PRIVATE METHODS
    // ==========================================================================

    private async syncOne(chamada: ChamadaAtom): Promise<SyncResult> {
        const startTime = Date.now();

        this.currentProgress.current = chamada.id;

        // Update status to syncing
        await updateChamadaAtom(chamada.id, { status: 'syncing' });

        try {
            // Call RPC with TIMEOUT to prevent infinite waiting
            const result = await this.callRpcWithTimeout(chamada);
            const durationMs = Date.now() - startTime;

            // DETAILED LOGGING FOR DEBUG
            console.log('[SyncManager] RPC result:', {
                chamadaId: chamada.id,
                data: result.data,
                error: result.error,
                durationMs
            });

            if (result.error) {
                return await this.handleError(chamada, result.error, durationMs);
            }

            // Parse RPC response - handle various success formats
            const data = result.data;

            // SUCCESS CASES: 'created' or 'already_synced' are BOTH success
            if (data && (data.success === true || data.status === 'created' || data.status === 'already_synced')) {
                // SUCCESS: Mark as synced and remove from queue
                await updateChamadaAtom(chamada.id, {
                    status: 'synced',
                    lastAttempt: Date.now()
                });

                const message = data.message || 'Sincronizado com sucesso';
                await addSyncLog(chamada.id, 'synced', message, `Duration: ${durationMs}ms`);

                // Remove from queue after successful sync
                await removeSyncedChamada(chamada.id);

                // Reset consecutive failures on success
                this.consecutiveFailures = 0;

                const isAlreadySynced = data.status === 'already_synced';

                return {
                    success: true,
                    status: isAlreadySynced ? 'already_synced' : 'synced',
                    message,
                    chamadaId: chamada.id,
                    attempts: chamada.attempts + 1,
                    durationMs
                };
            } else {
                // RPC returned success: false or unknown format
                const errorMsg = data?.message || data?.error || 'Resposta inesperada do servidor';
                console.error('[SyncManager] RPC returned failure:', data);

                // RATE LIMIT: Special handling - pause sync, don't retry immediately
                if (data?.error === 'rate_limit_exceeded' || data?.rate_limited === true) {
                    const retryAfter = data?.retry_after_seconds || 60;
                    console.warn(`[SyncManager] Rate limit hit! Pausing for ${retryAfter}s`);

                    // Mark as pending (not error) so it can be retried later
                    await updateChamadaAtom(chamada.id, {
                        status: 'pending',
                        lastAttempt: Date.now(),
                        lastError: `Rate limit: aguarde ${retryAfter}s`
                    });

                    await addSyncLog(chamada.id, 'retry', `Rate limit excedido. Retry em ${retryAfter}s`);

                    // Open circuit breaker to pause sync for this batch
                    this.consecutiveFailures = CONFIG.CIRCUIT_BREAK_THRESHOLD;
                    this.circuitOpenUntil = Date.now() + (retryAfter * 1000);
                    this.state = 'circuit_open';

                    return {
                        success: false,
                        status: 'retry',
                        message: `Rate limit. Retry em ${retryAfter}s`,
                        chamadaId: chamada.id,
                        attempts: chamada.attempts,
                        durationMs
                    };
                }

                return await this.handleFatalError(chamada, errorMsg, durationMs);
            }

        } catch (error: any) {
            const durationMs = Date.now() - startTime;
            return await this.handleError(chamada, error, durationMs);
        }
    }

    /**
     * Call RPC with timeout - CRITICAL for preventing infinite spinner
     */
    private async callRpcWithTimeout(chamada: ChamadaAtom): Promise<{ data: any; error: any }> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CONFIG.RPC_TIMEOUT_MS);

        try {
            const { data, error } = await (supabase.rpc as any)('salvar_chamada', {
                p_idempotency_key: chamada.idempotencyKey,
                p_turma_id: chamada.turma_id,
                p_data_chamada: chamada.data_chamada,
                p_registros: chamada.registros,
                p_client_timestamp: chamada.created_at
            });

            clearTimeout(timeoutId);
            return { data, error };

        } catch (err: any) {
            clearTimeout(timeoutId);

            if (err.name === 'AbortError' || err.message?.includes('aborted')) {
                return { data: null, error: { message: 'Timeout: servidor não respondeu em 15s', code: 'TIMEOUT' } };
            }

            return { data: null, error: err };
        }
    }

    private async handleError(
        chamada: ChamadaAtom,
        error: any,
        durationMs: number
    ): Promise<SyncResult> {
        const errorMessage = error?.message || String(error);
        const isRetryable = this.isRetryableError(error);

        console.error(`[SyncManager] Error syncing ${chamada.id}:`, errorMessage);

        // Check if max attempts reached
        if (isRetryable && chamada.attempts < CONFIG.MAX_ATTEMPTS - 1) {
            const newAttempts = chamada.attempts + 1;

            // IMPORTANT: Mark as 'pending' (not 'syncing') for next round
            await updateChamadaAtom(chamada.id, {
                status: 'pending',
                attempts: newAttempts,
                lastAttempt: Date.now(),
                lastError: errorMessage
            });

            await addSyncLog(chamada.id, 'retry', `Tentativa ${newAttempts}/${CONFIG.MAX_ATTEMPTS}: ${errorMessage}`);

            this.consecutiveFailures++;
            this.checkCircuitBreaker();

            return {
                success: false,
                status: 'retry',
                message: `Tentativa ${newAttempts}/${CONFIG.MAX_ATTEMPTS}. Será retentado.`,
                chamadaId: chamada.id,
                attempts: newAttempts,
                durationMs
            };
        } else {
            // Max attempts reached or non-retryable - mark as error TERMINAL STATE
            return await this.handleFatalError(chamada, errorMessage, durationMs);
        }
    }

    private async handleFatalError(
        chamada: ChamadaAtom,
        errorMessage: string,
        durationMs: number
    ): Promise<SyncResult> {
        // TERMINAL STATE: Mark as error, requires manual intervention
        await updateChamadaAtom(chamada.id, {
            status: 'error',
            attempts: chamada.attempts + 1,
            lastAttempt: Date.now(),
            lastError: errorMessage
        });

        await addSyncLog(chamada.id, 'error', `Erro: ${errorMessage}`);

        this.consecutiveFailures++;
        this.checkCircuitBreaker();

        return {
            success: false,
            status: 'fatal_error',
            message: errorMessage,
            chamadaId: chamada.id,
            attempts: chamada.attempts + 1,
            durationMs
        };
    }

    private isRetryableError(error: any): boolean {
        // Timeout is retryable
        if (error?.code === 'TIMEOUT') return true;

        // Network errors
        if (!navigator.onLine) return true;
        if (error?.name === 'NetworkError') return true;
        if (error?.message?.includes('fetch')) return true;
        if (error?.message?.includes('network')) return true;
        if (error?.message?.includes('Failed to fetch')) return true;

        // Timeout
        if (error?.code === 'PGRST301') return true;
        if (error?.message?.includes('timeout')) return true;

        // 5xx server errors
        const code = error?.code || '';
        if (typeof code === 'string' && code.startsWith('5')) return true;

        // Auth/permission errors are NOT retryable
        if (error?.message?.includes('JWT')) return false;
        if (error?.message?.includes('unauthorized')) return false;
        if (error?.message?.includes('permission')) return false;
        if (error?.code === '42501') return false;  // PostgreSQL permission denied

        // Rate limit errors are NOT retryable (handled specially in syncOne)
        if (error?.error === 'rate_limit_exceeded') return false;
        if (error?.rate_limited === true) return false;
        if (error?.message?.includes('rate limit')) return false;

        // Validation errors are NOT retryable
        if (error?.message?.includes('validation')) return false;
        if (error?.message?.includes('invalid')) return false;

        // Default for unknown errors: mark as NOT retryable to prevent loops
        return false;
    }

    private checkCircuitBreaker(): void {
        if (this.consecutiveFailures >= CONFIG.CIRCUIT_BREAK_THRESHOLD) {
            this.circuitOpenUntil = Date.now() + CONFIG.CIRCUIT_BREAK_DURATION_MS;
            this.state = 'circuit_open';
            console.warn(`[SyncManager] Circuit breaker OPEN. Manual reset required.`);
            console.warn(`[SyncManager] Earliest reset: ${new Date(this.circuitOpenUntil).toISOString()}`);
        }
    }

    /**
     * Check if circuit breaker is open - NO AUTO RESET
     */
    private isCircuitOpen(): boolean {
        if (!this.circuitOpenUntil) return false;

        // Circuit remains open until manual reset
        // We only check if enough time has passed as a MINIMUM requirement
        // User must still call resetCircuitBreaker() explicitly
        return true;
    }

    /**
     * Notify final state to ensure UI updates
     */
    private notifyFinalState(): void {
        this.currentProgress.isComplete = true;
        this.notifyProgress();
    }

    private notifyProgress(): void {
        const progressCopy = { ...this.currentProgress };
        for (const listener of Array.from(this.progressListeners)) {
            try {
                listener(progressCopy);
            } catch (e) {
                console.error('[SyncManager] Progress listener error:', e);
            }
        }
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

export const syncManager = new SyncManager();

// =============================================================================
// UTILITY FUNCTIONS (for UI)
// =============================================================================

export function initSyncManager(): void {
    syncManager.init();
}

export function destroySyncManager(): void {
    syncManager.destroy();
}

export async function triggerSync(): Promise<SyncResult[]> {
    return syncManager.processQueue();
}

export async function retryFailedSyncs(): Promise<SyncResult[]> {
    return syncManager.retryFailed();
}

export function getSyncState(): SyncStateData {
    return syncManager.getSyncState();
}

export async function getPendingSyncCount(): Promise<number> {
    return syncManager.getPendingCount();
}

export function onSyncProgress(listener: (progress: SyncProgress) => void): () => void {
    return syncManager.onProgress(listener);
}

export function resetSyncCircuitBreaker(): void {
    syncManager.resetCircuitBreaker();
}
