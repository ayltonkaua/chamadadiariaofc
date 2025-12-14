/**
 * Atestados Types
 */

export type AtestadoStatus = 'pendente' | 'aprovado' | 'rejeitado';

export interface Atestado {
    id: string;
    aluno_id: string;
    escola_id?: string;
    data_inicio: string;
    data_fim: string;
    descricao: string;
    status: AtestadoStatus;
    created_at: string;
    alunos?: {
        nome: string;
        turmas: {
            nome: string;
        } | null;
    } | null;
}

export interface AtestadoInsert {
    id?: string;
    aluno_id: string;
    escola_id?: string;
    data_inicio: string;
    data_fim: string;
    descricao: string;
    status?: AtestadoStatus;
}

export interface AtestadoFilter {
    status?: AtestadoStatus;
    searchTerm?: string;
    dateFrom?: string;
    dateTo?: string;
}

export interface AtestadoPaginatedResult {
    data: Atestado[];
    count: number;
}
