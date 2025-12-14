/**
 * Aluno Service
 * 
 * Business logic for student management.
 * Uses the Supabase adapter for data access.
 */

import { alunosAdapter, logger, NotFoundError, ValidationError } from '@/core';
import type { Aluno, AlunoInsert, AlunoResumo } from '../types/aluno.types';

const log = logger.child('AlunoService');

/**
 * Service for managing students
 */
export const alunoService = {
    /**
     * Finds all students for a specific class
     */
    async findByTurma(turmaId: string): Promise<Aluno[]> {
        log.debug('Finding students by turma', { turmaId });

        return alunosAdapter.findMany(
            { eq: { turma_id: turmaId } as Partial<Aluno> },
            { orderBy: { column: 'nome', ascending: true } }
        );
    },

    /**
     * Finds a student by ID
     */
    async findById(id: string): Promise<Aluno | null> {
        log.debug('Finding student by id', { id });

        return alunosAdapter.findOne(
            { eq: { id } as Partial<Aluno> }
        );
    },

    /**
     * Finds all students (for search/select)
     */
    async findAll(): Promise<Aluno[]> {
        log.debug('Finding all students');

        return alunosAdapter.findMany(
            {},
            { orderBy: { column: 'nome', ascending: true } }
        );
    },

    /**
     * Finds all students for a school
     */
    async findByEscola(escolaId: string): Promise<Aluno[]> {
        log.debug('Finding students by escola', { escolaId });

        return alunosAdapter.findMany(
            { eq: { escola_id: escolaId } as Partial<Aluno> },
            { orderBy: { column: 'nome', ascending: true } }
        );
    },

    /**
     * Finds a student by their user_id (for logged-in students)
     */
    async findByUserId(userId: string): Promise<Aluno | null> {
        log.debug('Finding student by user_id', { userId });

        return alunosAdapter.findOne(
            { eq: { user_id: userId } as Partial<Aluno> }
        );
    },

    /**
     * Finds a student by matricula within a school
     */
    async findByMatricula(escolaId: string, matricula: string): Promise<Aluno | null> {
        log.debug('Finding student by matricula', { escolaId, matricula });

        return alunosAdapter.findOne({
            eq: { escola_id: escolaId, matricula } as Partial<Aluno>
        });
    },

    /**
     * Gets a student by ID, throws if not found
     */
    async getById(id: string): Promise<Aluno> {
        log.debug('Getting student by id', { id });

        const aluno = await alunosAdapter.findOne({ eq: { id } as Partial<Aluno> });

        if (!aluno) {
            throw new NotFoundError('Aluno', id);
        }

        return aluno;
    },

    /**
     * Creates a new student
     */
    async create(data: AlunoInsert): Promise<Aluno> {
        log.info('Creating student', { matricula: data.matricula });

        // Validation
        if (!data.nome?.trim()) {
            throw new ValidationError('Nome é obrigatório', { field: 'nome' });
        }
        if (!data.matricula?.trim()) {
            throw new ValidationError('Matrícula é obrigatória', { field: 'matricula' });
        }
        if (!data.turma_id) {
            throw new ValidationError('Turma é obrigatória', { field: 'turma_id' });
        }
        if (!data.escola_id) {
            throw new ValidationError('Escola é obrigatória', { field: 'escola_id' });
        }

        // Check for duplicate matricula
        const existing = await this.findByMatricula(data.escola_id, data.matricula);
        if (existing) {
            throw new ValidationError(
                `Já existe um aluno com a matrícula ${data.matricula}`,
                { field: 'matricula', received: data.matricula }
            );
        }

        return alunosAdapter.create(data);
    },

    /**
     * Creates multiple students in batch
     */
    async createMany(dataArray: AlunoInsert[]): Promise<Aluno[]> {
        log.info('Creating students in batch', { count: dataArray.length });

        if (dataArray.length === 0) return [];

        // Basic validation
        for (const data of dataArray) {
            if (!data.nome || !data.matricula || !data.turma_id || !data.escola_id) {
                throw new ValidationError('Todos os campos obrigatórios devem ser preenchidos');
            }
        }

        return alunosAdapter.createMany(dataArray);
    },

    /**
     * Updates a student
     */
    async update(id: string, data: Partial<Aluno>): Promise<Aluno> {
        log.info('Updating student', { id });

        const updated = await alunosAdapter.update(
            { eq: { id } as Partial<Aluno> },
            data
        );

        if (updated.length === 0) {
            throw new NotFoundError('Aluno', id);
        }

        return updated[0];
    },

    /**
     * Deletes a student
     */
    async delete(id: string): Promise<void> {
        log.info('Deleting student', { id });

        await alunosAdapter.delete({ eq: { id } as Partial<Aluno> });
    },

    /**
     * Counts students in a class
     */
    async countByTurma(turmaId: string): Promise<number> {
        return alunosAdapter.count({ eq: { turma_id: turmaId } as Partial<Aluno> });
    },

    /**
     * Maps to a simplified DTO
     */
    toResumo(aluno: Aluno): AlunoResumo {
        return {
            id: aluno.id,
            nome: aluno.nome,
            matricula: aluno.matricula,
            turmaId: aluno.turma_id
        };
    }
};
