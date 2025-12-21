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
    type SchoolCacheData
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
