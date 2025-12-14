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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Data stays fresh for 5 minutes
            staleTime: 5 * 60 * 1000,
            // Keep unused data in cache for 30 minutes
            gcTime: 30 * 60 * 1000,
            // Retry once on failure
            retry: 1,
            // Refetch when window gets focus
            refetchOnWindowFocus: true,
            // Don't refetch on mount if data is fresh
            refetchOnMount: false,
        },
    },
});

export function QueryProvider({ children }: { children: React.ReactNode }) {
    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
}

export { queryClient };
