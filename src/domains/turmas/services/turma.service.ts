/**
 * Turma Service
 * 
 * Business logic for class management.
 */

import { turmasAdapter, alunosAdapter, logger, NotFoundError, ValidationError } from '@/core';
import type { Turma, TurmaInsert, TurmaComContagem, TurmaResumo } from '../types/turma.types';

const log = logger.child('TurmaService');

/**
 * Service for managing classes
 */
export const turmaService = {
    /**
     * Finds all classes for a school
     */
    async findByEscola(escolaId: string): Promise<Turma[]> {
        log.debug('Finding turmas by escola', { escolaId });

        return turmasAdapter.findMany(
            { eq: { escola_id: escolaId } as Partial<Turma> },
            { orderBy: { column: 'nome', ascending: true } }
        );
    },

    /**
     * Finds all classes with student count
     */
    async findWithCount(escolaId?: string): Promise<TurmaComContagem[]> {
        log.debug('Finding turmas with count');

        const filters = escolaId
            ? { eq: { escola_id: escolaId } as Partial<Turma> }
            : undefined;

        const turmas = await turmasAdapter.findMany(filters, {
            orderBy: { column: 'nome', ascending: true }
        });

        // Get student counts in batch
        const turmaIds = turmas.map(t => t.id);

        if (turmaIds.length === 0) return [];

        // Count students per turma
        const countsPromises = turmaIds.map(async (turmaId) => {
            const count = await alunosAdapter.count({
                eq: { turma_id: turmaId } as any
            });
            return { turmaId, count };
        });

        const counts = await Promise.all(countsPromises);
        const countMap = new Map(counts.map(c => [c.turmaId, c.count]));

        return turmas.map(turma => ({
            ...turma,
            _count: { alunos: countMap.get(turma.id) || 0 },
            alunos: countMap.get(turma.id) || 0
        }));
    },

    /**
     * Finds classes by turno (shift)
     */
    async findByTurno(escolaId: string, turno: string): Promise<Turma[]> {
        log.debug('Finding turmas by turno', { escolaId, turno });

        const turmas = await this.findByEscola(escolaId);

        const turnoLower = turno.toLowerCase();
        return turmas.filter(t => {
            const turnoTurma = (t.turno || '').toLowerCase();
            return turnoTurma.includes(turnoLower);
        });
    },

    /**
     * Gets a class by ID, throws if not found
     */
    async getById(id: string): Promise<Turma> {
        log.debug('Getting turma by id', { id });

        const turma = await turmasAdapter.findOne({ eq: { id } as Partial<Turma> });

        if (!turma) {
            throw new NotFoundError('Turma', id);
        }

        return turma;
    },

    /**
     * Creates a new class
     */
    async create(data: TurmaInsert): Promise<Turma> {
        log.info('Creating turma', { nome: data.nome });

        // Validation
        if (!data.nome?.trim()) {
            throw new ValidationError('Nome da turma é obrigatório', { field: 'nome' });
        }
        if (!data.escola_id) {
            throw new ValidationError('Escola é obrigatória', { field: 'escola_id' });
        }

        return turmasAdapter.create(data);
    },

    /**
     * Updates a class
     */
    async update(id: string, data: Partial<Turma>): Promise<Turma> {
        log.info('Updating turma', { id });

        const updated = await turmasAdapter.update(
            { eq: { id } as Partial<Turma> },
            data
        );

        if (updated.length === 0) {
            throw new NotFoundError('Turma', id);
        }

        return updated[0];
    },

    /**
     * Deletes a class
     */
    async delete(id: string): Promise<void> {
        log.info('Deleting turma', { id });

        await turmasAdapter.delete({ eq: { id } as Partial<Turma> });
    },

    /**
     * Maps to a simplified DTO
     */
    toResumo(turma: Turma): TurmaResumo {
        return {
            id: turma.id,
            nome: turma.nome,
            numeroSala: turma.numero_sala,
            turno: turma.turno,
            escolaId: turma.escola_id
        };
    },

    /**
     * Groups classes by turno
     */
    groupByTurno(turmas: TurmaComContagem[]): Record<string, TurmaComContagem[]> {
        const groups: Record<string, TurmaComContagem[]> = {
            manha: [],
            tarde: [],
            noite: [],
            integral: [],
            outros: []
        };

        for (const turma of turmas) {
            const turno = (turma.turno || '').toLowerCase();

            if (turno.includes('integral')) {
                groups.integral.push(turma);
            } else if (turno.includes('manhã') || turno.includes('manha') || turno.includes('matutino')) {
                groups.manha.push(turma);
            } else if (turno.includes('tarde') || turno.includes('vespertino')) {
                groups.tarde.push(turma);
            } else if (turno.includes('noite') || turno.includes('noturno')) {
                groups.noite.push(turma);
            } else {
                groups.outros.push(turma);
            }
        }

        return groups;
    },

    /**
     * Imports a turma with students using secure RPC
     * This bypasses direct INSERT and uses SECURITY DEFINER function
     */
    async importWithStudents(
        nome: string,
        numeroSala: string,
        turno: string | null,
        escolaId: string,
        alunos: Array<{ nome: string; matricula: string }>
    ): Promise<{ turma_id: string; inseridos: number; atualizados: number }> {
        log.info('Importing turma with students via RPC', { nome, alunosCount: alunos.length });

        // Validation
        if (!nome?.trim()) {
            throw new ValidationError('Nome da turma é obrigatório', { field: 'nome' });
        }
        if (!escolaId) {
            throw new ValidationError('Escola é obrigatória', { field: 'escola_id' });
        }

        // Use the secure RPC function
        const { supabase } = await import('@/integrations/supabase/client');

        const { data, error } = await (supabase.rpc as any)('import_turma_with_students', {
            p_nome: nome.trim(),
            p_numero_sala: numeroSala || '',
            p_turno: turno,
            p_escola_id: escolaId,
            p_alunos: alunos
        });

        if (error) {
            log.error('Failed to import turma', error);
            throw new Error(error.message);
        }

        log.info('Turma imported successfully', data);
        return data as { turma_id: string; inseridos: number; atualizados: number };
    }
};
