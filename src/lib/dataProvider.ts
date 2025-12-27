/**
 * DataProvider v1.0
 * 
 * 🚨 SOVEREIGN DATA LAYER - ÚNICA CAMADA AUTORIZADA A ACESSAR SUPABASE
 * 
 * Regras:
 * 1. Hooks NUNCA acessam Supabase diretamente
 * 2. Services NUNCA acessam Supabase para leitura
 * 3. Toda leitura passa por aqui
 * 
 * Fluxo OFFLINE-FIRST:
 * - Se offline → ler SOMENTE do IndexedDB
 * - Se online → tentar Supabase, fallback para IndexedDB
 * - Sempre atualizar cache após sucesso online
 */

import { supabase } from '@/integrations/supabase/client';
import {
    getSchoolCache,
    getCachedTurmas,
    getCachedAlunosByTurma,
    saveSchoolCache,
    getAllSchoolCaches,
    clearSchoolCache,
    type SchoolCacheData,
    type CacheVersionData
} from './offlineStorage';

// =============================================================================
// TYPES
// =============================================================================

export interface TurmaData {
    id: string;
    nome: string;
    numero_sala: string;
    turno?: string | null;
    escola_id: string;
}

export interface AlunoData {
    id: string;
    nome: string;
    matricula: string;
    turma_id: string;
    escola_id: string;
}

export interface PresencaData {
    id?: string;
    aluno_id: string;
    turma_id: string;
    escola_id: string;
    data_chamada: string;
    presente: boolean;
    justificada?: boolean;
}

export interface DataProviderResult<T> {
    data: T;
    source: 'cache' | 'network';
    stale: boolean;
}

export interface CacheCheckResult {
    needsRefresh: boolean;
    reason?: 'hash_mismatch' | 'no_cache' | 'network_error' | 'count_mismatch';
    serverVersion?: CacheVersionData;
}

// =============================================================================
// HELPER: Check if truly online (not just navigator.onLine)
// =============================================================================

async function isReallyOnline(): Promise<boolean> {
    if (!navigator.onLine) return false;

    // Quick ping test - optional for faster response
    // If Supabase is slow, we still try and fallback
    return true;
}

// =============================================================================
// CACHE VERSIONING (ETag pattern)
// =============================================================================

/**
 * Check cache version against server and invalidate if stale
 * 
 * Call this on app open/refocus to ensure cache is up-to-date
 * without using Realtime subscriptions (avoids thundering herd)
 */
export async function checkAndInvalidateCache(escolaId: string): Promise<CacheCheckResult> {
    if (!navigator.onLine) {
        return { needsRefresh: false, reason: 'network_error' };
    }

    try {
        // Get current cache
        const cache = await getSchoolCache(escolaId);

        // Get server version (cast to any since RPC not in generated types yet)
        const { data, error } = await (supabase.rpc as any)('get_cache_version', { p_escola_id: escolaId });

        if (error) {
            console.warn('[DataProvider] get_cache_version error:', error);
            return { needsRefresh: false, reason: 'network_error' };
        }

        const serverVersion = data as unknown as CacheVersionData;

        // No local cache → needs refresh
        if (!cache || !cache.cache_version) {
            console.log('[DataProvider] No cache or version, needs refresh');
            return { needsRefresh: true, reason: 'no_cache', serverVersion };
        }

        // Compare hashes
        const localVersion = cache.cache_version;

        if (localVersion.alunos_hash !== serverVersion.alunos_hash) {
            console.log('[DataProvider] Alunos hash mismatch, invalidating cache');
            await clearSchoolCache(escolaId);
            return { needsRefresh: true, reason: 'hash_mismatch', serverVersion };
        }

        if (localVersion.turmas_hash !== serverVersion.turmas_hash) {
            console.log('[DataProvider] Turmas hash mismatch, invalidating cache');
            await clearSchoolCache(escolaId);
            return { needsRefresh: true, reason: 'hash_mismatch', serverVersion };
        }

        // Count sanity check
        if (localVersion.alunos_count !== serverVersion.alunos_count ||
            localVersion.turmas_count !== serverVersion.turmas_count) {
            console.log('[DataProvider] Count mismatch, invalidating cache');
            await clearSchoolCache(escolaId);
            return { needsRefresh: true, reason: 'count_mismatch', serverVersion };
        }

        console.log('[DataProvider] Cache is up-to-date');
        return { needsRefresh: false, serverVersion };

    } catch (err: any) {
        console.warn('[DataProvider] Cache check failed:', err.message);
        return { needsRefresh: false, reason: 'network_error' };
    }
}

