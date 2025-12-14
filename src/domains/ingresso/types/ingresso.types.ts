/**
 * Ingresso Types
 */

export interface EventoPublico {
    id: string;
    nome: string;
    data_evento: string;
    escola_id: string;
    ativo: boolean;
}

export interface CheckinRegistro {
    id: string;
    evento_id: string;
    aluno_id?: string;
    convidado_id?: string;
    tipo: 'aluno' | 'convidado' | 'staff';
    created_at: string;
}

export interface AlunoIngresso {
    id: string;
    nome: string;
    matricula: string;
    turmas?: { nome: string };
}
