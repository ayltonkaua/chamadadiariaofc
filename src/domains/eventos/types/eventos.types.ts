/**
 * Eventos Types
 */

export interface Evento {
    id: string;
    nome: string;
    data_evento: string;
    escola_id: string;
    ativo: boolean;
    created_at: string;
    eventos_checkins?: { count: number }[];
}

export interface EventoStaff {
    id: string;
    evento_id: string;
    aluno_id: string;
    alunos?: { id: string; nome: string };
}

export interface EventoConvidado {
    id: string;
    evento_id: string;
    nome: string;
    tipo: string;
    created_at: string;
}

export interface AlunoSearchResult {
    id: string;
    nome: string;
    turmas?: { nome: string; escola_id: string } | { nome: string; escola_id: string }[];
}
