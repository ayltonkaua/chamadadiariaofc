/**
 * Presenca (Attendance) Service
 * 
 * Business logic for attendance management.
 * Handles both online and offline scenarios.
 */

import { presencasAdapter, logger, ValidationError, NetworkError } from '@/core';
import {
    salvarChamadaOffline,
    limparSessaoChamada,
    ChamadaOffline
} from '@/lib/offlineChamada';
import type {
    Presenca,
    ChamadaPayload,
    HistoricoChamada,
    StatusPresenca
} from '../types/presenca.types';

const log = logger.child('PresencaService');

/**
 * Service for managing attendance records
 */
export const presencaService = {
    /**
     * Finds all attendance records for a class on a specific date
     */
    async findByTurmaAndDate(turmaId: string, data: string): Promise<Presenca[]> {
        log.debug('Finding presencas by turma and date', { turmaId, data });

        return presencasAdapter.findMany({
            eq: { turma_id: turmaId, data_chamada: data } as Partial<Presenca>
        });
    },

    /**
     * Gets attendance history for a class
     */
    async getHistorico(turmaId: string, totalAlunos: number): Promise<HistoricoChamada[]> {
        log.debug('Getting historico for turma', { turmaId });

        const presencas = await presencasAdapter.findMany(
            { eq: { turma_id: turmaId } as Partial<Presenca> },
            { orderBy: { column: 'data_chamada', ascending: false } }
        );

        if (presencas.length === 0) return [];

        // Group by date
        const grouped = presencas.reduce((acc, curr) => {
            const data = curr.data_chamada;
            if (!acc[data]) {
                acc[data] = { presentes: 0, faltosos: 0, presencas: [] };
            }

            if (curr.presente) {
                acc[data].presentes++;
            } else {
                acc[data].faltosos++;
            }

            acc[data].presencas.push({
                aluno_id: curr.aluno_id,
                presente: curr.presente,
                falta_justificada: curr.falta_justificada || false
            });

            return acc;
        }, {} as Record<string, { presentes: number; faltosos: number; presencas: any[] }>);

        // Convert to array
        return Object.entries(grouped)
            .map(([data, stats]) => ({
                data,
                presentes: stats.presentes,
                faltosos: stats.faltosos,
                total: totalAlunos,
                presencas: stats.presencas
            }))
            .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
    },

    /**
     * Gets attendance history for a specific student
     */
    async getHistoricoAluno(alunoId: string): Promise<Array<{ data_chamada: string; presente: boolean; falta_justificada: boolean }>> {
        log.debug('Getting historico for aluno', { alunoId });

        const presencas = await presencasAdapter.findMany(
            { eq: { aluno_id: alunoId } as Partial<Presenca> },
            { orderBy: { column: 'data_chamada', ascending: false } }
        );

        return presencas.map(p => ({
            data_chamada: p.data_chamada,
            presente: p.presente,
            falta_justificada: p.falta_justificada || false
        }));
    },

    /**
     * Saves attendance - handles online/offline automatically
     */
    async salvarChamada(payload: ChamadaPayload): Promise<{ online: boolean; count: number }> {
        log.info('Saving chamada', {
            turmaId: payload.turmaId,
            data: payload.dataChamada,
            count: payload.registros.length
        });

        // Validation
        if (!payload.turmaId) {
            throw new ValidationError('Turma é obrigatória', { field: 'turmaId' });
        }
        if (!payload.escolaId) {
            throw new ValidationError('Escola é obrigatória', { field: 'escolaId' });
        }
        if (!payload.dataChamada) {
            throw new ValidationError('Data da chamada é obrigatória', { field: 'dataChamada' });
        }
        if (payload.registros.length === 0) {
            throw new ValidationError('Nenhum registro de presença');
        }

        // Build records
        const records = payload.registros.map(r => ({
            aluno_id: r.alunoId,
            turma_id: payload.turmaId,
            escola_id: payload.escolaId,
            data_chamada: payload.dataChamada,
            presente: r.presente,
            falta_justificada: r.faltaJustificada
        }));

        // If offline, save locally
        if (!navigator.onLine) {
            log.info('Offline mode - saving locally');

            const offlineRecords: Omit<ChamadaOffline, 'timestamp'>[] = records.map(r => ({
                aluno_id: r.aluno_id,
                turma_id: r.turma_id,
                escola_id: r.escola_id,
                presente: r.presente,
                falta_justificada: r.falta_justificada,
                data_chamada: r.data_chamada
            }));

            const success = await salvarChamadaOffline(offlineRecords);

            if (!success) {
                throw new NetworkError('Falha ao salvar offline', true);
            }

            await limparSessaoChamada();
            return { online: false, count: records.length };
        }

        // Online: Delete existing and insert new
        try {
            // Delete existing records for this date
            await presencasAdapter.delete({
                eq: {
                    turma_id: payload.turmaId,
                    data_chamada: payload.dataChamada
                } as Partial<Presenca>
            });

            // Insert new records
            if (records.length > 0) {
                await presencasAdapter.createMany(records as any[]);
            }

            await limparSessaoChamada();
            log.info('Chamada saved online', { count: records.length });

            return { online: true, count: records.length };

        } catch (error) {
            // If network error during online save, fallback to offline
            if (error instanceof NetworkError || !navigator.onLine) {
                log.warn('Network error during save - falling back to offline');

                const offlineRecords: Omit<ChamadaOffline, 'timestamp'>[] = records.map(r => ({
                    aluno_id: r.aluno_id,
                    turma_id: r.turma_id,
                    escola_id: r.escola_id,
                    presente: r.presente,
                    falta_justificada: r.falta_justificada,
                    data_chamada: r.data_chamada
                }));

                const success = await salvarChamadaOffline(offlineRecords);

                if (!success) {
                    throw new NetworkError('Falha ao salvar offline após erro de rede', true);
                }

                await limparSessaoChamada();
                return { online: false, count: records.length };
            }

            throw error;
        }
    },

    /**
     * Edits an existing attendance record
     */
    async editarChamada(
        turmaId: string,
        data: string,
        novasPresencas: Array<{ aluno_id: string; presente: boolean; falta_justificada?: boolean }>
    ): Promise<void> {
        log.info('Editing chamada', { turmaId, data });

        // Delete existing
        await presencasAdapter.delete({
            eq: { turma_id: turmaId, data_chamada: data } as Partial<Presenca>
        });

        // Get escola_id from first record (we need this for insert)
        // In a real scenario, this should come from the caller
        const records = novasPresencas.map(p => ({
            aluno_id: p.aluno_id,
            turma_id: turmaId,
            presente: p.presente,
            falta_justificada: p.falta_justificada || false,
            data_chamada: data
        }));

        if (records.length > 0) {
            await presencasAdapter.createMany(records as any[]);
        }
    },

    /**
     * Deletes all attendance for a date
     */
    async excluirChamada(turmaId: string, data: string): Promise<void> {
        log.info('Deleting chamada', { turmaId, data });

        await presencasAdapter.delete({
            eq: { turma_id: turmaId, data_chamada: data } as Partial<Presenca>
        });
    },

    /**
     * Converts visual status to database values
     */
    statusToDb(status: StatusPresenca): { presente: boolean; falta_justificada: boolean } {
        switch (status) {
            case 'presente':
                return { presente: true, falta_justificada: false };
            case 'falta':
                return { presente: false, falta_justificada: false };
            case 'atestado':
                return { presente: false, falta_justificada: true };
        }
    },

    /**
     * Converts database values to visual status
     */
    dbToStatus(presente: boolean, faltaJustificada: boolean): StatusPresenca {
        if (presente) return 'presente';
        if (faltaJustificada) return 'atestado';
        return 'falta';
    }
};
