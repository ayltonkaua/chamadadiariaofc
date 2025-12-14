/**
 * Programas Sociais Service
 * 
 * Business logic for social programs management.
 */

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/core';
import type { ProgramaSocialRow, ProgramaRegistro, MappingColumns } from '../types/programas.types';

const log = logger.child('ProgramasService');

export const programasService = {
    /**
     * Load all programs for a school
     */
    async loadProgramas(escolaId: string): Promise<ProgramaSocialRow[]> {
        log.debug('Loading programas', { escolaId });

        const { data, error } = await (supabase as any)
            .from('programas_sociais')
            .select('*')
            .eq('escola_id', escolaId)
            .order('created_at', { ascending: false });

        if (error) {
            log.error('Failed to load programas', error);
            return [];
        }

        return data || [];
    },

    /**
     * Create a new program
     */
    async createPrograma(nome: string, escolaId: string): Promise<ProgramaSocialRow> {
        log.info('Creating programa', { nome, escolaId });

        const { data, error } = await (supabase as any)
            .from('programas_sociais')
            .insert({
                nome,
                escola_id: escolaId,
                ativo: true
            })
            .select()
            .single();

        if (error) {
            log.error('Failed to create programa', error);
            throw new Error(error.message);
        }

        return data;
    },

    /**
     * Import program records in batches
     */
    async importRegistros(
        programaId: string,
        excelData: any[],
        mapping: MappingColumns,
        onProgress?: (processed: number, total: number) => void
    ): Promise<{ total: number; imported: number }> {
        log.info('Importing registros', { programaId, total: excelData.length });

        const chunkSize = 50;
        let processados = 0;

        for (let i = 0; i < excelData.length; i += chunkSize) {
            const chunk = excelData.slice(i, i + chunkSize);

            const registrosParaInserir: ProgramaRegistro[] = chunk.map((row: any) => ({
                programa_id: programaId,
                matricula_beneficiario: String(row[mapping.matricula]).trim(),
                dados_pagamento: {
                    nome_responsavel: row[mapping.nome_responsavel],
                    cpf_responsavel: row[mapping.cpf_responsavel],
                    banco: row[mapping.banco],
                    agencia: row[mapping.agencia],
                    conta: row[mapping.conta],
                    valor: row[mapping.valor],
                    data_pagamento: row[mapping.data_pagamento]
                        ? String(row[mapping.data_pagamento]).trim()
                        : null
                }
            }));

            const { error } = await (supabase as any)
                .from('programas_registros')
                .insert(registrosParaInserir);

            if (error) {
                log.error('Failed to import chunk', error);
                throw new Error(error.message);
            }

            processados += chunk.length;
            onProgress?.(Math.min(processados, excelData.length), excelData.length);
        }

        log.info('Import completed', { total: excelData.length, imported: processados });
        return { total: excelData.length, imported: processados };
    },

    /**
     * Toggle program active status
     */
    async toggleAtivo(id: string, atual: boolean): Promise<void> {
        log.info('Toggling programa ativo', { id, newValue: !atual });

        const { error } = await (supabase as any)
            .from('programas_sociais')
            .update({ ativo: !atual })
            .eq('id', id);

        if (error) {
            log.error('Failed to toggle ativo', error);
            throw new Error(error.message);
        }
    },

    /**
     * Delete a program and all its records
     */
    async deletePrograma(id: string): Promise<void> {
        log.warn('Deleting programa', { id });

        const { error } = await (supabase as any)
            .from('programas_sociais')
            .delete()
            .eq('id', id);

        if (error) {
            log.error('Failed to delete programa', error);
            throw new Error(error.message);
        }
    }
};
