/**
 * Ano Letivo Types
 * 
 * Type definitions for academic year management.
 */

export type AnoLetivoStatus = 'planejamento' | 'aberto' | 'fechado' | 'arquivado';

export interface AnoLetivo {
    id: string;
    escola_id: string;
    ano: number;
    nome: string;
    data_inicio: string;
    data_fim: string;
    status: AnoLetivoStatus;
    criado_por?: string;
    fechado_por?: string;
    fechado_em?: string;
    created_at: string;
    updated_at: string;
}

export interface AnoLetivoInsert {
    escola_id: string;
    ano: number;
    nome: string;
    data_inicio: string;
    data_fim: string;
    status?: AnoLetivoStatus;
}

export interface AnoLetivoUpdate {
    nome?: string;
    data_inicio?: string;
    data_fim?: string;
    status?: AnoLetivoStatus;
}

export interface AnoLetivoComStats extends AnoLetivo {
    total_turmas: number;
    total_alunos: number;
}

export interface MigracaoResult {
    success: boolean;
    ano_letivo_id: string;
    turmas_migradas: number;
    message: string;
}
