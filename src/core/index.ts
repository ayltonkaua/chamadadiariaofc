/**
 * Core Infrastructure Module
 * 
 * Central export for all core infrastructure utilities.
 */

// Logger
export { logger, sanitize } from './logger';
export type { LogLevel, LogEntry } from './logger';

// Errors
export {
    AppError,
    DatabaseError,
    NotFoundError,
    AuthError,
    NetworkError,
    ValidationError,
    isAppError,
    wrapError,
} from './errors';
export type { ErrorCode } from './errors';

// Adapters
export {
    createTableAdapter,
    alunosAdapter,
    turmasAdapter,
    presencasAdapter,
    atestadosAdapter,
    escolaConfigAdapter,
    userRolesAdapter,
} from './adapters';
