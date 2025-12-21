/**
 * SyncStatusBadge Component
 * 
 * Visual indicator for synchronization state.
 * Designed to build TRUST with teachers - clear, honest status.
 * 
 * States:
 * - 🟡 saved-local: Data is safe in IndexedDB
 * - 🔵 syncing: SyncManager is working
 * - 🟢 synced: Queue is empty
 * - 🔴 error: Manual action required
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import {
    CloudOff,
    Cloud,
    Check,
    AlertTriangle,
    Loader2
} from 'lucide-react';

export type SyncState = 'saved-local' | 'syncing' | 'synced' | 'error';

export interface SyncStatusBadgeProps {
    state: SyncState;
    pendingCount?: number;
    onClick?: () => void;
    className?: string;
}

const STATE_CONFIG: Record<SyncState, {
    icon: React.ElementType;
    text: (count?: number) => string;
    className: string;
    animate?: boolean;
}> = {
    'saved-local': {
        icon: CloudOff,
        text: (count) => count && count > 1
            ? `${count} chamadas salvas localmente`
            : 'Salvo localmente',
        className: 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200'
    },
    'syncing': {
        icon: Loader2,
        text: () => 'Sincronizando...',
        className: 'bg-blue-100 text-blue-800 border-blue-300',
        animate: true
    },
    'synced': {
        icon: Check,
        text: () => 'Sincronizado',
        className: 'bg-green-100 text-green-800 border-green-300'
    },
    'error': {
        icon: AlertTriangle,
        text: (count) => count && count > 1
            ? `${count} chamadas com erro`
            : 'Erro - toque para tentar',
        className: 'bg-red-100 text-red-800 border-red-300 hover:bg-red-200 cursor-pointer'
    }
};

export const SyncStatusBadge: React.FC<SyncStatusBadgeProps> = ({
    state,
    pendingCount = 0,
    onClick,
    className = ''
}) => {
    const config = STATE_CONFIG[state];
    const Icon = config.icon;

    return (
        <Badge
            variant="outline"
            onClick={state === 'error' ? onClick : undefined}
            className={`
        gap-1.5 px-3 py-1.5 text-sm font-medium
        ${config.className}
        ${className}
      `}
        >
            <Icon
                className={`h-4 w-4 ${config.animate ? 'animate-spin' : ''}`}
            />
            <span className="hidden sm:inline">
                {config.text(pendingCount)}
            </span>
            {/* Mobile: show just icon + count */}
            <span className="sm:hidden">
                {pendingCount > 0 && state !== 'synced' && (
                    <span className="ml-1">{pendingCount}</span>
                )}
            </span>
        </Badge>
    );
};

export default SyncStatusBadge;
