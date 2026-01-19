/**
 * OfflineManager Component v2.0
 * 
 * REFATORADO para usar SyncManager exclusivamente.
 * 
 * Regras:
 * ❌ NÃO acessa IndexedDB diretamente
 * ❌ NÃO calcula pendências manualmente
 * ✅ Usa apenas API pública do SyncManager
 * ✅ Atualiza UI via onSyncProgress
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAuth } from '@/contexts/AuthContext';
import { SyncStatusBadge, type SyncState } from './SyncStatusBadge';

// SyncManager API
import {
  syncManager,
  onSyncProgress,
  triggerSync,
  retryFailedSyncs,
  getPendingSyncCount,
  type SyncProgress
} from '@/lib/SyncManager';

// School cache download (still uses offlineStorage directly for caching)
import { saveSchoolCache, type SchoolCacheData } from '@/lib/offlineStorage';
import { supabase } from '@/integrations/supabase/client';

const OfflineManager: React.FC = () => {
  const { user } = useAuth();

  // State
  const [syncState, setSyncState] = useState<SyncState>('synced');
  const [pendingCount, setPendingCount] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isDownloading, setIsDownloading] = useState(false);

  // ===========================================================================
  // SYNC STATE MANAGEMENT
  // ===========================================================================

  const updateSyncState = useCallback(async () => {
    try {
      const count = await getPendingSyncCount();
      setPendingCount(count);

      const state = syncManager.getSyncState();

      if (state.state === 'syncing') {
        setSyncState('syncing');
      } else if (count === 0) {
        setSyncState('synced');
      } else if (state.state === 'circuit_open') {
        setSyncState('error');
      } else {
        // Has pending items
        setSyncState(isOnline ? 'syncing' : 'saved-local');
      }
    } catch (err) {
      console.error('[OfflineManager] Error checking sync state:', err);
    }
  }, [isOnline]);

  // ===========================================================================
  // EFFECTS
  // ===========================================================================

  // Subscribe to sync progress
  useEffect(() => {
    const unsubscribe = onSyncProgress((progress: SyncProgress) => {
      const remaining = progress.total - progress.completed - progress.failed;
      setPendingCount(remaining > 0 ? remaining : progress.failed);

      // Check isComplete flag - CRITICAL to prevent infinite syncing
      if (progress.isComplete) {
        // Sync round is done - determine final state
        const state = syncManager.getSyncState();

        if (state.state === 'circuit_open') {
          setSyncState('error');
        } else if (progress.failed > 0) {
          setSyncState('error');
        } else if (progress.total === 0 || remaining === 0) {
          setSyncState('synced');
        } else {
          // Still has pending but round is done
          setSyncState(isOnline ? 'saved-local' : 'saved-local');
        }
      } else {
        // Still syncing
        setSyncState('syncing');
      }
    });

    return unsubscribe;
  }, [isOnline]);

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Trigger sync when coming online
      triggerSync();
      updateSyncState();
    };

    const handleOffline = () => {
      setIsOnline(false);
      updateSyncState();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial state check
    updateSyncState();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [updateSyncState]);

  // Listen for new chamadas (custom event from ChamadaPage)
  useEffect(() => {
    const handleNewChamada = () => {
      updateSyncState();
    };

    window.addEventListener('chamada-salva', handleNewChamada);
    return () => window.removeEventListener('chamada-salva', handleNewChamada);
  }, [updateSyncState]);

  // ===========================================================================
  // HANDLERS
  // ===========================================================================

  const handleRetrySync = async () => {
    toast({ description: "Tentando sincronizar novamente..." });

    try {
      const results = await retryFailedSyncs();
      const successful = results.filter(r => r.success).length;

      if (successful > 0) {
        toast({
          title: "Sincronização concluída!",
          description: `${successful} chamada(s) sincronizada(s).`,
          className: "bg-green-100 border-green-500 text-green-800"
        });
      }

      await updateSyncState();
    } catch (err) {
      toast({
        title: "Erro",
        description: "Falha ao sincronizar. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const handleDownloadData = async () => {
    if (!user?.escola_id) {
      toast({
        title: "Erro",
        description: "Escola não identificada.",
        variant: "destructive"
      });
      return;
    }

    setIsDownloading(true);

    try {
      // Verificar se já tem dados em cache
      const { getSchoolCache } = await import('@/lib/offlineStorage');
      const existingCache = await getSchoolCache(user.escola_id);

      if (existingCache && existingCache.turmas && existingCache.turmas.length > 0) {
        const cacheAge = Date.now() - (existingCache.cached_at || 0);
        const cacheAgeMinutes = Math.round(cacheAge / (1000 * 60));

        // Se cache tem menos de 30 minutos, apenas informa que já está atualizado
        if (cacheAgeMinutes < 30) {
          toast({
            title: "Dados já baixados",
            description: `${existingCache.turmas.length} turmas e ${existingCache.alunos?.length || 0} alunos já estão disponíveis offline. Baixado há ${cacheAgeMinutes} min.`,
          });
          setIsDownloading(false);
          return;
        }
      }

      // Baixar novos dados
      const { syncSchoolCache } = await import('@/lib/dataProvider');
      const result = await syncSchoolCache(user.escola_id, user.id);

      if (result.turmasCount === 0) {
        toast({ description: "Nenhuma turma encontrada." });
        setIsDownloading(false);
        return;
      }

      toast({
        title: "Dados atualizados!",
        description: `${result.turmasCount} turmas e ${result.alunosCount} alunos prontos para uso offline.`,
        className: "bg-green-100 border-green-500 text-green-800"
      });

    } catch (error) {
      console.error('[OfflineManager] Download error:', error);
      toast({
        title: "Erro",
        description: "Falha ao baixar dados.",
        variant: "destructive"
      });
    } finally {
      setIsDownloading(false);
    }
  };

  // ===========================================================================
  // RENDER
  // ===========================================================================

  // Don't show anything if synced and online (clean state)
  const showStatus = pendingCount > 0 || syncState === 'error' || !isOnline;

  return (
    <div className="flex items-center gap-2">
      {/* Download button (only when online) */}
      {isOnline && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownloadData}
          disabled={isDownloading}
          className="gap-2 border-purple-200 hover:bg-purple-50 text-purple-700"
          title="Baixar turmas para usar offline"
        >
          {isDownloading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">Baixar Dados</span>
        </Button>
      )}

      {/* Sync status badge */}
      {showStatus && (
        <SyncStatusBadge
          state={syncState}
          pendingCount={pendingCount}
          onClick={syncState === 'error' ? handleRetrySync : undefined}
        />
      )}
    </div>
  );
};

export default OfflineManager;