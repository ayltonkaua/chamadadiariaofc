/**
 * useOfflineToast Hook v1.0
 * 
 * Provides user confidence when saving offline by showing 
 * non-intrusive toasts that confirm data is safely stored.
 * 
 * Phase 4: UX Offline (Confidence)
 * 
 * Features:
 * - "Salvo no dispositivo" toast when saving offline
 * - Pending chamadas indicator
 * - Non-blocking (passive UI)
 */

import { useCallback, useRef } from 'react';
import { toast } from '@/hooks/use-toast';
import { Cloud, CloudOff, Check, AlertCircle } from 'lucide-react';

export type OfflineToastType =
    | 'saved-offline'
    | 'synced'
    | 'sync-paused'
    | 'pending-count';

interface ToastOptions {
    pendingCount?: number;
    message?: string;
}

/**
 * Hook for showing offline-related toasts
 * 
 * Usage:
 * const { showOfflineToast } = useOfflineToast();
 * showOfflineToast('saved-offline'); // Shows "Salvo no dispositivo"
 */
export function useOfflineToast() {
    // Debounce to prevent toast spam
    const lastToastRef = useRef<number>(0);
    const DEBOUNCE_MS = 2000;

    const showOfflineToast = useCallback((type: OfflineToastType, options?: ToastOptions) => {
        const now = Date.now();

        // Debounce: don't show same toast type too quickly
        if (now - lastToastRef.current < DEBOUNCE_MS) {
            return;
        }
        lastToastRef.current = now;

        switch (type) {
            case 'saved-offline':
                toast({
                    title: "✓ Salvo no dispositivo",
                    description: "Será enviado automaticamente quando a conexão voltar.",
                    className: "bg-amber-50 border-amber-200 text-amber-900",
                    duration: 3000,
                });
                break;

            case 'synced':
                toast({
                    title: "✓ Sincronizado",
                    description: options?.message || "Dados enviados com sucesso.",
                    className: "bg-green-50 border-green-200 text-green-900",
                    duration: 2000,
                });
                break;

            case 'sync-paused':
                toast({
                    title: "⏸ Sincronização pausada",
                    description: options?.message || "Será retomada em alguns segundos.",
                    className: "bg-orange-50 border-orange-200 text-orange-900",
                    duration: 4000,
                });
                break;

            case 'pending-count':
                if (options?.pendingCount && options.pendingCount > 0) {
                    toast({
                        title: `${options.pendingCount} chamada(s) pendente(s)`,
                        description: "Serão enviadas quando a conexão voltar.",
                        className: "bg-blue-50 border-blue-200 text-blue-900",
                        duration: 3000,
                    });
                }
                break;
        }
    }, []);

    return { showOfflineToast };
}

export default useOfflineToast;
