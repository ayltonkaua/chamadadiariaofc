/**
 * PresencaService Tests
 * 
 * Tests for the core attendance service.
 * Covers validation, online/offline flows, and data transformations.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies
vi.mock('@/core', () => ({
    presencasAdapter: {
        findMany: vi.fn(),
        delete: vi.fn(),
        createMany: vi.fn(),
    },
    logger: {
        child: () => ({
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        }),
    },
    ValidationError: class ValidationError extends Error {
        constructor(msg: string, public details?: any) {
            super(msg);
            this.name = 'ValidationError';
        }
    },
    NetworkError: class NetworkError extends Error {
        constructor(msg: string, public isOffline?: boolean) {
            super(msg);
            this.name = 'NetworkError';
        }
    },
}));

vi.mock('@/lib/offlineChamada', () => ({
    salvarChamadaOffline: vi.fn(),
    limparSessaoChamada: vi.fn(),
}));

import { presencaService } from '@/domains/chamada/services/presenca.service';
import { presencasAdapter } from '@/core';
import { salvarChamadaOffline, limparSessaoChamada } from '@/lib/offlineChamada';

describe('presencaService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default to online
        Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('salvarChamada', () => {
        const validPayload = {
            turmaId: 'turma-123',
            escolaId: 'escola-456',
            dataChamada: '2025-12-13',
            registros: [
                { alunoId: 'aluno-1', presente: true, faltaJustificada: false },
                { alunoId: 'aluno-2', presente: false, faltaJustificada: false },
                { alunoId: 'aluno-3', presente: false, faltaJustificada: true },
            ],
        };

        describe('Validation', () => {
            it('should throw ValidationError when turmaId is missing', async () => {
                const payload = { ...validPayload, turmaId: '' };

                await expect(presencaService.salvarChamada(payload))
                    .rejects.toThrow('Turma é obrigatória');
            });

            it('should throw ValidationError when escolaId is missing', async () => {
                const payload = { ...validPayload, escolaId: '' };

                await expect(presencaService.salvarChamada(payload))
                    .rejects.toThrow('Escola é obrigatória');
            });

            it('should throw ValidationError when dataChamada is missing', async () => {
                const payload = { ...validPayload, dataChamada: '' };

                await expect(presencaService.salvarChamada(payload))
                    .rejects.toThrow('Data da chamada é obrigatória');
            });

            it('should throw ValidationError when registros is empty', async () => {
                const payload = { ...validPayload, registros: [] };

                await expect(presencaService.salvarChamada(payload))
                    .rejects.toThrow('Nenhum registro de presença');
            });
        });

        describe('Online Mode', () => {
            it('should delete existing records and create new ones', async () => {
                vi.mocked(presencasAdapter.delete).mockResolvedValue(undefined);
                vi.mocked(presencasAdapter.createMany).mockResolvedValue([]);
                vi.mocked(limparSessaoChamada).mockResolvedValue(true);

                const result = await presencaService.salvarChamada(validPayload);

                expect(result).toEqual({ online: true, count: 3 });
                expect(presencasAdapter.delete).toHaveBeenCalledWith({
                    eq: { turma_id: 'turma-123', data_chamada: '2025-12-13' }
                });
                expect(presencasAdapter.createMany).toHaveBeenCalledWith(
                    expect.arrayContaining([
                        expect.objectContaining({
                            aluno_id: 'aluno-1',
                            presente: true,
                            falta_justificada: false,
                        })
                    ])
                );
                expect(limparSessaoChamada).toHaveBeenCalled();
            });

            it('should build records with correct structure', async () => {
                vi.mocked(presencasAdapter.delete).mockResolvedValue(undefined);
                vi.mocked(presencasAdapter.createMany).mockResolvedValue([]);
                vi.mocked(limparSessaoChamada).mockResolvedValue(true);

                await presencaService.salvarChamada(validPayload);

                const createCall = vi.mocked(presencasAdapter.createMany).mock.calls[0][0];
                expect(createCall).toHaveLength(3);
                expect(createCall[0]).toEqual({
                    aluno_id: 'aluno-1',
                    turma_id: 'turma-123',
                    escola_id: 'escola-456',
                    data_chamada: '2025-12-13',
                    presente: true,
                    falta_justificada: false,
                });
            });
        });

        describe('Offline Mode', () => {
            beforeEach(() => {
                Object.defineProperty(navigator, 'onLine', { value: false, writable: true });
            });

            it('should save locally when offline', async () => {
                vi.mocked(salvarChamadaOffline).mockResolvedValue(true);
                vi.mocked(limparSessaoChamada).mockResolvedValue(true);

                const result = await presencaService.salvarChamada(validPayload);

                expect(result).toEqual({ online: false, count: 3 });
                expect(salvarChamadaOffline).toHaveBeenCalled();
                expect(presencasAdapter.delete).not.toHaveBeenCalled();
                expect(presencasAdapter.createMany).not.toHaveBeenCalled();
            });

            it('should throw NetworkError if offline save fails', async () => {
                vi.mocked(salvarChamadaOffline).mockResolvedValue(false);

                await expect(presencaService.salvarChamada(validPayload))
                    .rejects.toThrow('Falha ao salvar offline');
            });
        });
    });

    describe('statusToDb', () => {
        it('should convert "presente" to correct values', () => {
            const result = presencaService.statusToDb('presente');
            expect(result).toEqual({ presente: true, falta_justificada: false });
        });

        it('should convert "falta" to correct values', () => {
            const result = presencaService.statusToDb('falta');
            expect(result).toEqual({ presente: false, falta_justificada: false });
        });

        it('should convert "atestado" to correct values', () => {
            const result = presencaService.statusToDb('atestado');
            expect(result).toEqual({ presente: false, falta_justificada: true });
        });
    });

    describe('dbToStatus', () => {
        it('should convert present=true to "presente"', () => {
            const result = presencaService.dbToStatus(true, false);
            expect(result).toBe('presente');
        });

        it('should convert present=false + justified=false to "falta"', () => {
            const result = presencaService.dbToStatus(false, false);
            expect(result).toBe('falta');
        });

        it('should convert present=false + justified=true to "atestado"', () => {
            const result = presencaService.dbToStatus(false, true);
            expect(result).toBe('atestado');
        });
    });

    describe('getHistorico', () => {
        it('should group attendance records by date', async () => {
            vi.mocked(presencasAdapter.findMany).mockResolvedValue([
                { data_chamada: '2025-12-13', presente: true, aluno_id: 'a1', turma_id: 't1' },
                { data_chamada: '2025-12-13', presente: false, aluno_id: 'a2', turma_id: 't1' },
                { data_chamada: '2025-12-12', presente: true, aluno_id: 'a1', turma_id: 't1' },
            ] as any);

            const result = await presencaService.getHistorico('t1', 2);

            expect(result).toHaveLength(2);
            expect(result[0].data).toBe('2025-12-13');
            expect(result[0].presentes).toBe(1);
            expect(result[0].faltosos).toBe(1);
        });

        it('should return empty array when no records', async () => {
            vi.mocked(presencasAdapter.findMany).mockResolvedValue([]);

            const result = await presencaService.getHistorico('t1', 2);

            expect(result).toEqual([]);
        });
    });

    describe('findByTurmaAndDate', () => {
        it('should call adapter with correct filters', async () => {
            vi.mocked(presencasAdapter.findMany).mockResolvedValue([]);

            await presencaService.findByTurmaAndDate('turma-123', '2025-12-13');

            expect(presencasAdapter.findMany).toHaveBeenCalledWith({
                eq: { turma_id: 'turma-123', data_chamada: '2025-12-13' }
            });
        });
    });

    describe('getHistoricoAluno', () => {
        it('should return student attendance history', async () => {
            vi.mocked(presencasAdapter.findMany).mockResolvedValue([
                { data_chamada: '2025-12-13', presente: true, aluno_id: 'a1', turma_id: 't1' },
                { data_chamada: '2025-12-12', presente: false, aluno_id: 'a1', turma_id: 't1' },
            ] as any);

            const result = await presencaService.getHistoricoAluno('a1');

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({
                data_chamada: '2025-12-13',
                presente: true,
                falta_justificada: false,
            });
        });
    });
});