// =============================================================================
// BIDIRECTIONAL SYNC (Server → Client)
// =============================================================================

export interface ServerChange {
    id: string;
    entity_type: 'aluno' | 'turma';
    entity_id: string;
    operation: 'INSERT' | 'UPDATE' | 'DELETE';
    changed_at: string;
}

export interface FetchChangesResult {
    success: boolean;
    changes: ServerChange[];
    serverTime: string;
    error?: string;
}

/**
 * Fetch server-side changes since last sync.
 * 
 * Used for bidirectional sync - detects when alunos/turmas were
 * added, updated, or deleted on the server (by admin, other device, etc.)
 * 
 * @param escolaId - School ID to fetch changes for
 * @param since - ISO timestamp of last sync (stored in cache)
 * @returns Changes list and new server time to store
 */
export async function fetchServerChanges(
    escolaId: string,
    since: string
): Promise<FetchChangesResult> {
    if (!navigator.onLine) {
        return { success: false, changes: [], serverTime: '', error: 'offline' };
    }

    try {
        const { data, error } = await (supabase.rpc as any)('get_changes_since', {
            p_escola_id: escolaId,
            p_since: since
        });

        if (error) {
            console.warn('[DataProvider] get_changes_since error:', error);
            return { success: false, changes: [], serverTime: '', error: error.message };
        }

        if (!data?.success) {
            return { success: false, changes: [], serverTime: '', error: data?.error || 'unknown' };
        }

        console.log(`[DataProvider] Found ${data.changes?.length || 0} server changes since ${since}`);

        return {
            success: true,
            changes: data.changes || [],
            serverTime: data.server_time
        };

    } catch (err: any) {
        console.warn('[DataProvider] fetchServerChanges failed:', err.message);
        return { success: false, changes: [], serverTime: '', error: err.message };
    }
}

/**
 * Apply server changes to local cache.
 * 
 * For INSERT/UPDATE: Re-fetches the entity and updates cache
 * For DELETE: Removes from cache
 */
export async function applyServerChanges(
    escolaId: string,
    changes: ServerChange[]
): Promise<{ applied: number; errors: number }> {
    if (changes.length === 0) return { applied: 0, errors: 0 };

    const cache = await getSchoolCache(escolaId);
    if (!cache) {
        console.log('[DataProvider] No cache to apply changes to');
        return { applied: 0, errors: 0 };
    }

    let applied = 0;
    let errors = 0;

    for (const change of changes) {
        try {
            if (change.entity_type === 'aluno') {
                if (change.operation === 'DELETE') {
                    cache.alunos = cache.alunos.filter(a => a.id !== change.entity_id);
                    applied++;
                } else {
                    // Fetch updated aluno
                    const { data } = await supabase
                        .from('alunos')
                        .select('id, nome, matricula, turma_id, escola_id')
                        .eq('id', change.entity_id)
                        .single();

                    if (data) {
                        const idx = cache.alunos.findIndex(a => a.id === change.entity_id);
                        if (idx >= 0) {
                            cache.alunos[idx] = data;
                        } else {
                            cache.alunos.push(data);
                        }
                        applied++;
                    }
                }
            } else if (change.entity_type === 'turma') {
                if (change.operation === 'DELETE') {
                    cache.turmas = cache.turmas.filter(t => t.id !== change.entity_id);
                    applied++;
                } else {
                    const { data } = await supabase
                        .from('turmas')
                        .select('id, nome, numero_sala, turno, escola_id')
                        .eq('id', change.entity_id)
                        .single();

                    if (data) {
                        const idx = cache.turmas.findIndex(t => t.id === change.entity_id);
                        if (idx >= 0) {
                            cache.turmas[idx] = data;
                        } else {
                            cache.turmas.push(data);
                        }
                        applied++;
                    }
                }
            }
        } catch (err) {
            console.warn('[DataProvider] Failed to apply change:', change, err);
            errors++;
        }
    }

    // Save updated cache
    await saveSchoolCache(cache);
    console.log(`[DataProvider] Applied ${applied} changes, ${errors} errors`);

    return { applied, errors };
}

