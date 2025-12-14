/**
 * Supabase Adapter for Chamada Diária
 * 
 * Provides a typed abstraction layer over the Supabase client
 * with built-in error handling, logging, and offline awareness.
 */

import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { logger } from '@/core/logger';
import { DatabaseError, NetworkError, NotFoundError } from '@/core/errors';

// Type helpers for table names and rows
type TableName = keyof Database['public']['Tables'];
type TableRow<T extends TableName> = Database['public']['Tables'][T]['Row'];
type TableInsert<T extends TableName> = Database['public']['Tables'][T]['Insert'];
type TableUpdate<T extends TableName> = Database['public']['Tables'][T]['Update'];

// Query options
interface QueryOptions {
    /** Columns to select (default: '*') */
    select?: string;
    /** Order by column */
    orderBy?: { column: string; ascending?: boolean };
    /** Limit results */
    limit?: number;
    /** Offset for pagination */
    offset?: number;
}

interface FilterOptions<T> {
    /** Equality filters */
    eq?: Partial<T>;
    /** In array filter */
    in?: { column: keyof T; values: unknown[] };
    /** Greater than or equal */
    gte?: Partial<T>;
    /** Less than or equal */
    lte?: Partial<T>;
}

const log = logger.child('SupabaseAdapter');

/**
 * Checks if the error is a network-related error
 */
function isNetworkError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const message = error.message.toLowerCase();
    return (
        message.includes('failed to fetch') ||
        message.includes('network') ||
        message.includes('offline') ||
        message.includes('timeout')
    );
}

/**
 * Creates a Supabase adapter for a specific table
 */
