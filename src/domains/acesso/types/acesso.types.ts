/**
 * Acesso (Access Management) Types
 */

export interface MembroEquipe {
    user_id: string;
    nome: string;
    email: string;
    role: string;
    last_sign_in_at?: string;
}

export interface AlunoAcesso {
    id: string;
    nome: string;
    matricula: string;
    turma_nome: string;
    user_id: string | null;
}

export interface ConviteAcesso {
    email: string;
    escola_id: string;
    role: string;
}
