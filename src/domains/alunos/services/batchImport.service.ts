/**
 * Batch Import Service
 * 
 * Optimized batch operations for importing students and classes.
 */

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/core';
import { chunk } from '@/shared';

const log = logger.child('BatchImportService');

interface AlunoImportData {
    nome: string;
    matricula: string;
    turma_id: string;
    escola_id: string;
}

interface ImportResult {
    success: boolean;
    inserted: number;
    updated: number;
    errors: string[];
}

/**
 * Batch import students with duplicate checking
 * Uses a single query for duplicate detection instead of N queries
 */
export async function batchImportAlunos(
    alunos: AlunoImportData[],
    options: {
        estrategia: 'ignorar' | 'atualizar';
        onProgress?: (current: number, total: number) => void;
    }
): Promise<ImportResult> {
    const { estrategia, onProgress } = options;
    const result: ImportResult = { success: true, inserted: 0, updated: 0, errors: [] };

    if (alunos.length === 0) return result;

    const escolaId = alunos[0].escola_id;
    const matriculas = alunos.map(a => a.matricula);

    log.info('Starting batch import', { count: alunos.length, escolaId });

    try {
        // 1. SINGLE query to find all existing students by matricula
        const { data: existentes, error: checkError } = await supabase
            .from('alunos')
            .select('id, matricula')
            .eq('escola_id', escolaId)
            .in('matricula', matriculas);

        if (checkError) throw checkError;

        // Create a map for quick lookup
        const existentesMap = new Map(
            (existentes || []).map(e => [e.matricula, e.id])
        );

        // 2. Separate into new and existing
        const novos: AlunoImportData[] = [];
        const paraAtualizar: { id: string; data: Partial<AlunoImportData> }[] = [];

        for (const aluno of alunos) {
            const existingId = existentesMap.get(aluno.matricula);

            if (existingId) {
                if (estrategia === 'atualizar') {
                    paraAtualizar.push({
                        id: existingId,
                        data: { nome: aluno.nome, turma_id: aluno.turma_id }
                    });
                }
                // If 'ignorar', we just skip
            } else {
                novos.push(aluno);
            }
        }

        // 3. Batch insert new students (in chunks of 50)
        const insertChunks = chunk(novos, 50);
        let processed = 0;

        for (const batch of insertChunks) {
            const { error: insertError } = await supabase
                .from('alunos')
                .insert(batch);

            if (insertError) {
                log.error('Batch insert error', insertError.message);
                result.errors.push(`Erro ao inserir lote: ${insertError.message}`);
            } else {
                result.inserted += batch.length;
            }

            processed += batch.length;
            onProgress?.(processed, alunos.length);
        }

        // 4. Update existing students (in chunks of 50)
        const updateChunks = chunk(paraAtualizar, 50);

        for (const batch of updateChunks) {
            for (const item of batch) {
                const { error: updateError } = await supabase
                    .from('alunos')
                    .update(item.data)
                    .eq('id', item.id);

                if (updateError) {
                    result.errors.push(`Erro ao atualizar ${item.id}: ${updateError.message}`);
                } else {
                    result.updated++;
                }
            }

            processed += batch.length;
            onProgress?.(processed, alunos.length);
        }

        log.info('Batch import complete', {
            inserted: result.inserted,
            updated: result.updated,
            errors: result.errors.length
        });

        result.success = result.errors.length === 0;
        return result;

    } catch (error: any) {
        log.error('Batch import failed', error);
        result.success = false;
        result.errors.push(error.message);
        return result;
    }
}

/**
 * Batch check for duplicate matriculas
 * Returns a set of existing matriculas
 */
export async function checkDuplicateMatriculas(
    escolaId: string,
    matriculas: string[]
): Promise<Set<string>> {
    const { data, error } = await supabase
        .from('alunos')
        .select('matricula')
        .eq('escola_id', escolaId)
        .in('matricula', matriculas);

    if (error) {
        log.error('Duplicate check failed', error.message);
        return new Set();
    }

    return new Set((data || []).map(d => d.matricula));
}