// =============================================================================
// TURMAS
// =============================================================================

/**
 * Get turmas for a school - OFFLINE-FIRST
 * 
 * Flow:
 * 1. If offline → return IndexedDB cache
 * 2. If online → try Supabase, update cache, return
 * 3. On error → fallback to IndexedDB cache
 */
export async function getTurmas(escolaId: string): Promise<DataProviderResult<TurmaData[]>> {
    // OFFLINE: Read from cache only
    if (!navigator.onLine) {
        console.log('[DataProvider] Offline - reading turmas from cache');
        const cached = await getCachedTurmas(escolaId);
        return {
            data: cached as TurmaData[],
            source: 'cache',
            stale: true
        };
    }

    // ONLINE: Try Supabase with fallback
    try {
        const { data, error } = await supabase
            .from('turmas')
            .select('id, nome, numero_sala, turno, escola_id')
            .eq('escola_id', escolaId)
            .order('nome');

        if (error) throw error;

        // Update cache in background
        updateTurmasCache(escolaId, data || []).catch(console.error);

        return {
            data: (data || []) as TurmaData[],
            source: 'network',
            stale: false
        };
    } catch (error) {
        console.warn('[DataProvider] Supabase error, falling back to cache:', error);

        const cached = await getCachedTurmas(escolaId);
        return {
            data: cached as TurmaData[],
            source: 'cache',
            stale: true
        };
    }
}

/**
 * Get turmas with student count - OFFLINE-FIRST
 */
export async function getTurmasWithCount(escolaId: string): Promise<DataProviderResult<(TurmaData & { alunos: number })[]>> {
    // OFFLINE: Read from cache only
    if (!navigator.onLine) {
        console.log('[DataProvider] Offline - reading turmas with count from cache');
        const cache = await getSchoolCache(escolaId);

        if (!cache) {
            return { data: [], source: 'cache', stale: true };
        }

        // Calculate counts from cached alunos
        const turmasWithCount = cache.turmas.map(turma => ({
            ...turma,
            alunos: cache.alunos.filter(a => a.turma_id === turma.id).length
        }));

        return {
            data: turmasWithCount as (TurmaData & { alunos: number })[],
            source: 'cache',
            stale: true
        };
    }

    // ONLINE: Try Supabase with fallback
    try {
        const { data: turmas, error: turmasError } = await supabase
            .from('turmas')
            .select('id, nome, numero_sala, turno, escola_id')
            .eq('escola_id', escolaId)
            .order('nome');

        if (turmasError) throw turmasError;

        // Get counts in parallel
        const turmaIds = (turmas || []).map(t => t.id);

        if (turmaIds.length === 0) {
            return { data: [], source: 'network', stale: false };
        }

        // Count alunos per turma
        const { data: alunos, error: alunosError } = await supabase
            .from('alunos')
            .select('turma_id')
            .in('turma_id', turmaIds);

        if (alunosError) throw alunosError;

        // Build count map
        const countMap = new Map<string, number>();
        (alunos || []).forEach(a => {
            countMap.set(a.turma_id, (countMap.get(a.turma_id) || 0) + 1);
        });

        const turmasWithCount = (turmas || []).map(t => ({
            ...t,
            alunos: countMap.get(t.id) || 0
        }));

        // Update cache in background
        updateTurmasCache(escolaId, turmas || []).catch(console.error);

        return {
            data: turmasWithCount as (TurmaData & { alunos: number })[],
            source: 'network',
            stale: false
        };
    } catch (error) {
        console.warn('[DataProvider] Supabase error, falling back to cache:', error);

        const cache = await getSchoolCache(escolaId);

        if (!cache) {
            return { data: [], source: 'cache', stale: true };
        }

        const turmasWithCount = cache.turmas.map(turma => ({
            ...turma,
            alunos: cache.alunos.filter(a => a.turma_id === turma.id).length
        }));

        return {
            data: turmasWithCount as (TurmaData & { alunos: number })[],
            source: 'cache',
            stale: true
        };
    }
}

// =============================================================================
// ALUNOS
// =============================================================================

/**
 * Get alunos by turma - OFFLINE-FIRST
 */
