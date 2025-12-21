/**
 * Offline Module Index
 * 
 * Central export for all offline functionality.
 * Use this as the main entry point for offline features.
 */

// Core storage
export {
    // Types
    type ChamadaAtom,
    type RegistroPresenca,
    type SyncStatus,
    type SchoolCacheData,
    type ChamadaSession,
    type SyncLogEntry,
    type LegacyChamadaOffline,

    // Constants
    STORES,

    // Database
    openDatabase,
    closeDatabase,

    // Utilities
    generateUUID,
    generateIdempotencyKey,
    encrypt,
    decrypt,

    // ChamadaAtom operations
    createChamadaAtom,
    saveChamadaAtom,
    updateChamadaAtom,
    getChamadaAtom,
    getPendingChamadas,
    getAllChamadas,
    chamadaExists,
    removeSyncedChamada,
    countPendingChamadas,
    clearSyncedChamadas,

    // School cache operations
    saveSchoolCache,
    getSchoolCache,
    getCachedAlunosByTurma,
    getCachedTurmas,
    isCacheStale,
    clearSchoolCache,

    // Session operations
    saveSession,
    getSession,
    upsertSession,
    deleteSession,
    clearOldSessions,

    // Sync log
    addSyncLog,
    getLogsForChamada,
    clearOldLogs,

    // Utilities
    getStorageStats,
    clearAllOfflineData,
    performMaintenance
} from '../offlineStorage';

// Migration
export {
    performMigration,
    hasLegacyData,
    getMigrationStatus,
    type MigrationResult
} from '../offlineMigration';

// SyncManager
export {
    syncManager,
    initSyncManager,
    destroySyncManager,
    triggerSync,
    retryFailedSyncs,
    getSyncState,
    getPendingSyncCount,
    onSyncProgress,
    resetSyncCircuitBreaker,
    type SyncResult,
    type SyncProgress,
    type SyncManagerState
} from '../SyncManager';

// Re-export encryption for backward compatibility
export { encryptData, decryptData, isEncrypted } from '../encryption';
