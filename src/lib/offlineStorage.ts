/**
 * Offline Storage Module v3.0
 * 
 * Professional IndexedDB implementation for ChamadaDiária.
 * Features:
 * - ChamadaAtom: atomic unit (turma + data)
 * - Versioned schema with migrations
 * - Encrypted storage (LGPD compliance)
 * - Backward compatibility with legacy data
 */

import * as CryptoJS from 'crypto-js';

// =============================================================================
// DATABASE CONFIGURATION
// =============================================================================

const DB_NAME = 'chamada-diaria-db';
const DB_VERSION = 3; // Increment for schema changes

// Store names
export const STORES = {
    SYNC_QUEUE: 'sync_queue',        // Chamadas pending sync
    SCHOOL_CACHE: 'school_cache',    // Turmas + Alunos cached
    SYNC_LOG: 'sync_log',            // Audit log for debugging
    SESSION: 'session',              // Current session drafts
    LEGACY_PENDING: 'legacy_pending' // Old format for migration
} as const;

// =============================================================================
// TYPES
// =============================================================================

/** Status of a chamada in the sync queue */
export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'error';

/** Single attendance record within a chamada */
export interface RegistroPresenca {
    aluno_id: string;
    presente: boolean;
    falta_justificada: boolean;
}

/**
 * ChamadaAtom - Atomic unit of synchronization
 * Represents a complete attendance call for one class on one day
 */
export interface ChamadaAtom {
    // Primary identification
    id: string;                      // UUID v4 generated client-side
    idempotencyKey: string;          // SHA-256(escola_id + turma_id + data_chamada)

    // Context
    escola_id: string;
    turma_id: string;
    data_chamada: string;            // YYYY-MM-DD format

    // Payload
    registros: RegistroPresenca[];

    // Sync state
    status: SyncStatus;
    attempts: number;
    lastAttempt?: number;            // Timestamp of last sync attempt
    lastError?: string;              // Last error message

    // Metadata
    created_at: number;              // Timestamp when created locally
    updated_at: number;              // Timestamp of last update
}

/** School cache data structure */
export interface SchoolCacheData {
    escola_id: string;
    turmas: Array<{
        id: string;
        nome: string;
        numero_sala: string;
        turno?: string;
        escola_id: string;
    }>;
    alunos: Array<{
        id: string;
        nome: string;
        matricula: string;
        turma_id: string;
        escola_id: string;
    }>;
    cached_at: number;
    version: string;
    user_id?: string;
}

/** Session draft (in-progress chamada) */
export interface ChamadaSession {
    id: string;
    turma_id: string;
    data_chamada: string;
    presencas: Record<string, 'presente' | 'falta' | 'atestado' | null>;
    created_at: number;
    updated_at: number;
}

/** Sync log entry for auditing */
export interface SyncLogEntry {
    id: string;
    chamada_id: string;
    action: 'created' | 'synced' | 'error' | 'retry' | 'migrated';
    message: string;
    timestamp: number;
    details?: string;
}

/** Legacy format (for migration) */
export interface LegacyChamadaOffline {
    aluno_id: string;
    turma_id: string;
    escola_id: string;
    presente: boolean;
    falta_justificada: boolean;
    data_chamada: string;
    timestamp: number;
}

// =============================================================================
// ENCRYPTION (Device Key)
// =============================================================================

function getDeviceKey(): string {
    const factors = [
        navigator.userAgent,
        navigator.language,
        screen.width.toString(),
        screen.height.toString(),
        new Date().getTimezoneOffset().toString(),
        'chamada-diaria-v3'
    ];
    return CryptoJS.SHA256(factors.join('|')).toString();
}

let cachedKey: string | null = null;
function getKey(): string {
    if (!cachedKey) cachedKey = getDeviceKey();
    return cachedKey;
}

export function encrypt<T>(data: T): string {
    return CryptoJS.AES.encrypt(JSON.stringify(data), getKey()).toString();
}

export function decrypt<T>(encrypted: string): T | null {
    try {
        const bytes = CryptoJS.AES.decrypt(encrypted, getKey());
        const json = bytes.toString(CryptoJS.enc.Utf8);
        if (!json) return null;
        return JSON.parse(json) as T;
    } catch {
        return null;
    }
}

export function isEncrypted(data: unknown): boolean {
    return typeof data === 'string' && data.startsWith('U2Fsd');
}

// =============================================================================
// UUID & IDEMPOTENCY KEY GENERATION
// =============================================================================

export function generateUUID(): string {
    return crypto.randomUUID();
}

