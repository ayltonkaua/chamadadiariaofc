/**
 * AppError Unit Tests
 */

import { describe, it, expect } from 'vitest';
import {
    AppError,
    DatabaseError,
    NotFoundError,
    AuthError,
    NetworkError,
    ValidationError,
    isAppError,
    wrapError,
} from '@/core/errors';

describe('AppError', () => {
    describe('AppError base class', () => {
        it('should create an error with code and message', () => {
            const error = new AppError('UNKNOWN_ERROR', 'Test error');

            expect(error.code).toBe('UNKNOWN_ERROR');
            expect(error.message).toBe('Test error');
            expect(error.isOperational).toBe(true);
            expect(error.timestamp).toBeInstanceOf(Date);
        });

        it('should include details when provided', () => {
            const error = new AppError('VALIDATION_FAILED', 'Invalid input', { field: 'email' });

            expect(error.details).toEqual({ field: 'email' });
        });

        it('should serialize to JSON correctly', () => {
            const error = new AppError('DB_NOT_FOUND', 'Record not found');
            const json = error.toJSON();

            expect(json.code).toBe('DB_NOT_FOUND');
            expect(json.message).toBe('Record not found');
            expect(json.timestamp).toBeDefined();
        });
    });

    describe('DatabaseError', () => {
        it('should create a database error', () => {
            const error = new DatabaseError('Query failed');

            expect(error.code).toBe('DB_QUERY_FAILED');
            expect(error.name).toBe('DatabaseError');
        });
    });

    describe('NotFoundError', () => {
        it('should create a not found error with entity name', () => {
            const error = new NotFoundError('Aluno');

            expect(error.code).toBe('DB_NOT_FOUND');
            expect(error.message).toBe('Aluno não encontrado');
        });

        it('should include ID when provided', () => {
            const error = new NotFoundError('Turma', '123');

            expect(error.message).toBe('Turma não encontrado: 123');
            expect(error.details).toEqual({ entity: 'Turma', id: '123' });
        });
    });

    describe('AuthError', () => {
        it('should create an auth error', () => {
            const error = new AuthError('AUTH_UNAUTHENTICATED', 'Not logged in');

            expect(error.code).toBe('AUTH_UNAUTHENTICATED');
            expect(error.name).toBe('AuthError');
        });
    });

    describe('NetworkError', () => {
        it('should create a network error', () => {
            const error = new NetworkError('Connection failed');

            expect(error.code).toBe('NETWORK_REQUEST_FAILED');
            expect(error.isOffline).toBe(false);
        });

        it('should create an offline error', () => {
            const error = new NetworkError('No internet', true);

            expect(error.code).toBe('NETWORK_OFFLINE');
            expect(error.isOffline).toBe(true);
        });
    });

    describe('ValidationError', () => {
        it('should create a validation error', () => {
            const error = new ValidationError('Nome é obrigatório', { field: 'nome' });

            expect(error.code).toBe('VALIDATION_FAILED');
            expect(error.details).toEqual({ field: 'nome' });
        });
    });

    describe('isAppError', () => {
        it('should return true for AppError instances', () => {
            expect(isAppError(new AppError('UNKNOWN_ERROR', 'test'))).toBe(true);
            expect(isAppError(new DatabaseError('test'))).toBe(true);
            expect(isAppError(new ValidationError('test'))).toBe(true);
        });

        it('should return false for regular errors', () => {
            expect(isAppError(new Error('test'))).toBe(false);
            expect(isAppError('string error')).toBe(false);
            expect(isAppError(null)).toBe(false);
        });
    });

    describe('wrapError', () => {
        it('should return AppError as-is', () => {
            const original = new ValidationError('test');
            const wrapped = wrapError(original);

            expect(wrapped).toBe(original);
        });

        it('should wrap regular Error', () => {
            const original = new Error('Regular error');
            const wrapped = wrapError(original);

            expect(wrapped.code).toBe('UNKNOWN_ERROR');
            expect(wrapped.message).toBe('Regular error');
        });

        it('should wrap unknown values', () => {
            const wrapped = wrapError('string error', 'Fallback message');

            expect(wrapped.code).toBe('UNKNOWN_ERROR');
            expect(wrapped.message).toBe('Fallback message');
        });
    });
});