export function createTableAdapter<T extends TableName>(tableName: T) {
    type Row = TableRow<T>;
    type Insert = TableInsert<T>;
    type Update = TableUpdate<T>;

    return {
        /**
         * Fetches all rows matching the filters
         */
        async findMany(
            filters?: FilterOptions<Row>,
            options?: QueryOptions
        ): Promise<Row[]> {
            log.debug(`findMany`, { table: tableName, filters, options });

            if (!navigator.onLine) {
                throw new NetworkError('Sem conexão com a internet', true);
            }

            try {
                let query = supabase
                    .from(tableName)
                    .select(options?.select || '*');

                // Apply equality filters
                if (filters?.eq) {
                    for (const [key, value] of Object.entries(filters.eq)) {
                        query = query.eq(key, value);
                    }
                }

                // Apply IN filter
                if (filters?.in) {
                    query = query.in(String(filters.in.column), filters.in.values);
                }

                // Apply GTE filter
                if (filters?.gte) {
                    for (const [key, value] of Object.entries(filters.gte)) {
                        query = query.gte(key, value);
                    }
                }

                // Apply LTE filter
                if (filters?.lte) {
                    for (const [key, value] of Object.entries(filters.lte)) {
                        query = query.lte(key, value);
                    }
                }

                // Apply ordering
                if (options?.orderBy) {
                    query = query.order(options.orderBy.column, {
                        ascending: options.orderBy.ascending ?? true
                    });
                }

                // Apply pagination
                if (options?.limit) {
                    query = query.limit(options.limit);
                }
                if (options?.offset) {
                    query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
                }

                const { data, error } = await query;

                if (error) {
                    log.error(`findMany error`, error, { table: tableName });
                    throw new DatabaseError(error.message, { table: tableName });
                }

                log.debug(`findMany success`, { table: tableName, count: data?.length || 0 });
                return (data || []) as Row[];

            } catch (error) {
                if (isNetworkError(error)) {
                    throw new NetworkError('Falha na conexão durante a consulta', !navigator.onLine);
                }
                throw error;
            }
        },

        /**
         * Fetches a single row by ID or filters
         */
        async findOne(filters: FilterOptions<Row>): Promise<Row | null> {
            log.debug(`findOne`, { table: tableName, filters });

            if (!navigator.onLine) {
                throw new NetworkError('Sem conexão com a internet', true);
            }

            try {
                let query = supabase.from(tableName).select('*');

                if (filters?.eq) {
                    for (const [key, value] of Object.entries(filters.eq)) {
                        query = query.eq(key, value);
                    }
                }

                const { data, error } = await query.maybeSingle();

                if (error) {
                    log.error(`findOne error`, error, { table: tableName });
                    throw new DatabaseError(error.message, { table: tableName });
                }

                return data as Row | null;

            } catch (error) {
                if (isNetworkError(error)) {
                    throw new NetworkError('Falha na conexão durante a consulta', !navigator.onLine);
                }
                throw error;
            }
        },

        /**
         * Fetches a single row, throws if not found
         */
        async findOneOrThrow(filters: FilterOptions<Row>): Promise<Row> {
            const result = await this.findOne(filters);
            if (!result) {
                throw new NotFoundError(tableName);
            }
            return result;
        },

        /**
         * Creates a new row
         */
        async create(data: Insert): Promise<Row> {
            log.debug(`create`, { table: tableName });

            if (!navigator.onLine) {
                throw new NetworkError('Sem conexão com a internet', true);
            }

            try {
                const { data: created, error } = await supabase
                    .from(tableName)
                    .insert(data as any)
                    .select()
                    .single();

                if (error) {
                    log.error(`create error`, error, { table: tableName });
                    throw new DatabaseError(error.message, { table: tableName });
                }

                log.info(`create success`, { table: tableName, id: (created as any)?.id });
                return created as Row;

            } catch (error) {
                if (isNetworkError(error)) {
                    throw new NetworkError('Falha na conexão durante a criação', !navigator.onLine);
                }
                throw error;
            }
        },

        /**
         * Creates multiple rows in batch
         */
        async createMany(dataArray: Insert[]): Promise<Row[]> {
            log.debug(`createMany`, { table: tableName, count: dataArray.length });

            if (!navigator.onLine) {
                throw new NetworkError('Sem conexão com a internet', true);
            }

            if (dataArray.length === 0) return [];

            try {
                const { data: created, error } = await supabase
                    .from(tableName)
                    .insert(dataArray as any[])
                    .select();

                if (error) {
                    log.error(`createMany error`, error, { table: tableName });
                    throw new DatabaseError(error.message, { table: tableName });
                }

                log.info(`createMany success`, { table: tableName, count: created?.length || 0 });
                return (created || []) as Row[];

            } catch (error) {
                if (isNetworkError(error)) {
                    throw new NetworkError('Falha na conexão durante a criação em lote', !navigator.onLine);
                }
                throw error;
            }
        },

        /**
         * Updates rows matching filters
         */
        async update(filters: FilterOptions<Row>, data: Update): Promise<Row[]> {
            log.debug(`update`, { table: tableName, filters });

            if (!navigator.onLine) {
                throw new NetworkError('Sem conexão com a internet', true);
            }

            try {
                let query = supabase.from(tableName).update(data as any);

                if (filters?.eq) {
                    for (const [key, value] of Object.entries(filters.eq)) {
                        query = query.eq(key, value);
                    }
                }

                const { data: updated, error } = await query.select();

                if (error) {
                    log.error(`update error`, error, { table: tableName });
                    throw new DatabaseError(error.message, { table: tableName });
                }

                log.info(`update success`, { table: tableName, count: updated?.length || 0 });
                return (updated || []) as Row[];

            } catch (error) {
                if (isNetworkError(error)) {
                    throw new NetworkError('Falha na conexão durante a atualização', !navigator.onLine);
                }
                throw error;
            }
        },

        /**
         * Deletes rows matching filters
         */
        async delete(filters: FilterOptions<Row>): Promise<void> {
            log.debug(`delete`, { table: tableName, filters });

            if (!navigator.onLine) {
                throw new NetworkError('Sem conexão com a internet', true);
            }

            try {
                let query = supabase.from(tableName).delete();

                if (filters?.eq) {
                    for (const [key, value] of Object.entries(filters.eq)) {
                        query = query.eq(key, value);
                    }
                }

                const { error } = await query;

                if (error) {
                    log.error(`delete error`, error, { table: tableName });
                    throw new DatabaseError(error.message, { table: tableName });
                }

                log.info(`delete success`, { table: tableName });

            } catch (error) {
                if (isNetworkError(error)) {
                    throw new NetworkError('Falha na conexão durante a exclusão', !navigator.onLine);
                }
                throw error;
            }
        },

        /**
         * Upserts (insert or update) rows
         */
        async upsert(
            data: Insert | Insert[],
            options?: { onConflict?: string }
        ): Promise<Row[]> {
            log.debug(`upsert`, { table: tableName, isArray: Array.isArray(data) });

            if (!navigator.onLine) {
                throw new NetworkError('Sem conexão com a internet', true);
            }

            try {
                const { data: upserted, error } = await supabase
                    .from(tableName)
                    .upsert(data as any, {
                        onConflict: options?.onConflict,
                        ignoreDuplicates: false
                    })
                    .select();

                if (error) {
                    log.error(`upsert error`, error, { table: tableName });
                    throw new DatabaseError(error.message, { table: tableName });
                }

                log.info(`upsert success`, { table: tableName, count: upserted?.length || 0 });
                return (upserted || []) as Row[];

            } catch (error) {
                if (isNetworkError(error)) {
                    throw new NetworkError('Falha na conexão durante o upsert', !navigator.onLine);
                }
                throw error;
            }
        },

        /**
         * Counts rows matching filters
         */
        async count(filters?: FilterOptions<Row>): Promise<number> {
            log.debug(`count`, { table: tableName, filters });

            if (!navigator.onLine) {
                throw new NetworkError('Sem conexão com a internet', true);
            }

            try {
                let query = supabase
                    .from(tableName)
                    .select('id', { count: 'exact', head: true });

                if (filters?.eq) {
                    for (const [key, value] of Object.entries(filters.eq)) {
                        query = query.eq(key, value);
                    }
                }

                const { count, error } = await query;

                if (error) {
                    log.error(`count error`, error, { table: tableName });
                    throw new DatabaseError(error.message, { table: tableName });
                }

                return count || 0;

            } catch (error) {
                if (isNetworkError(error)) {
                    throw new NetworkError('Falha na conexão durante a contagem', !navigator.onLine);
                }
                throw error;
            }
        }
    };
}

// Pre-built adapters for main tables
export const alunosAdapter = createTableAdapter('alunos');
export const turmasAdapter = createTableAdapter('turmas');
export const presencasAdapter = createTableAdapter('presencas');
export const atestadosAdapter = createTableAdapter('atestados');
export const escolaConfigAdapter = createTableAdapter('escola_configuracao');
export const userRolesAdapter = createTableAdapter('user_roles');