export async function getAlunosByTurma(turmaId: string, escolaId?: string): Promise<DataProviderResult<AlunoData[]>> {
    // OFFLINE: Read from cache only
    if (!navigator.onLine) {
        console.log('[DataProvider] Offline - reading alunos from cache');

        // Try to find escola_id from any cached school
        let cachedAlunos: AlunoData[] = [];

        if (escolaId) {
            cachedAlunos = await getCachedAlunosByTurma(escolaId, turmaId) as AlunoData[];
        } else {
            // Search all caches (less efficient but works)
            const allCaches = await getAllSchoolCaches();
            for (const cache of allCaches) {
                const found = cache.alunos.filter(a => a.turma_id === turmaId);
                if (found.length > 0) {
                    cachedAlunos = found as AlunoData[];
                    break;
                }
            }
        }

        return {
            data: cachedAlunos.sort((a, b) => a.nome.localeCompare(b.nome)),
            source: 'cache',
            stale: true
        };
    }

    // ONLINE: Try Supabase with fallback
    try {
        const { data, error } = await supabase
            .from('alunos')
            .select('id, nome, matricula, turma_id, escola_id')
            .eq('turma_id', turmaId)
            .order('nome');

        if (error) throw error;

        // Update cache in background if we have escola_id
        if (data && data.length > 0 && data[0].escola_id) {
            updateAlunosCache(data[0].escola_id, turmaId, data).catch(console.error);
        }

        return {
            data: (data || []) as AlunoData[],
            source: 'network',
            stale: false
        };
    } catch (error) {
        console.warn('[DataProvider] Supabase error, falling back to cache:', error);

        let cachedAlunos: AlunoData[] = [];

        if (escolaId) {
            cachedAlunos = await getCachedAlunosByTurma(escolaId, turmaId) as AlunoData[];
        }

        return {
            data: cachedAlunos.sort((a, b) => a.nome.localeCompare(b.nome)),
            source: 'cache',
            stale: true
        };
    }
}

/**
 * Get single turma by ID - OFFLINE-FIRST
 */
export async function getTurmaById(turmaId: string): Promise<DataProviderResult<TurmaData | null>> {
    // OFFLINE: Search all caches
    if (!navigator.onLine) {
        console.log('[DataProvider] Offline - searching turma in cache');

        const allCaches = await getAllSchoolCaches();
        for (const cache of allCaches) {
            const found = cache.turmas.find(t => t.id === turmaId);
            if (found) {
                return { data: found as TurmaData, source: 'cache', stale: true };
            }
        }

        return { data: null, source: 'cache', stale: true };
    }

    // ONLINE
    try {
        const { data, error } = await supabase
            .from('turmas')
            .select('id, nome, numero_sala, turno, escola_id')
            .eq('id', turmaId)
            .single();

        if (error) throw error;

        return {
            data: data as TurmaData,
            source: 'network',
            stale: false
        };
    } catch (error) {
        console.warn('[DataProvider] Supabase error, falling back to cache:', error);

        const allCaches = await getAllSchoolCaches();
        for (const cache of allCaches) {
            const found = cache.turmas.find(t => t.id === turmaId);
            if (found) {
                return { data: found as TurmaData, source: 'cache', stale: true };
            }
        }

        return { data: null, source: 'cache', stale: true };
    }
}

// =============================================================================
// PRESENCAS (for reading historical data)
// =============================================================================

/**
 * Get presencas by turma and date - OFFLINE-FIRST
 * Note: This is for READING historical data only.
 * Writing presencas goes through presenca.service.ts → IndexedDB → SyncManager
 */
export async function getPresencasByTurmaData(
    turmaId: string,
    dataChamada: string
): Promise<DataProviderResult<PresencaData[]>> {
    // OFFLINE: We don't cache historical presencas in v1
    // Return empty array - presencas are write-first, read from server
    if (!navigator.onLine) {
        console.log('[DataProvider] Offline - presencas not available (server-only read)');
        return {
            data: [],
            source: 'cache',
            stale: true
        };
    }

    // ONLINE
    try {
        const { data, error } = await supabase
            .from('presencas')
            .select('id, aluno_id, turma_id, escola_id, data_chamada, presente, justificada')
            .eq('turma_id', turmaId)
            .eq('data_chamada', dataChamada);

        if (error) throw error;

        return {
            data: (data || []) as PresencaData[],
            source: 'network',
            stale: false
        };
    } catch (error) {
        console.warn('[DataProvider] Error fetching presencas:', error);
        return {
            data: [],
            source: 'cache',
            stale: true
        };
    }
}

