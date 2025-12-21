/**
 * GlobalSyncStatus Component v1.0
 * 
 * Fixed-position indicator showing sync status at all times.
 * PASSIVE component - only reads status, never modifies.
 * 
 * States:
 * 🟢 Online (synced) - hidden by default
 * 🟡 Offline (dados locais)
 * 🔵 Sincronizando
 * 🔴 Sync pausado (rate limit / erro)
 */

import React, { useState, useEffect, useCallback, memo } from 'react';
import {
    Wifi,
    WifiOff,
    Cloud,
    CloudOff,
    Loader2,
    AlertCircle,
    Check
} from 'lucide-react';
import {
    syncManager,
    onSyncProgress,
    getPendingSyncCount,
    type SyncProgress
} from '@/lib/SyncManager';

type GlobalStatus = 'online' | 'offline' | 'syncing' | 'paused' | 'error';

interface StatusConfig {
    icon: React.ElementType;
    label: string;
    bgColor: string;
    textColor: string;
    pulse?: boolean;
}

const STATUS_CONFIG: Record<GlobalStatus, StatusConfig> = {
    online: {
        icon: Check,
        label: 'Sincronizado',
        bgColor: 'bg-green-500',
        textColor: 'text-white'
    },
    offline: {
        icon: WifiOff,
        label: 'Offline',
        bgColor: 'bg-amber-500',
        textColor: 'text-white'
    },
    syncing: {
        icon: Loader2,
        label: 'Sincronizando',
        bgColor: 'bg-blue-500',
        textColor: 'text-white',
        pulse: true
    },
    paused: {
        icon: AlertCircle,
        label: 'Sync pausado',
        bgColor: 'bg-orange-500',
        textColor: 'text-white'
    },
    error: {
        icon: AlertCircle,
        label: 'Erro de sync',
        bgColor: 'bg-red-500',
        textColor: 'text-white'
    }
};

const GlobalSyncStatus: React.FC = memo(() => {
    const [status, setStatus] = useState<GlobalStatus>('online');
    const [pendingCount, setPendingCount] = useState(0);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [visible, setVisible] = useState(false);

    // Determine global status from various inputs
    const updateStatus = useCallback(async () => {
        try {
            const count = await getPendingSyncCount();
            setPendingCount(count);

            const state = syncManager.getSyncState();

            if (!navigator.onLine) {
                setStatus('offline');
                setVisible(true);
            } else if (state.state === 'syncing') {
                setStatus('syncing');
                setVisible(true);
            } else if (state.state === 'circuit_open') {
                setStatus('paused');
                setVisible(true);
            } else if (count > 0) {
                setStatus('syncing');
                setVisible(true);
            } else {
                setStatus('online');
                // Hide after brief display on sync complete
                setTimeout(() => setVisible(false), 2000);
            }
        } catch {
            // Fail silently
        }
    }, []);

    // Subscribe to sync progress
    useEffect(() => {
        const unsubscribe = onSyncProgress((progress: SyncProgress) => {
            const remaining = progress.total - progress.completed - progress.failed;
            setPendingCount(remaining > 0 ? remaining : progress.failed);

            if (progress.isComplete) {
                const state = syncManager.getSyncState();
                if (state.state === 'circuit_open') {
                    setStatus('paused');
                    setVisible(true);
                } else if (progress.failed > 0) {
                    setStatus('error');
                    setVisible(true);
                } else if (remaining === 0) {
                    setStatus('online');
                    // Brief visibility then hide
                    setVisible(true);
                    setTimeout(() => setVisible(false), 2000);
                }
            } else {
                setStatus('syncing');
                setVisible(true);
            }
        });

        return unsubscribe;
    }, []);

    // Online/offline events
    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            updateStatus();
        };

        const handleOffline = () => {
            setIsOnline(false);
            setStatus('offline');
            setVisible(true);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Initial check
        updateStatus();

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [updateStatus]);

    // Listen for chamada-salva
    useEffect(() => {
        const handleChamadaSalva = () => updateStatus();
        window.addEventListener('chamada-salva', handleChamadaSalva);
        return () => window.removeEventListener('chamada-salva', handleChamadaSalva);
    }, [updateStatus]);

    // Don't render if not visible
    if (!visible) return null;

    const config = STATUS_CONFIG[status];
    const Icon = config.icon;

    return (
        <div
            className={`
                fixed bottom-4 right-4 z-50
                flex items-center gap-2 px-3 py-2 rounded-full shadow-lg
                ${config.bgColor} ${config.textColor}
                transition-all duration-300 ease-in-out
                animate-in slide-in-from-right-5
            `}
            role="status"
            aria-live="polite"
        >
            <Icon
                className={`h-4 w-4 ${config.pulse ? 'animate-spin' : ''}`}
            />
            <span className="text-sm font-medium">
                {config.label}
                {pendingCount > 0 && status !== 'online' && (
                    <span className="ml-1 opacity-90">({pendingCount})</span>
                )}
            </span>
        </div>
    );
});

GlobalSyncStatus.displayName = 'GlobalSyncStatus';

export default GlobalSyncStatus;
