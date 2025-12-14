/**
 * Structured Logger for Chamada Diária
 * 
 * Provides consistent, structured logging across the application.
 * Sanitizes sensitive data and outputs JSON in production.
 */

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

interface LogEntry {
    level: LogLevel;
    context: string;
    message?: string;
    timestamp: string;
    data?: Record<string, unknown>;
}

// Fields that should never be logged
const SENSITIVE_FIELDS = [
    'password', 'senha', 'token', 'secret', 'cpf', 'telefone',
    'email', 'matricula', 'access_token', 'refresh_token'
];

/**
 * Recursively sanitizes an object by masking sensitive fields
 */
function sanitize<T>(obj: T, depth = 0): T {
    if (depth > 5) return '[MAX_DEPTH]' as unknown as T;
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
        return obj.map(item => sanitize(item, depth + 1)) as unknown as T;
    }

    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
        const lowerKey = key.toLowerCase();
        if (SENSITIVE_FIELDS.some(field => lowerKey.includes(field))) {
            sanitized[key] = '[REDACTED]';
        } else if (typeof value === 'object' && value !== null) {
            sanitized[key] = sanitize(value, depth + 1);
        } else {
            sanitized[key] = value;
        }
    }
    return sanitized as T;
}

/**
 * Formats a log entry for output
 */
function formatEntry(entry: LogEntry): string {
    const isDev = import.meta.env.DEV;

    if (isDev) {
        // Human-readable format for development
        const dataStr = entry.data ? ` | ${JSON.stringify(entry.data)}` : '';
        return `[${entry.level}] ${entry.context}: ${entry.message || ''}${dataStr}`;
    }

    // JSON format for production (easier to parse by log aggregators)
    return JSON.stringify(entry);
}

/**
 * Creates a log entry and outputs it
 */
function log(level: LogLevel, context: string, message?: string, data?: Record<string, unknown>): void {
    const entry: LogEntry = {
        level,
        context,
        message,
        timestamp: new Date().toISOString(),
        data: data ? sanitize(data) : undefined
    };

    const formatted = formatEntry(entry);

    switch (level) {
        case 'DEBUG':
            if (import.meta.env.DEV) console.debug(formatted);
            break;
        case 'INFO':
            console.info(formatted);
            break;
        case 'WARN':
            console.warn(formatted);
            break;
        case 'ERROR':
            console.error(formatted);
            break;
    }
}

/**
 * Structured logger with context-aware methods
 */
export const logger = {
    /**
     * Debug-level logging (only in development)
     */
    debug: (context: string, message?: string, data?: Record<string, unknown>) =>
        log('DEBUG', context, message, data),

    /**
     * Info-level logging
     */
    info: (context: string, message?: string, data?: Record<string, unknown>) =>
        log('INFO', context, message, data),

    /**
     * Warning-level logging
     */
    warn: (context: string, message?: string, data?: Record<string, unknown>) =>
        log('WARN', context, message, data),

    /**
     * Error-level logging with Error object support
     */
    error: (context: string, error: Error | string, data?: Record<string, unknown>) => {
        const message = error instanceof Error ? error.message : error;
        const stack = error instanceof Error ? error.stack : undefined;
        log('ERROR', context, message, { ...data, stack });
    },

    /**
     * Creates a child logger with a fixed context prefix
     */
    child: (prefix: string) => ({
        debug: (message?: string, data?: Record<string, unknown>) =>
            logger.debug(prefix, message, data),
        info: (message?: string, data?: Record<string, unknown>) =>
            logger.info(prefix, message, data),
        warn: (message?: string, data?: Record<string, unknown>) =>
            logger.warn(prefix, message, data),
        error: (error: Error | string, data?: Record<string, unknown>) =>
            logger.error(prefix, error, data),
    })
};

export { sanitize };
export type { LogLevel, LogEntry };
