/**
 * Aluno Types
 * 
 * Type definitions for the Aluno domain.
 */

import type { Database } from '@/integrations/supabase/types';

// Database row type
export type Aluno = Database['public']['Tables']['alunos']['Row'];
export type AlunoInsert = Database['public']['Tables']['alunos']['Insert'];
export type AlunoUpdate = Database['public']['Tables']['alunos']['Update'];

// Domain-specific DTOs
export interface AlunoResumo {
    id: string;
    nome: string;
    matricula: string;
    turmaId: string;
}

export interface AlunoComTurma extends Aluno {
    turma?: {
        id: string;
        nome: string;
        numero_sala: string;
    };
}