export function generateIdempotencyKey(
    escola_id: string,
    turma_id: string,
    data_chamada: string
): string {
    const payload = `${escola_id}|${turma_id}|${data_chamada}`;
    return CryptoJS.SHA256(payload).toString();
}

// =============================================================================
// DATABASE INSTANCE
// =============================================================================

let dbInstance: IDBDatabase | null = null;
let dbOpenPromise: Promise<IDBDatabase> | null = null;

/**
 * Opens the IndexedDB database with proper schema versioning
 */
export function openDatabase(): Promise<IDBDatabase> {
    // Return existing instance if available
    if (dbInstance) {
        return Promise.resolve(dbInstance);
    }

    // Return existing promise if open is in progress
    if (dbOpenPromise) {
        return dbOpenPromise;
    }

    dbOpenPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('[OfflineDB] Failed to open database:', request.error);
            dbOpenPromise = null;
            reject(request.error);
        };

        request.onsuccess = () => {
            dbInstance = request.result;

            // Handle connection close
            dbInstance.onclose = () => {
                dbInstance = null;
                dbOpenPromise = null;
            };

            console.log('[OfflineDB] Database opened successfully, version:', DB_VERSION);
            resolve(dbInstance);
        };

        request.onupgradeneeded = (event) => {
            const db = request.result;
            const oldVersion = event.oldVersion;

            console.log(`[OfflineDB] Upgrading from v${oldVersion} to v${DB_VERSION}`);

            // =====================================================================
            // Version 1: Initial schema (legacy - no longer used directly)
            // =====================================================================

            // =====================================================================
            // Version 2: Legacy migration store
            // =====================================================================
            if (oldVersion < 2) {
                // Store for legacy data that needs migration
                if (!db.objectStoreNames.contains(STORES.LEGACY_PENDING)) {
                    db.createObjectStore(STORES.LEGACY_PENDING, { keyPath: 'id', autoIncrement: true });
                }
            }

            // =====================================================================
            // Version 3: Full ChamadaAtom schema
            // =====================================================================
            if (oldVersion < 3) {
                // Sync Queue - ChamadaAtom storage
                if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
                    const syncStore = db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: 'id' });
                    syncStore.createIndex('by_idempotency', 'idempotencyKey', { unique: true });
                    syncStore.createIndex('by_status', 'status', { unique: false });
                    syncStore.createIndex('by_escola', 'escola_id', { unique: false });
                    syncStore.createIndex('by_turma_data', ['turma_id', 'data_chamada'], { unique: false });
                }

                // School Cache - Turmas + Alunos
                if (!db.objectStoreNames.contains(STORES.SCHOOL_CACHE)) {
                    const cacheStore = db.createObjectStore(STORES.SCHOOL_CACHE, { keyPath: 'escola_id' });
                    cacheStore.createIndex('by_cached_at', 'cached_at', { unique: false });
                }

                // Sync Log - Audit trail
                if (!db.objectStoreNames.contains(STORES.SYNC_LOG)) {
                    const logStore = db.createObjectStore(STORES.SYNC_LOG, { keyPath: 'id' });
                    logStore.createIndex('by_chamada', 'chamada_id', { unique: false });
                    logStore.createIndex('by_timestamp', 'timestamp', { unique: false });
                }

                // Session - Draft chamadas
                if (!db.objectStoreNames.contains(STORES.SESSION)) {
                    db.createObjectStore(STORES.SESSION, { keyPath: 'id' });
                }
            }
        };
    });

    return dbOpenPromise;
}

/**
 * Close database connection
 */
export function closeDatabase(): void {
    if (dbInstance) {
        dbInstance.close();
        dbInstance = null;
        dbOpenPromise = null;
    }
}

// =============================================================================
// GENERIC STORE OPERATIONS
// =============================================================================

async function getStore(
    storeName: string,
    mode: IDBTransactionMode = 'readonly'
): Promise<IDBObjectStore> {
    const db = await openDatabase();
    const tx = db.transaction(storeName, mode);
    return tx.objectStore(storeName);
}

async function getAllFromStore<T>(storeName: string): Promise<T[]> {
    const store = await getStore(storeName);
    return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
}

