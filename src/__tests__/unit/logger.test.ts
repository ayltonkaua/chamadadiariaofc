/**
 * Logger Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logger, sanitize } from '@/core/logger';

describe('Logger', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('sanitize', () => {
        it('should redact password fields', () => {
            const input = { username: 'john', password: 'secret123' };
            const result = sanitize(input);

            expect(result.username).toBe('john');
            expect(result.password).toBe('[REDACTED]');
        });

        it('should redact email fields', () => {
            const input = { nome: 'João', email: 'joao@test.com' };
            const result = sanitize(input);

            expect(result.nome).toBe('João');
            expect(result.email).toBe('[REDACTED]');
        });

        it('should redact CPF fields', () => {
            const input = { cpf_responsavel: '123.456.789-00' };
            const result = sanitize(input);

            expect(result.cpf_responsavel).toBe('[REDACTED]');
        });

        it('should redact matricula fields', () => {
            const input = { matricula: '2024001', nome: 'Test' };
            const result = sanitize(input);

            expect(result.matricula).toBe('[REDACTED]');
            expect(result.nome).toBe('Test');
        });

        it('should handle nested objects', () => {
            const input = {
                user: {
                    name: 'Test',
                    password: 'secret',
                },
            };
            const result = sanitize(input);

            expect(result.user.name).toBe('Test');
            expect(result.user.password).toBe('[REDACTED]');
        });

        it('should handle arrays', () => {
            const input = [{ password: 'secret1' }, { password: 'secret2' }];
            const result = sanitize(input);

            expect(result[0].password).toBe('[REDACTED]');
            expect(result[1].password).toBe('[REDACTED]');
        });

        it('should handle null and undefined', () => {
            expect(sanitize(null)).toBe(null);
            expect(sanitize(undefined)).toBe(undefined);
        });

        it('should handle primitive values', () => {
            expect(sanitize('string')).toBe('string');
            expect(sanitize(123)).toBe(123);
            expect(sanitize(true)).toBe(true);
        });
    });

    describe('logger methods', () => {
        it('should have info method', () => {
            expect(typeof logger.info).toBe('function');
        });

        it('should have error method', () => {
            expect(typeof logger.error).toBe('function');
        });

        it('should have warn method', () => {
            expect(typeof logger.warn).toBe('function');
        });

        it('should have debug method', () => {
            expect(typeof logger.debug).toBe('function');
        });

        it('should create child logger', () => {
            const childLogger = logger.child('TestContext');

            expect(typeof childLogger.info).toBe('function');
            expect(typeof childLogger.error).toBe('function');
        });
    });
});