/**
 * Get all presencas for a turma (historical) - OFFLINE-FIRST
 */
export async function getPresencasByTurma(turmaId: string): Promise<DataProviderResult<PresencaData[]>> {
    if (!navigator.onLine) {
        console.log('[DataProvider] Offline - historical presencas not available');
        return { data: [], source: 'cache', stale: true };
    }

    try {
        const { data, error } = await supabase
            .from('presencas')
            .select('id, aluno_id, turma_id, escola_id, data_chamada, presente, justificada')
            .eq('turma_id', turmaId);

        if (error) throw error;

        return {
            data: (data || []) as PresencaData[],
            source: 'network',
            stale: false
        };
    } catch (error) {
        console.warn('[DataProvider] Error fetching presencas:', error);
        return { data: [], source: 'cache', stale: true };
    }
}

// =============================================================================
// CACHE SYNC
// =============================================================================

/**
 * Sync all school data to IndexedDB cache
 * Call this when user clicks "Baixar Dados"
 */
export async function syncSchoolCache(escolaId: string, userId?: string): Promise<{
    turmasCount: number;
    alunosCount: number;
}> {
    if (!navigator.onLine) {
        throw new Error('Offline - não é possível baixar dados');
    }

    // Fetch turmas
    const { data: turmas, error: turmasError } = await supabase
        .from('turmas')
        .select('id, nome, numero_sala, turno, escola_id')
        .eq('escola_id', escolaId);

    if (turmasError) throw turmasError;

    if (!turmas || turmas.length === 0) {
        return { turmasCount: 0, alunosCount: 0 };
    }

    // Fetch all alunos for these turmas
    const turmaIds = turmas.map(t => t.id);
    const { data: alunos, error: alunosError } = await supabase
        .from('alunos')
        .select('id, nome, matricula, turma_id, escola_id')
        .in('turma_id', turmaIds);

    if (alunosError) throw alunosError;

    // Save to IndexedDB
    const cacheData: SchoolCacheData = {
        escola_id: escolaId,
        turmas: turmas.map(t => ({
            id: t.id,
            nome: t.nome,
            numero_sala: t.numero_sala || '',
            turno: t.turno,
            escola_id: t.escola_id
        })),
        alunos: (alunos || []).map(a => ({
            id: a.id,
            nome: a.nome,
            matricula: a.matricula,
            turma_id: a.turma_id,
            escola_id: a.escola_id
        })),
        cached_at: Date.now(),
        version: '3',
        user_id: userId
    };

    await saveSchoolCache(cacheData);

    console.log('[DataProvider] School cache synced:', {
        turmas: turmas.length,
        alunos: alunos?.length || 0
    });

    return {
        turmasCount: turmas.length,
        alunosCount: alunos?.length || 0
    };
}

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

async function updateTurmasCache(escolaId: string, turmas: any[]): Promise<void> {
    try {
        const existing = await getSchoolCache(escolaId);

        await saveSchoolCache({
            escola_id: escolaId,
            turmas: turmas.map(t => ({
                id: t.id,
                nome: t.nome,
                numero_sala: t.numero_sala || '',
                turno: t.turno,
                escola_id: t.escola_id
            })),
            alunos: existing?.alunos || [],
            cached_at: Date.now(),
            version: '3',
            user_id: existing?.user_id
        });
    } catch (error) {
        console.error('[DataProvider] Failed to update turmas cache:', error);
    }
}

async function updateAlunosCache(escolaId: string, turmaId: string, alunos: any[]): Promise<void> {
    try {
        const existing = await getSchoolCache(escolaId);

        // Merge alunos: replace only for this turma
        const otherAlunos = (existing?.alunos || []).filter(a => a.turma_id !== turmaId);
        const newAlunos = [
            ...otherAlunos,
            ...alunos.map(a => ({
                id: a.id,
                nome: a.nome,
                matricula: a.matricula,
                turma_id: a.turma_id,
                escola_id: a.escola_id
            }))
        ];

        await saveSchoolCache({
            escola_id: escolaId,
            turmas: existing?.turmas || [],
            alunos: newAlunos,
            cached_at: Date.now(),
            version: '3',
            user_id: existing?.user_id
        });
    } catch (error) {
        console.error('[DataProvider] Failed to update alunos cache:', error);
    }
}

// getAllSchoolCaches is now imported from offlineStorage