async function getByKey<T>(storeName: string, key: IDBValidKey): Promise<T | null> {
    const store = await getStore(storeName);
    return new Promise((resolve, reject) => {
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
}

async function putToStore<T>(storeName: string, data: T): Promise<void> {
    const store = await getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
        const request = store.put(data);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

async function deleteFromStore(storeName: string, key: IDBValidKey): Promise<void> {
    const store = await getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
        const request = store.delete(key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

async function clearStore(storeName: string): Promise<void> {
    const store = await getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

async function countInStore(storeName: string): Promise<number> {
    const store = await getStore(storeName);
    return new Promise((resolve, reject) => {
        const request = store.count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// =============================================================================
// SYNC QUEUE OPERATIONS (ChamadaAtom)
// =============================================================================

/**
 * Creates a new ChamadaAtom from attendance data
 */
export function createChamadaAtom(
    escola_id: string,
    turma_id: string,
    data_chamada: string,
    registros: RegistroPresenca[]
): ChamadaAtom {
    const now = Date.now();
    return {
        id: generateUUID(),
        idempotencyKey: generateIdempotencyKey(escola_id, turma_id, data_chamada),
        escola_id,
        turma_id,
        data_chamada,
        registros,
        status: 'pending',
        attempts: 0,
        created_at: now,
        updated_at: now
    };
}

/**
 * Saves a ChamadaAtom to the sync queue
 * 
 * CRITICAL: Handles QuotaExceededError explicitly to prevent silent data loss.
 * If storage is full, throws a clear error that must be shown to the user.
 */
export async function saveChamadaAtom(chamada: ChamadaAtom): Promise<void> {
    chamada.updated_at = Date.now();

    try {
        await putToStore(STORES.SYNC_QUEUE, chamada);
        await addSyncLog(chamada.id, 'created', 'Chamada salva localmente');
        console.log('[OfflineDB] ChamadaAtom saved:', chamada.id);
    } catch (error: any) {
        // CRITICAL: QuotaExceededError = storage full = DATA LOSS RISK
        if (error?.name === 'QuotaExceededError' ||
            error?.message?.includes('QuotaExceeded') ||
            error?.code === 22) {  // DOMException code for quota exceeded
            console.error('[OfflineDB] CRITICAL: Storage quota exceeded!');
            const quotaError = new Error(
                'Armazenamento do dispositivo cheio. Conecte à internet para sincronizar e liberar espaço.'
            );
            quotaError.name = 'QuotaExceededError';
            throw quotaError;
        }
        // Re-throw other errors
        throw error;
    }
}

/**
 * Updates an existing ChamadaAtom
 */
export async function updateChamadaAtom(
    id: string,
    updates: Partial<ChamadaAtom>
): Promise<void> {
    const existing = await getByKey<ChamadaAtom>(STORES.SYNC_QUEUE, id);
    if (!existing) {
        throw new Error(`ChamadaAtom not found: ${id}`);
    }

    const updated: ChamadaAtom = {
        ...existing,
        ...updates,
        updated_at: Date.now()
    };

    await putToStore(STORES.SYNC_QUEUE, updated);
}

/**
 * Gets a ChamadaAtom by ID
 */
export async function getChamadaAtom(id: string): Promise<ChamadaAtom | null> {
    return getByKey<ChamadaAtom>(STORES.SYNC_QUEUE, id);
}

/**
 * Gets all pending chamadas
 * 
 * CRITICAL: Also includes 'syncing' status to recover from crashed syncs.
 * If app crashes/reloads during sync, chamadas may be stuck in 'syncing'.
 * Including them here ensures they get reprocessed on next sync.
 */
export async function getPendingChamadas(): Promise<ChamadaAtom[]> {
    const all = await getAllFromStore<ChamadaAtom>(STORES.SYNC_QUEUE);
    // Include 'syncing' to recover from interrupted syncs (reload/crash)
    return all.filter(c =>
        c.status === 'pending' ||
        c.status === 'error' ||
        c.status === 'syncing'  // ← CRITICAL: orphan recovery
    );
}

/**
 * Gets all chamadas in the queue
 */
export async function getAllChamadas(): Promise<ChamadaAtom[]> {
    return getAllFromStore<ChamadaAtom>(STORES.SYNC_QUEUE);
}

/**
 * Checks if a chamada already exists (by idempotency key)
 */
export async function chamadaExists(
    escola_id: string,
    turma_id: string,
    data_chamada: string
): Promise<ChamadaAtom | null> {
    const key = generateIdempotencyKey(escola_id, turma_id, data_chamada);
    const db = await openDatabase();
    const tx = db.transaction(STORES.SYNC_QUEUE, 'readonly');
    const store = tx.objectStore(STORES.SYNC_QUEUE);
    const index = store.index('by_idempotency');

    return new Promise((resolve, reject) => {
        const request = index.get(key);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Deletes a synced chamada from the queue
 */
export async function removeSyncedChamada(id: string): Promise<void> {
    await deleteFromStore(STORES.SYNC_QUEUE, id);
    console.log('[OfflineDB] ChamadaAtom removed:', id);
}

/**
 * Counts pending chamadas
 */
export async function countPendingChamadas(): Promise<number> {
    const pending = await getPendingChamadas();
    return pending.length;
}

/**
 * Clears all synced chamadas (keeps pending)
 */
export async function clearSyncedChamadas(): Promise<number> {
    const all = await getAllChamadas();
    const synced = all.filter(c => c.status === 'synced');

    for (const chamada of synced) {
        await deleteFromStore(STORES.SYNC_QUEUE, chamada.id);
    }

    return synced.length;
}

// =============================================================================
// SCHOOL CACHE OPERATIONS
// =============================================================================

/**
 * Saves school data to cache
 */
export async function saveSchoolCache(data: SchoolCacheData): Promise<void> {
    data.cached_at = Date.now();
    data.version = `${DB_VERSION}`;
    await putToStore(STORES.SCHOOL_CACHE, data);
    console.log('[OfflineDB] School cache saved:', data.escola_id);
}

/**
 * Gets cached school data
 */
export async function getSchoolCache(escola_id: string): Promise<SchoolCacheData | null> {
    return getByKey<SchoolCacheData>(STORES.SCHOOL_CACHE, escola_id);
}

/**
 * Gets cached alunos for a turma
 */
export async function getCachedAlunosByTurma(
    escola_id: string,
    turma_id: string
): Promise<SchoolCacheData['alunos']> {
    const cache = await getSchoolCache(escola_id);
    if (!cache) return [];
    return cache.alunos.filter(a => a.turma_id === turma_id);
}

/**
 * Gets cached turmas
 */
export async function getCachedTurmas(escola_id: string): Promise<SchoolCacheData['turmas']> {
    const cache = await getSchoolCache(escola_id);
    return cache?.turmas || [];
}

/**
 * Checks if cache is stale (older than maxAge in ms)
 */
export async function isCacheStale(
    escola_id: string,
    maxAgeMs: number = 24 * 60 * 60 * 1000 // 24 hours default
): Promise<boolean> {
    const cache = await getSchoolCache(escola_id);
    if (!cache) return true;
    return Date.now() - cache.cached_at > maxAgeMs;
}

/**
 * Clears school cache
 */
export async function clearSchoolCache(escola_id?: string): Promise<void> {
    if (escola_id) {
        await deleteFromStore(STORES.SCHOOL_CACHE, escola_id);
    } else {
        await clearStore(STORES.SCHOOL_CACHE);
    }
}

// =============================================================================
// SESSION OPERATIONS (Draft Chamadas)
// =============================================================================

/**
 * Saves a chamada session (draft in progress)
 */
export async function saveSession(session: ChamadaSession): Promise<void> {
    session.updated_at = Date.now();
    await putToStore(STORES.SESSION, session);
}

/**
 * Gets a session by turma_id + data
 */
export async function getSession(turma_id: string, data_chamada: string): Promise<ChamadaSession | null> {
    const id = `${turma_id}_${data_chamada}`;
    return getByKey<ChamadaSession>(STORES.SESSION, id);
}

/**
 * Creates or updates a session
 */
export async function upsertSession(
    turma_id: string,
    data_chamada: string,
    presencas: Record<string, 'presente' | 'falta' | 'atestado' | null>
): Promise<ChamadaSession> {
    const id = `${turma_id}_${data_chamada}`;
    const existing = await getSession(turma_id, data_chamada);

    const session: ChamadaSession = existing
        ? { ...existing, presencas, updated_at: Date.now() }
        : {
            id,
            turma_id,
            data_chamada,
            presencas,
            created_at: Date.now(),
            updated_at: Date.now()
        };

    await saveSession(session);
    return session;
}

/**
 * Deletes a session after chamada is saved
 */
export async function deleteSession(turma_id: string, data_chamada: string): Promise<void> {
    const id = `${turma_id}_${data_chamada}`;
    await deleteFromStore(STORES.SESSION, id);
}

/**
 * Clears all sessions older than maxAge
 */
export async function clearOldSessions(maxAgeMs: number = 24 * 60 * 60 * 1000): Promise<number> {
    const all = await getAllFromStore<ChamadaSession>(STORES.SESSION);
    const now = Date.now();
    let cleared = 0;

    for (const session of all) {
        if (now - session.updated_at > maxAgeMs) {
            await deleteFromStore(STORES.SESSION, session.id);
            cleared++;
        }
    }

    return cleared;
}

// =============================================================================
// SYNC LOG OPERATIONS (Auditing)
// =============================================================================

/**
 * Adds an entry to the sync log
 */
export async function addSyncLog(
    chamada_id: string,
    action: SyncLogEntry['action'],
    message: string,
    details?: string
): Promise<void> {
    const entry: SyncLogEntry = {
        id: generateUUID(),
        chamada_id,
        action,
        message,
        timestamp: Date.now(),
        details
    };

    await putToStore(STORES.SYNC_LOG, entry);
}

/**
 * Gets logs for a specific chamada
 */
export async function getLogsForChamada(chamada_id: string): Promise<SyncLogEntry[]> {
    const all = await getAllFromStore<SyncLogEntry>(STORES.SYNC_LOG);
    return all
        .filter(log => log.chamada_id === chamada_id)
        .sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Clears old logs (older than maxAge)
 */
export async function clearOldLogs(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
    const all = await getAllFromStore<SyncLogEntry>(STORES.SYNC_LOG);
    const now = Date.now();
    let cleared = 0;

    for (const log of all) {
        if (now - log.timestamp > maxAgeMs) {
            await deleteFromStore(STORES.SYNC_LOG, log.id);
            cleared++;
        }
    }

    return cleared;
}

// =============================================================================
// LEGACY MIGRATION
// =============================================================================

/**
 * Migrates legacy per-aluno data to ChamadaAtom format
 * Call this once on app startup to handle old data
 */
export async function migrateLegacyData(
    legacyData: LegacyChamadaOffline[]
): Promise<{ migrated: number; chamadas: ChamadaAtom[] }> {
    if (!legacyData || legacyData.length === 0) {
        return { migrated: 0, chamadas: [] };
    }

    console.log('[OfflineDB] Migrating legacy data:', legacyData.length, 'records');

    // Group by escola + turma + data
    const groups = new Map<string, LegacyChamadaOffline[]>();

    for (const record of legacyData) {
        const key = `${record.escola_id}|${record.turma_id}|${record.data_chamada}`;
        const existing = groups.get(key) || [];
        existing.push(record);
        groups.set(key, existing);
    }

    // Convert each group to ChamadaAtom
    const chamadas: ChamadaAtom[] = [];

    for (const [, records] of Array.from(groups)) {
        const first = records[0];
        const registros: RegistroPresenca[] = records.map(r => ({
            aluno_id: r.aluno_id,
            presente: r.presente,
            falta_justificada: r.falta_justificada
        }));

        const chamada = createChamadaAtom(
            first.escola_id,
            first.turma_id,
            first.data_chamada,
            registros
        );

        // Preserve original timestamp
        chamada.created_at = Math.min(...records.map(r => r.timestamp));

        await saveChamadaAtom(chamada);
        await addSyncLog(chamada.id, 'migrated', `Migrado de ${records.length} registros legados`);

        chamadas.push(chamada);
    }

    console.log('[OfflineDB] Migration complete:', chamadas.length, 'ChamadaAtoms created');

    return { migrated: legacyData.length, chamadas };
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Gets storage statistics
 */
export async function getStorageStats(): Promise<{
    pending: number;
    synced: number;
    errors: number;
    cachedSchools: number;
    sessions: number;
    logs: number;
}> {
    const chamadas = await getAllChamadas();

    return {
        pending: chamadas.filter(c => c.status === 'pending').length,
        synced: chamadas.filter(c => c.status === 'synced').length,
        errors: chamadas.filter(c => c.status === 'error').length,
        cachedSchools: await countInStore(STORES.SCHOOL_CACHE),
        sessions: await countInStore(STORES.SESSION),
        logs: await countInStore(STORES.SYNC_LOG)
    };
}

/**
 * Clears all offline data (for logout)
 */
export async function clearAllOfflineData(): Promise<void> {
    await clearStore(STORES.SYNC_QUEUE);
    await clearStore(STORES.SCHOOL_CACHE);
    await clearStore(STORES.SESSION);
    await clearStore(STORES.SYNC_LOG);
    console.log('[OfflineDB] All offline data cleared');
}

/**
 * Performs maintenance (clear old data)
 */
export async function performMaintenance(): Promise<{
    sessionsCleared: number;
    logsCleared: number;
    syncedCleared: number;
}> {
    const sessionsCleared = await clearOldSessions();
    const logsCleared = await clearOldLogs();
    const syncedCleared = await clearSyncedChamadas();

    console.log('[OfflineDB] Maintenance complete:', { sessionsCleared, logsCleared, syncedCleared });

    return { sessionsCleared, logsCleared, syncedCleared };
}

/**
 * Gets all cached schools from IndexedDB
 */
export async function getAllSchoolCaches(): Promise<SchoolCacheData[]> {
    return getAllFromStore<SchoolCacheData>(STORES.SCHOOL_CACHE);
}

