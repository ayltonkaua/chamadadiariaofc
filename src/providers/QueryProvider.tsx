/**
 * React Query Provider
 * 
 * Configures React Query with optimal settings for the app:
 * - Stale time: 5 minutes (data considered fresh)
 * - Cache time: 30 minutes (data kept in memory)
 * - Retry: 1 attempt on failure
 * - Refetch on window focus: enabled
 */

import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './query-client';

export function QueryProvider({ children }: { children: React.ReactNode }) {
    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
}
