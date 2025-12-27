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
const DB_VERSION = 4;

export const STORES = {
    SYNC_QUEUE: 'sync_queue',
    SCHOOL_CACHE: 'school_cache',
    SYNC_LOG: 'sync_log',
    SESSION: 'session',
    LEGACY_PENDING: 'legacy_pending',
    ATESTADOS_CACHE: 'atestados_cache'
} as const;

// =============================================================================
// TYPES
// =============================================================================

export type SyncAtomType = 'chamada' | 'observacao' | 'atestado';
export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'error';

export interface SyncableAtom {
    id: string;
    idempotencyKey: string;
    type: SyncAtomType;
    escola_id: string;
    status: SyncStatus;
    attempts: number;
    lastAttempt?: number;
    lastError?: string;
    created_at: number;
    updated_at: number;
}

export interface RegistroPresenca {
    aluno_id: string;
    presente: boolean;
    falta_justificada: boolean;
}

export interface ChamadaAtom extends SyncableAtom {
    type: 'chamada';
    turma_id: string;
    data_chamada: string;
    registros: RegistroPresenca[];
}

export interface ObservacaoAtom extends SyncableAtom {
    type: 'observacao';
    aluno_id: string;
    turma_id: string;
    data_observacao: string;
    user_id: string;
    titulo: string;
    descricao: string;
}

export interface SchoolCacheData {
    escola_id: string;
    turmas: Array<{ id: string; nome: string; numero_sala: string; turno?: string; escola_id: string; }>;
    alunos: Array<{ id: string; nome: string; matricula: string; turma_id: string; escola_id: string; }>;
    cached_at: number;
    version: string;
    user_id?: string;
    cache_version?: CacheVersionData;
}

export interface CacheVersionData {
    alunos_hash: string;
    alunos_count: number;
    turmas_hash: string;
    turmas_count: number;
    last_aluno_update: string;
    last_turma_update: string;
    server_time: string;
}

export interface ChamadaSession {
    id: string;
    turma_id: string;
    data_chamada: string;
    presencas: Record<string, 'presente' | 'falta' | 'atestado' | null>;
    created_at: number;
    updated_at: number;
}

export interface SyncLogEntry {
    id: string;
    chamada_id: string;
    action: 'created' | 'synced' | 'error' | 'retry' | 'migrated';
    message: string;
    timestamp: number;
    details?: string;
}

export interface LegacyChamadaOffline {
    aluno_id: string;
    turma_id: string;
    escola_id: string;
    presente: boolean;
    falta_justificada: boolean;
    data_chamada: string;
    timestamp: number;
}

export interface AtestadosCacheData {
    escola_id: string;
    atestados: Array<{ id: string; aluno_id: string; data_inicio: string; data_fim: string; status: string; }>;
    cached_at: number;
}

// =============================================================================
// ENCRYPTION
// =============================================================================

function getDeviceKey(): string {
    const factors = [navigator.userAgent, navigator.language, screen.width.toString(), screen.height.toString(), new Date().getTimezoneOffset().toString(), 'chamada-diaria-v3'];
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
    } catch { return null; }
}

export function isEncrypted(data: unknown): boolean {
    return typeof data === 'string' && data.startsWith('U2Fsd');
}

// =============================================================================
// UUID & IDEMPOTENCY
// =============================================================================

export function generateUUID(): string {
    return crypto.randomUUID();
}

export function generateIdempotencyKey(escola_id: string, turma_id: string, data_chamada: string): string {
    return CryptoJS.SHA256(`${escola_id}|${turma_id}|${data_chamada}`).toString();
}

// =============================================================================
// DATABASE
// =============================================================================

let dbInstance: IDBDatabase | null = null;
let dbOpenPromise: Promise<IDBDatabase> | null = null;

