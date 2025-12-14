/**
 * Test Utilities
 * 
 * Helper functions for testing services and components.
 */

import { vi } from 'vitest';

/**
 * Creates a mock Supabase query builder
 */
export function createMockQueryBuilder<T>(data: T[] | T | null, error: Error | null = null) {
    const builder = {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        upsert: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        range: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: Array.isArray(data) ? data[0] : data, error }),
        maybeSingle: vi.fn().mockResolvedValue({ data: Array.isArray(data) ? data[0] : data, error }),
        then: vi.fn((resolve) => resolve({ data, error, count: Array.isArray(data) ? data.length : (data ? 1 : 0) })),
    };

    // Make it thenable for async operations
    return {
        ...builder,
        [Symbol.toStringTag]: 'Promise',
    };
}

/**
 * Creates a mock aluno for testing
 */
export function createMockAluno(overrides: Partial<{
    id: string;
    nome: string;
    matricula: string;
    turma_id: string;
    escola_id: string;
}> = {}) {
    return {
        id: 'aluno-1',
        nome: 'João Silva',
        matricula: '2024001',
        turma_id: 'turma-1',
        escola_id: 'escola-1',
        created_at: new Date().toISOString(),
        ...overrides,
    };
}

/**
 * Creates a mock turma for testing
 */
export function createMockTurma(overrides: Partial<{
    id: string;
    nome: string;
    numero_sala: string;
    turno: string;
    escola_id: string;
}> = {}) {
    return {
        id: 'turma-1',
        nome: '5º Ano A',
        numero_sala: 'Sala 101',
        turno: 'Manhã',
        escola_id: 'escola-1',
        user_id: 'user-1',
        created_at: new Date().toISOString(),
        ...overrides,
    };
}

/**
 * Creates a mock presenca for testing
 */
export function createMockPresenca(overrides: Partial<{
    id: string;
    aluno_id: string;
    turma_id: string;
    escola_id: string;
    data_chamada: string;
    presente: boolean;
    falta_justificada: boolean;
}> = {}) {
    return {
        id: 'presenca-1',
        aluno_id: 'aluno-1',
        turma_id: 'turma-1',
        escola_id: 'escola-1',
        data_chamada: '2024-01-15',
        presente: true,
        falta_justificada: false,
        created_at: new Date().toISOString(),
        ...overrides,
    };
}

/**
 * Sets navigator.onLine status for testing offline scenarios
 */
export function setOnlineStatus(isOnline: boolean) {
    Object.defineProperty(navigator, 'onLine', {
        value: isOnline,
        writable: true,
        configurable: true,
    });
}
