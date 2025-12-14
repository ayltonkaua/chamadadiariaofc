/**
 * Turma Types
 * 
 * Type definitions for the Turma domain.
 */

import type { Database } from '@/integrations/supabase/types';

// Database row type
export type Turma = Database['public']['Tables']['turmas']['Row'];
export type TurmaInsert = Database['public']['Tables']['turmas']['Insert'];
export type TurmaUpdate = Database['public']['Tables']['turmas']['Update'];

// Domain-specific DTOs
export interface TurmaResumo {
    id: string;
    nome: string;
    numeroSala: string;
    turno: string | null;
    escolaId: string;
}

export interface TurmaComContagem extends Turma {
    _count?: {
        alunos: number;
    };
    alunos?: number;
}

export type TurnoType = 'Manhã' | 'Tarde' | 'Noite' | 'Integral';
