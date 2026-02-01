/**
 * Presenca (Attendance) Types
 * 
 * Type definitions for the Chamada/Presenca domain.
 */

import type { Database } from '@/integrations/supabase/types';

// Database row type
export type Presenca = Database['public']['Tables']['presencas']['Row'];
export type PresencaInsert = Database['public']['Tables']['presencas']['Insert'];
export type PresencaUpdate = Database['public']['Tables']['presencas']['Update'];

// Visual status for attendance
export type StatusPresenca = 'presente' | 'falta' | 'atestado';

// Attendance record for a single student
export interface RegistroPresenca {
    alunoId: string;
    presente: boolean;
    faltaJustificada: boolean;
}

// Payload for saving attendance
export interface ChamadaPayload {
    turmaId: string;
    escolaId: string;
    dataChamada: string;
    disciplinaId?: string;
    registros: RegistroPresenca[];
}

// Summary of attendance for a date
export interface ResumoChamada {
    data: string;
    presentes: number;
    faltas: number;
    atestados: number;
    total: number;
}

// Historical attendance record
export interface HistoricoChamada {
    data: string;
    presentes: number;
    faltosos: number;
    total: number;
    presencas: Array<{
        aluno_id: string;
        presente: boolean;
        falta_justificada?: boolean;
    }>;
}
