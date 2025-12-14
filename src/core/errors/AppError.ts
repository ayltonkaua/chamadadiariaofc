/**
 * Application Error Types for Chamada Diária
 * 
 * Provides typed, structured errors for better error handling
 * and debugging across the application.
 */

export type ErrorCode =
    // Authentication
    | 'AUTH_UNAUTHENTICATED'
    | 'AUTH_UNAUTHORIZED'
    | 'AUTH_SESSION_EXPIRED'
    // Database
    | 'DB_QUERY_FAILED'
    | 'DB_NOT_FOUND'
    | 'DB_DUPLICATE'
    | 'DB_CONSTRAINT_VIOLATION'
    // Network
    | 'NETWORK_OFFLINE'
    | 'NETWORK_TIMEOUT'
    | 'NETWORK_REQUEST_FAILED'
    // Validation
    | 'VALIDATION_FAILED'
    | 'VALIDATION_REQUIRED_FIELD'
    // Business Logic
    | 'BUSINESS_ESCOLA_NOT_FOUND'
    | 'BUSINESS_TURMA_NOT_FOUND'
    | 'BUSINESS_ALUNO_NOT_FOUND'
    | 'BUSINESS_CHAMADA_DUPLICATE'
    // Generic
    | 'UNKNOWN_ERROR';

interface ErrorDetails {
    field?: string;
    expected?: string;
    received?: string;
    [key: string]: unknown;
}

/**
 * Base application error with code and metadata
 */
export class AppError extends Error {
    public readonly code: ErrorCode;
    public readonly details?: ErrorDetails;
    public readonly isOperational: boolean;
    public readonly timestamp: Date;

    constructor(
        code: ErrorCode,
        message: string,
        details?: ErrorDetails,
        isOperational = true
    ) {
        super(message);
        this.name = 'AppError';
        this.code = code;
        this.details = details;
        this.isOperational = isOperational;
        this.timestamp = new Date();

        // Maintains proper stack trace
        Error.captureStackTrace?.(this, this.constructor);
    }

    /**
     * Serializes error for logging or API response
     */
    toJSON(): Record<string, unknown> {
        return {
            name: this.name,
            code: this.code,
            message: this.message,
            details: this.details,
            timestamp: this.timestamp.toISOString(),
        };
    }
}

/**
 * Database-specific errors
 */
export class DatabaseError extends AppError {
    constructor(message: string, details?: ErrorDetails) {
        super('DB_QUERY_FAILED', message, details);
        this.name = 'DatabaseError';
    }
}

export class NotFoundError extends AppError {
    constructor(entity: string, id?: string) {
        super(
            'DB_NOT_FOUND',
            `${entity} não encontrado${id ? `: ${id}` : ''}`,
            { entity, id }
        );
        this.name = 'NotFoundError';
    }
}

/**
 * Authentication errors
 */
export class AuthError extends AppError {
    constructor(code: Extract<ErrorCode, `AUTH_${string}`>, message: string) {
        super(code, message);
        this.name = 'AuthError';
    }
}

/**
 * Network errors
 */
export class NetworkError extends AppError {
    public readonly isOffline: boolean;

    constructor(message: string, isOffline = false) {
        super(
            isOffline ? 'NETWORK_OFFLINE' : 'NETWORK_REQUEST_FAILED',
            message
        );
        this.name = 'NetworkError';
        this.isOffline = isOffline;
    }
}

/**
 * Validation errors
 */
export class ValidationError extends AppError {
    constructor(message: string, details?: ErrorDetails) {
        super('VALIDATION_FAILED', message, details);
        this.name = 'ValidationError';
    }
}

/**
 * Type guard to check if an error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
    return error instanceof AppError;
}

/**
 * Wraps an unknown error into an AppError
 */
export function wrapError(error: unknown, fallbackMessage = 'Erro desconhecido'): AppError {
    if (isAppError(error)) {
        return error;
    }

    if (error instanceof Error) {
        return new AppError('UNKNOWN_ERROR', error.message, { originalName: error.name });
    }

    return new AppError('UNKNOWN_ERROR', fallbackMessage);
}