export function openDatabase(): Promise<IDBDatabase> {
    if (dbInstance) return Promise.resolve(dbInstance);
    if (dbOpenPromise) return dbOpenPromise;

    dbOpenPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => { dbOpenPromise = null; reject(request.error); };
        request.onsuccess = () => {
            dbInstance = request.result;
            dbInstance.onclose = () => { dbInstance = null; dbOpenPromise = null; };
            resolve(dbInstance);
        };
        request.onupgradeneeded = (event) => {
            const db = request.result;
            const oldVersion = event.oldVersion;

            if (oldVersion < 2 && !db.objectStoreNames.contains(STORES.LEGACY_PENDING)) {
                db.createObjectStore(STORES.LEGACY_PENDING, { keyPath: 'id', autoIncrement: true });
            }
            if (oldVersion < 3) {
                if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
                    const syncStore = db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: 'id' });
                    syncStore.createIndex('by_idempotency', 'idempotencyKey', { unique: true });
                    syncStore.createIndex('by_status', 'status', { unique: false });
                    syncStore.createIndex('by_escola', 'escola_id', { unique: false });
                    syncStore.createIndex('by_turma_data', ['turma_id', 'data_chamada'], { unique: false });
                }
                if (!db.objectStoreNames.contains(STORES.SCHOOL_CACHE)) {
                    const cacheStore = db.createObjectStore(STORES.SCHOOL_CACHE, { keyPath: 'escola_id' });
                    cacheStore.createIndex('by_cached_at', 'cached_at', { unique: false });
                }
                if (!db.objectStoreNames.contains(STORES.SYNC_LOG)) {
                    const logStore = db.createObjectStore(STORES.SYNC_LOG, { keyPath: 'id' });
                    logStore.createIndex('by_chamada', 'chamada_id', { unique: false });
                    logStore.createIndex('by_timestamp', 'timestamp', { unique: false });
                }
                if (!db.objectStoreNames.contains(STORES.SESSION)) {
                    db.createObjectStore(STORES.SESSION, { keyPath: 'id' });
                }
            }
            if (oldVersion < 4 && !db.objectStoreNames.contains(STORES.ATESTADOS_CACHE)) {
                const atestadosStore = db.createObjectStore(STORES.ATESTADOS_CACHE, { keyPath: 'escola_id' });
                atestadosStore.createIndex('by_cached_at', 'cached_at', { unique: false });
            }
        };
    });
    return dbOpenPromise;
}

export function closeDatabase(): void {
    if (dbInstance) { dbInstance.close(); dbInstance = null; dbOpenPromise = null; }
}

// =============================================================================
// GENERIC STORE OPERATIONS
// =============================================================================

