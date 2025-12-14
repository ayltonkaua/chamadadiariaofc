/**
 * Observacoes Types
 */

export interface Observacao {
    id?: string;
    aluno_id: string;
    turma_id: string;
    escola_id: string;
    user_id: string;
    data_observacao: string;
    titulo: string;
    descricao: string;
}
