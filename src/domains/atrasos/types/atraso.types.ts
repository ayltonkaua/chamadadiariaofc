/**
 * Atrasos (Tardy Records) Types
 */

export interface RegistroAtraso {
    id: string;
    aluno_id: string;
    data_atraso: string;
    horario_registro: string;
    criado_em?: string;
}

export interface RegistroAtrasoInsert {
    id?: string;
    aluno_id: string;
    data_atraso: string;
    horario_registro: string;
}

export interface RegistroAtrasoFormatado extends RegistroAtraso {
    nomeAluno: string;
    matriculaAluno: string;
}
