/**
 * GestorService Tests
 * 
 * Tests for the admin dashboard service.
 * Covers RPC calls, data transformations, and error handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock supabase client
const mockRpc = vi.fn();
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockOrder = vi.fn();
const mockGte = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
    supabase: {
        rpc: (...args: any[]) => mockRpc(...args),
        from: (table: string) => {
            mockFrom(table);
            return {
                select: (cols: string) => {
                    mockSelect(cols);
                    return {
                        order: (col: string) => {
                            mockOrder(col);
                            return Promise.resolve({ data: [], error: null });
                        },
                        gte: (col: string, val: string) => {
                            mockGte(col, val);
                            return Promise.resolve({ data: [], error: null });
                        },
                    };
                },
            };
        },
    },
}));

vi.mock('@/core', () => ({
    logger: {
        child: () => ({
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        }),
    },
}));

vi.mock('date-fns', () => ({
    subDays: () => new Date('2025-12-01'),
}));

import { gestorService } from '@/domains/gestor/services/gestor.service';

describe('gestorService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default RPC response
        mockRpc.mockResolvedValue({ data: null, error: null });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('getDashboardData', () => {
        it('should call all 6 RPCs in parallel', async () => {
            await gestorService.getDashboardData('escola-123');

            expect(mockRpc).toHaveBeenCalledWith('get_escola_kpis', { _escola_id: 'escola-123' });
            expect(mockRpc).toHaveBeenCalledWith('get_kpis_administrativos', { _escola_id: 'escola-123' });
            expect(mockRpc).toHaveBeenCalledWith('get_comparativo_turmas', { _escola_id: 'escola-123' });
            expect(mockRpc).toHaveBeenCalledWith('get_alunos_em_risco_anual', { limite_faltas: 16, _escola_id: 'escola-123' });
            expect(mockRpc).toHaveBeenCalledWith('get_alunos_faltas_consecutivas', { dias_seguidos: 3, _escola_id: 'escola-123' });
            expect(mockRpc).toHaveBeenCalledWith('get_ultimas_observacoes', { limite: 10, _escola_id: 'escola-123' });
        });

        it('should also query turmas and presencas tables', async () => {
            await gestorService.getDashboardData('escola-123');

            expect(mockFrom).toHaveBeenCalledWith('turmas');
            expect(mockFrom).toHaveBeenCalledWith('presencas');
        });

        it('should return structured dashboard data', async () => {
            const mockKpis = { total_alunos: 100, taxa_presenca: 85 };
            const mockKpisAdmin = { atestados_pendentes: 5 };

            mockRpc
                .mockResolvedValueOnce({ data: mockKpis, error: null }) // kpis
                .mockResolvedValueOnce({ data: mockKpisAdmin, error: null }) // kpisAdmin
                .mockResolvedValueOnce({ data: [], error: null }) // turmaComparison
                .mockResolvedValueOnce({ data: [], error: null }) // alunosRisco
                .mockResolvedValueOnce({ data: [], error: null }) // alunosConsecutivos
                .mockResolvedValueOnce({ data: [], error: null }); // ultimasObservacoes

            const result = await gestorService.getDashboardData('escola-123');

            expect(result.kpis).toEqual(mockKpis);
            expect(result.kpisAdmin).toEqual(mockKpisAdmin);
            expect(result.turmaComparison).toEqual([]);
            expect(result.alunosRisco).toEqual([]);
            expect(result.alunosConsecutivos).toEqual([]);
            expect(result.ultimasObservacoes).toEqual([]);
            expect(result.turmasDisponiveis).toEqual([]);
            expect(result.presencasRecentes).toEqual([]);
        });

        it('should handle null data gracefully', async () => {
            mockRpc.mockResolvedValue({ data: null, error: null });

            const result = await gestorService.getDashboardData('escola-123');

            expect(result.kpis).toBeNull();
            expect(result.turmaComparison).toEqual([]);
        });
    });

    describe('getKpis', () => {
        it('should call get_escola_kpis RPC', async () => {
            mockRpc.mockResolvedValue({
                data: { total_alunos: 50, taxa_presenca: 90 },
                error: null,
            });

            const result = await gestorService.getKpis('escola-123');

            expect(mockRpc).toHaveBeenCalledWith('get_escola_kpis', { _escola_id: 'escola-123' });
            expect(result).toEqual({ total_alunos: 50, taxa_presenca: 90 });
        });

        it('should return null on error', async () => {
            mockRpc.mockResolvedValue({
                data: null,
                error: { message: 'RPC failed' },
            });

            const result = await gestorService.getKpis('escola-123');

            expect(result).toBeNull();
        });
    });

    describe('getKpisAdmin', () => {
        it('should call get_kpis_administrativos RPC', async () => {
            mockRpc.mockResolvedValue({
                data: { atestados_pendentes: 3, convites_pendentes: 2 },
                error: null,
            });

            const result = await gestorService.getKpisAdmin('escola-123');

            expect(mockRpc).toHaveBeenCalledWith('get_kpis_administrativos', { _escola_id: 'escola-123' });
            expect(result).toEqual({ atestados_pendentes: 3, convites_pendentes: 2 });
        });

        it('should return null on error', async () => {
            mockRpc.mockResolvedValue({
                data: null,
                error: { message: 'RPC failed' },
            });

            const result = await gestorService.getKpisAdmin('escola-123');

            expect(result).toBeNull();
        });
    });

    describe('getUltimasPresencasAluno', () => {
        it('should call get_ultimas_presencas_aluno RPC with aluno_id', async () => {
            mockRpc.mockResolvedValue({
                data: [
                    { data_chamada: '2025-12-13', presente: true },
                    { data_chamada: '2025-12-12', presente: false },
                ],
                error: null,
            });

            const result = await gestorService.getUltimasPresencasAluno('aluno-123');

            expect(mockRpc).toHaveBeenCalledWith('get_ultimas_presencas_aluno', { p_aluno_id: 'aluno-123' });
            expect(result).toHaveLength(2);
        });

        it('should return max 3 results', async () => {
            mockRpc.mockResolvedValue({
                data: [
                    { data_chamada: '2025-12-13', presente: true },
                    { data_chamada: '2025-12-12', presente: true },
                    { data_chamada: '2025-12-11', presente: true },
                    { data_chamada: '2025-12-10', presente: true },
                    { data_chamada: '2025-12-09', presente: true },
                ],
                error: null,
            });

            const result = await gestorService.getUltimasPresencasAluno('aluno-123');

            expect(result).toHaveLength(3);
        });

        it('should return empty array on error', async () => {
            mockRpc.mockResolvedValue({
                data: null,
                error: { message: 'RPC failed' },
            });

            const result = await gestorService.getUltimasPresencasAluno('aluno-123');

            expect(result).toEqual([]);
        });
    });
});