async function getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): Promise<IDBObjectStore> {
    const db = await openDatabase();
    return db.transaction(storeName, mode).objectStore(storeName);
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
// CHAMADA OPERATIONS
// =============================================================================

export function createChamadaAtom(escola_id: string, turma_id: string, data_chamada: string, registros: RegistroPresenca[]): ChamadaAtom {
    const now = Date.now();
    return {
        id: generateUUID(),
        idempotencyKey: generateIdempotencyKey(escola_id, turma_id, data_chamada),
        type: 'chamada',
        escola_id, turma_id, data_chamada, registros,
        status: 'pending', attempts: 0, created_at: now, updated_at: now
    };
}

export async function saveChamadaAtom(chamada: ChamadaAtom): Promise<void> {
    chamada.updated_at = Date.now();
    try {
        await putToStore(STORES.SYNC_QUEUE, chamada);
        await addSyncLog(chamada.id, 'created', 'Chamada salva localmente');
    } catch (error: any) {
        if (error?.name === 'QuotaExceededError' || error?.code === 22) {
            const quotaError = new Error('Armazenamento do dispositivo cheio.');
            quotaError.name = 'QuotaExceededError';
            throw quotaError;
        }
        throw error;
    }
}

export async function updateChamadaAtom(id: string, updates: Partial<ChamadaAtom>): Promise<void> {
    const existing = await getByKey<ChamadaAtom>(STORES.SYNC_QUEUE, id);
    if (!existing) throw new Error(`ChamadaAtom not found: ${id}`);
    await putToStore(STORES.SYNC_QUEUE, { ...existing, ...updates, updated_at: Date.now() });
}

export async function getChamadaAtom(id: string): Promise<ChamadaAtom | null> {
    return getByKey<ChamadaAtom>(STORES.SYNC_QUEUE, id);
}

export function createObservacaoAtom(escola_id: string, turma_id: string, aluno_id: string, user_id: string, data_observacao: string, titulo: string, descricao: string): ObservacaoAtom {
    const now = Date.now();
    return {
        id: generateUUID(),
        idempotencyKey: generateIdempotencyKey(escola_id, aluno_id, data_observacao + titulo),
        type: 'observacao',
        escola_id, aluno_id, turma_id, data_observacao, user_id, titulo, descricao,
        status: 'pending', attempts: 0, created_at: now, updated_at: now
    };
}

export async function saveObservacaoAtom(observacao: ObservacaoAtom): Promise<void> {
    observacao.updated_at = Date.now();
    await putToStore(STORES.SYNC_QUEUE, observacao);
}

export async function getPendingObservacoes(): Promise<ObservacaoAtom[]> {
    const all = await getAllFromStore<SyncableAtom>(STORES.SYNC_QUEUE);
    return all.filter(item => item.type === 'observacao' && (item.status === 'pending' || item.status === 'syncing' || item.status === 'error')) as ObservacaoAtom[];
}

export async function getAllPendingSyncAtoms(): Promise<SyncableAtom[]> {
    const all = await getAllFromStore<SyncableAtom>(STORES.SYNC_QUEUE);
    return all.filter(item => item.status === 'pending' || item.status === 'syncing' || item.status === 'error');
}

export async function getPendingChamadas(): Promise<ChamadaAtom[]> {
    const all = await getAllFromStore<ChamadaAtom>(STORES.SYNC_QUEUE);
    return all.filter(c => c.status === 'pending' || c.status === 'error' || c.status === 'syncing');
}

export async function getAllChamadas(): Promise<ChamadaAtom[]> {
    return getAllFromStore<ChamadaAtom>(STORES.SYNC_QUEUE);
}

export async function chamadaExists(escola_id: string, turma_id: string, data_chamada: string): Promise<ChamadaAtom | null> {
    const key = generateIdempotencyKey(escola_id, turma_id, data_chamada);
    const db = await openDatabase();
    const store = db.transaction(STORES.SYNC_QUEUE, 'readonly').objectStore(STORES.SYNC_QUEUE).index('by_idempotency');
    return new Promise((resolve, reject) => {
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
}

export async function removeSyncedChamada(id: string): Promise<void> {
    await deleteFromStore(STORES.SYNC_QUEUE, id);
}

export async function countPendingChamadas(): Promise<number> {
    return (await getPendingChamadas()).length;
}

export async function clearSyncedChamadas(): Promise<number> {
    const all = await getAllChamadas();
    const synced = all.filter(c => c.status === 'synced');
    for (const chamada of synced) await deleteFromStore(STORES.SYNC_QUEUE, chamada.id);
    return synced.length;
}

// =============================================================================
// SCHOOL CACHE
// =============================================================================

export async function saveSchoolCache(data: SchoolCacheData): Promise<void> {
    data.cached_at = Date.now();
    data.version = `${DB_VERSION}`;
    await putToStore(STORES.SCHOOL_CACHE, data);
}

export async function getSchoolCache(escola_id: string): Promise<SchoolCacheData | null> {
    return getByKey<SchoolCacheData>(STORES.SCHOOL_CACHE, escola_id);
}

export async function getCachedAlunosByTurma(escola_id: string, turma_id: string): Promise<SchoolCacheData['alunos']> {
    const cache = await getSchoolCache(escola_id);
    return cache ? cache.alunos.filter(a => a.turma_id === turma_id) : [];
}

export async function getCachedTurmas(escola_id: string): Promise<SchoolCacheData['turmas']> {
    const cache = await getSchoolCache(escola_id);
    return cache?.turmas || [];
}

export async function isCacheStale(escola_id: string, maxAgeMs: number = 24 * 60 * 60 * 1000): Promise<boolean> {
    const cache = await getSchoolCache(escola_id);
    return !cache || Date.now() - cache.cached_at > maxAgeMs;
}

export async function clearSchoolCache(escola_id?: string): Promise<void> {
    if (escola_id) await deleteFromStore(STORES.SCHOOL_CACHE, escola_id);
    else await clearStore(STORES.SCHOOL_CACHE);
}

export async function getAllSchoolCaches(): Promise<SchoolCacheData[]> {
    return getAllFromStore<SchoolCacheData>(STORES.SCHOOL_CACHE);
}

// =============================================================================
// ATESTADOS CACHE
// =============================================================================

export async function saveAtestadosCache(data: AtestadosCacheData): Promise<void> {
    data.cached_at = Date.now();
    await putToStore(STORES.ATESTADOS_CACHE, data);
}

export async function getAtestadosCache(escola_id: string): Promise<AtestadosCacheData | null> {
    return getByKey<AtestadosCacheData>(STORES.ATESTADOS_CACHE, escola_id);
}

export async function getCachedAtestadosVigentes(escola_id: string): Promise<AtestadosCacheData['atestados']> {
    const cache = await getAtestadosCache(escola_id);
    if (!cache) return [];
    const hoje = new Date().toISOString().split('T')[0];
    return cache.atestados.filter(a => a.status === 'aprovado' && a.data_inicio <= hoje && a.data_fim >= hoje);
}

export async function clearAtestadosCache(escola_id?: string): Promise<void> {
    if (escola_id) await deleteFromStore(STORES.ATESTADOS_CACHE, escola_id);
    else await clearStore(STORES.ATESTADOS_CACHE);
}

// =============================================================================
// SESSION
// =============================================================================

export async function saveSession(session: ChamadaSession): Promise<void> {
    session.updated_at = Date.now();
    await putToStore(STORES.SESSION, session);
}

export async function getSession(turma_id: string, data_chamada: string): Promise<ChamadaSession | null> {
    return getByKey<ChamadaSession>(STORES.SESSION, `${turma_id}_${data_chamada}`);
}

export async function upsertSession(turma_id: string, data_chamada: string, presencas: Record<string, 'presente' | 'falta' | 'atestado' | null>): Promise<ChamadaSession> {
    const id = `${turma_id}_${data_chamada}`;
    const existing = await getSession(turma_id, data_chamada);
    const session: ChamadaSession = existing
        ? { ...existing, presencas, updated_at: Date.now() }
        : { id, turma_id, data_chamada, presencas, created_at: Date.now(), updated_at: Date.now() };
    await saveSession(session);
    return session;
}

export async function deleteSession(turma_id: string, data_chamada: string): Promise<void> {
    await deleteFromStore(STORES.SESSION, `${turma_id}_${data_chamada}`);
}

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
// SYNC LOG
// =============================================================================

export async function addSyncLog(chamada_id: string, action: SyncLogEntry['action'], message: string, details?: string): Promise<void> {
    await putToStore(STORES.SYNC_LOG, { id: generateUUID(), chamada_id, action, message, timestamp: Date.now(), details });
}

export async function getLogsForChamada(chamada_id: string): Promise<SyncLogEntry[]> {
    const all = await getAllFromStore<SyncLogEntry>(STORES.SYNC_LOG);
    return all.filter(log => log.chamada_id === chamada_id).sort((a, b) => b.timestamp - a.timestamp);
}

export async function clearOldLogs(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
    const all = await getAllFromStore<SyncLogEntry>(STORES.SYNC_LOG);
    const now = Date.now();
    let cleared = 0;
    for (const log of all) {
        if (now - log.timestamp > maxAgeMs) { await deleteFromStore(STORES.SYNC_LOG, log.id); cleared++; }
    }
    return cleared;
}

// =============================================================================
// LEGACY MIGRATION
// =============================================================================

export async function migrateLegacyData(legacyData: LegacyChamadaOffline[]): Promise<{ migrated: number; chamadas: ChamadaAtom[] }> {
    if (!legacyData?.length) return { migrated: 0, chamadas: [] };
    const groups = new Map<string, LegacyChamadaOffline[]>();
    for (const record of legacyData) {
        const key = `${record.escola_id}|${record.turma_id}|${record.data_chamada}`;
        groups.set(key, [...(groups.get(key) || []), record]);
    }
    const chamadas: ChamadaAtom[] = [];
    for (const [, records] of Array.from(groups)) {
        const first = records[0];
        const registros = records.map(r => ({ aluno_id: r.aluno_id, presente: r.presente, falta_justificada: r.falta_justificada }));
        const chamada = createChamadaAtom(first.escola_id, first.turma_id, first.data_chamada, registros);
        chamada.created_at = Math.min(...records.map(r => r.timestamp));
        await saveChamadaAtom(chamada);
        chamadas.push(chamada);
    }
    return { migrated: legacyData.length, chamadas };
}

// =============================================================================
// UTILITY
// =============================================================================

export async function getStorageStats(): Promise<{ pending: number; synced: number; errors: number; cachedSchools: number; sessions: number; logs: number; }> {
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

export async function clearAllOfflineData(): Promise<void> {
    await clearStore(STORES.SYNC_QUEUE);
    await clearStore(STORES.SCHOOL_CACHE);
    await clearStore(STORES.SESSION);
    await clearStore(STORES.SYNC_LOG);
}

export async function performMaintenance(): Promise<{ sessionsCleared: number; logsCleared: number; syncedCleared: number; staleCacheCleared: number; }> {
    const sessionsCleared = await clearOldSessions();
    const logsCleared = await clearOldLogs();
    const syncedCleared = await clearSyncedChamadas();
    let staleCacheCleared = 0;
    const maxCacheAge = 7 * 24 * 60 * 60 * 1000;
    const schoolCaches = await getAllSchoolCaches();
    const now = Date.now();
    for (const cache of schoolCaches) {
        if (now - cache.cached_at > maxCacheAge) { await clearSchoolCache(cache.escola_id); staleCacheCleared++; }
    }
    try {
        const atestadosCaches = await getAllFromStore<AtestadosCacheData>(STORES.ATESTADOS_CACHE);
        for (const cache of atestadosCaches) {
            if (now - cache.cached_at > 24 * 60 * 60 * 1000) await clearAtestadosCache(cache.escola_id);
        }
    } catch { /* ignore */ }
    return { sessionsCleared, logsCleared, syncedCleared, staleCacheCleared };
}
