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
// =============================================================================

export function useTurmasWithCount(escolaId: string | undefined) {
    return useQuery({
        queryKey: queryKeys.turmasWithCount(escolaId || ''),
        queryFn: () => turmaService.findWithCount(escolaId!),
        enabled: !!escolaId,
        staleTime: 10 * 60 * 1000, // 10 minutes - turmas change rarely
    });
}

// =============================================================================
// ALUNOS HOOKS
// =============================================================================

export function useAlunosByTurma(turmaId: string | undefined) {
    return useQuery({
        queryKey: queryKeys.alunos(turmaId || ''),
        queryFn: () => alunoService.findByTurma(turmaId!),
        enabled: !!turmaId,
        staleTime: 5 * 60 * 1000,
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
// =============================================================================

export function usePresencasByTurmaAndDate(turmaId: string | undefined, data: string | undefined) {
    return useQuery({
        queryKey: queryKeys.presencasByTurma(turmaId || '', data || ''),
        queryFn: () => presencaService.findByTurmaAndDate(turmaId!, data!),
        enabled: !!turmaId && !!data,
        staleTime: 1 * 60 * 1000, // 1 minute - presencas are live
    });
}

export function useHistoricoTurma(turmaId: string | undefined, totalAlunos: number) {
    return useQuery({
        queryKey: queryKeys.historicoTurma(turmaId || ''),
        queryFn: () => presencaService.getHistorico(turmaId!, totalAlunos),
        enabled: !!turmaId && totalAlunos > 0,
        staleTime: 5 * 60 * 1000,
    });
}

export function useHistoricoAluno(alunoId: string | undefined) {
    return useQuery({
        queryKey: queryKeys.historicoAluno(alunoId || ''),
        queryFn: () => presencaService.getHistoricoAluno(alunoId!),
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
