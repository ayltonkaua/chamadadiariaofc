/**
 * React Query Hooks for Domain Services
 * 
 * Provides cached data fetching hooks using React Query.
 * These hooks wrap the domain services with automatic caching,
 * background refetching, and optimistic updates.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    gestorService,
    turmaService,
    alunoService,
    atestadosService,
    presencaService,
    type AtestadoFilter,
    type AtestadoInsert,
    type AtestadoStatus,
} from '@/domains';

// Query Keys - centralized for invalidation
export const queryKeys = {
    // Gestor/Dashboard
    dashboardData: (escolaId: string) => ['dashboard', escolaId] as const,
    kpis: (escolaId: string) => ['kpis', escolaId] as const,
    kpisAdmin: (escolaId: string) => ['kpisAdmin', escolaId] as const,

    // Turmas
    turmas: (escolaId: string) => ['turmas', escolaId] as const,
    turmasWithCount: (escolaId: string) => ['turmasWithCount', escolaId] as const,

    // Alunos
    alunos: (turmaId: string) => ['alunos', turmaId] as const,
    alunoById: (alunoId: string) => ['aluno', alunoId] as const,

    // Atestados
    atestados: (filter: AtestadoFilter, page: number) => ['atestados', filter, page] as const,

    // Presencas
    presencasByTurma: (turmaId: string, data: string) => ['presencas', turmaId, data] as const,
    historicoTurma: (turmaId: string) => ['historicoTurma', turmaId] as const,
    historicoAluno: (alunoId: string) => ['historicoAluno', alunoId] as const,
};

// =============================================================================
// GESTOR / DASHBOARD HOOKS
// =============================================================================

export function useDashboardData(escolaId: string | undefined) {
    return useQuery({
        queryKey: queryKeys.dashboardData(escolaId || ''),
        queryFn: () => gestorService.getDashboardData(escolaId!),
        enabled: !!escolaId,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}

export function useKpis(escolaId: string | undefined) {
    return useQuery({
        queryKey: queryKeys.kpis(escolaId || ''),
        queryFn: () => gestorService.getKpis(escolaId!),
        enabled: !!escolaId,
        staleTime: 5 * 60 * 1000,
    });
}

export function useKpisAdmin(escolaId: string | undefined) {
    return useQuery({
        queryKey: queryKeys.kpisAdmin(escolaId || ''),
        queryFn: () => gestorService.getKpisAdmin(escolaId!),
        enabled: !!escolaId,
        staleTime: 5 * 60 * 1000,
    });
}

// =============================================================================
// TURMAS HOOKS
// 🚫 DO NOT ACCESS SUPABASE HERE - Use dataProvider only
// =============================================================================

export function useTurmasWithCount(escolaId: string | undefined) {
    return useQuery({
        queryKey: queryKeys.turmasWithCount(escolaId || ''),
        queryFn: async () => {
            // Import dynamically to avoid circular deps
            const { getTurmasWithCount } = await import('@/lib/dataProvider');
            const result = await getTurmasWithCount(escolaId!);
            return result.data;
        },
        enabled: !!escolaId,
        staleTime: Infinity, // OFFLINE-FIRST: Never auto-refetch, dataProvider handles freshness
        gcTime: 24 * 60 * 60 * 1000, // 24 hours cache
    });
}

// =============================================================================
// ALUNOS HOOKS
// 🚫 DO NOT ACCESS SUPABASE HERE - Use dataProvider only
// =============================================================================

export function useAlunosByTurma(turmaId: string | undefined) {
    return useQuery({
        queryKey: queryKeys.alunos(turmaId || ''),
        queryFn: async () => {
            const { getAlunosByTurma } = await import('@/lib/dataProvider');
            const result = await getAlunosByTurma(turmaId!);
            return result.data;
        },
        enabled: !!turmaId,
        staleTime: Infinity, // OFFLINE-FIRST
        gcTime: 24 * 60 * 60 * 1000,
    });
}

export function useAlunoById(alunoId: string | undefined) {
    return useQuery({
        queryKey: queryKeys.alunoById(alunoId || ''),
        queryFn: () => alunoService.findById(alunoId!),
        enabled: !!alunoId,
    });
}

// =============================================================================
// ATESTADOS HOOKS
// =============================================================================

export function useAtestadosPaginated(filter: AtestadoFilter, page: number = 1, pageSize: number = 10) {
    return useQuery({
        queryKey: queryKeys.atestados(filter, page),
        queryFn: () => atestadosService.findPaginated(filter, page, pageSize),
        staleTime: 2 * 60 * 1000, // 2 minutes - atestados change frequently
    });
}

export function useAtestadoMutations() {
    const queryClient = useQueryClient();

    const upsertMutation = useMutation({
        mutationFn: (atestado: AtestadoInsert) => atestadosService.upsert(atestado),
        onSuccess: () => {
            // Invalidate all atestados queries
            queryClient.invalidateQueries({ queryKey: ['atestados'] });
            queryClient.invalidateQueries({ queryKey: ['kpisAdmin'] });
        },
    });

    const updateStatusMutation = useMutation({
        mutationFn: ({ id, status }: { id: string; status: AtestadoStatus }) =>
            atestadosService.updateStatus(id, status),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['atestados'] });
            queryClient.invalidateQueries({ queryKey: ['kpisAdmin'] });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => atestadosService.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['atestados'] });
        },
    });

    return {
        upsert: upsertMutation,
        updateStatus: updateStatusMutation,
        delete: deleteMutation,
    };
}

// =============================================================================
// PRESENCAS HOOKS
// 🚫 DO NOT ACCESS SUPABASE HERE - Use dataProvider only
// =============================================================================

export function usePresencasByTurmaAndDate(turmaId: string | undefined, data: string | undefined) {
    return useQuery({
        queryKey: queryKeys.presencasByTurma(turmaId || '', data || ''),
        queryFn: async () => {
            const { getPresencasByTurmaData } = await import('@/lib/dataProvider');
            const result = await getPresencasByTurmaData(turmaId!, data!);
            return result.data;
        },
        enabled: !!turmaId && !!data,
        staleTime: 1 * 60 * 1000, // 1 minute - presencas are live
    });
}

export function useHistoricoTurma(turmaId: string | undefined, totalAlunos: number) {
    return useQuery({
        queryKey: queryKeys.historicoTurma(turmaId || ''),
        queryFn: async () => {
            const { getPresencasByTurma } = await import('@/lib/dataProvider');
            const result = await getPresencasByTurma(turmaId!);
            // Transform to historico format
            const presencas = result.data;
            const byDate = new Map<string, { presentes: number; ausentes: number }>();
            presencas.forEach(p => {
                const stats = byDate.get(p.data_chamada) || { presentes: 0, ausentes: 0 };
                if (p.presente) stats.presentes++;
                else stats.ausentes++;
                byDate.set(p.data_chamada, stats);
            });
            return Array.from(byDate.entries()).map(([data, stats]) => ({
                data,
                presentes: stats.presentes,
                ausentes: stats.ausentes,
                percentual: totalAlunos > 0 ? Math.round((stats.presentes / totalAlunos) * 100) : 0
            }));
        },
        enabled: !!turmaId && totalAlunos > 0,
        staleTime: 5 * 60 * 1000,
    });
}

export function useHistoricoAluno(alunoId: string | undefined) {
    return useQuery({
        queryKey: queryKeys.historicoAluno(alunoId || ''),
        queryFn: async () => {
            // For now, return empty array - this could be enhanced later
            // Historico aluno requires specific RPC or client-side filtering
            console.log('[useHistoricoAluno] Not implemented in offline-first mode');
            return [];
        },
        enabled: !!alunoId,
        staleTime: 5 * 60 * 1000,
    });
}

// =============================================================================
// PREFETCH UTILITIES
// =============================================================================

export function usePrefetchDashboard() {
    const queryClient = useQueryClient();

    return (escolaId: string) => {
        queryClient.prefetchQuery({
            queryKey: queryKeys.dashboardData(escolaId),
            queryFn: () => gestorService.getDashboardData(escolaId),
        });
    };
}

// =============================================================================
// INVALIDATION UTILITIES
// =============================================================================

export function useInvalidateQueries() {
    const queryClient = useQueryClient();

    return {
        invalidateDashboard: (escolaId: string) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.dashboardData(escolaId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.kpis(escolaId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.kpisAdmin(escolaId) });
        },
        invalidatePresencas: (turmaId: string) => {
            queryClient.invalidateQueries({ queryKey: ['presencas', turmaId] });
            queryClient.invalidateQueries({ queryKey: queryKeys.historicoTurma(turmaId) });
        },
        invalidateAll: () => {
            queryClient.invalidateQueries();
        },
    };
}
