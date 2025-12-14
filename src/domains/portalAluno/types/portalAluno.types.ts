/**
 * Portal Aluno Types
 * 
 * Type definitions for the student portal domain.
 */

/**
 * Student data with attendance statistics
 */
export interface StudentData {
    turma: string;
    matricula: string;
    frequencia: number;
    status: 'Excelente' | 'Regular' | 'Atenção' | 'Crítico';
    totalAulas: number;
    totalFaltas: number;
    dadosIncompletos: boolean;
}

/**
 * Raw student info from database
 */
export interface AlunoInfo {
    id: string;
    matricula: string;
    turma_id: string;
    turmas?: { nome: string };
    nome_responsavel?: string;
    telefone_responsavel?: string;
    endereco?: string;
}

/**
 * Student's submitted medical certificates
 */
export interface MeusAtestados {
    id: string;
    data_inicio: string;
    data_fim: string;
    descricao: string;
    status: 'pendente' | 'aprovado' | 'rejeitado';
    created_at: string;
}

/**
 * Benefit received by student
 */
export interface Beneficio {
    id: string;
    programa_nome: string;
    situacao: string;
    valor?: number;
    data_pagamento?: string | number;
    nome_responsavel?: string;
    cpf_responsavel?: string;
    banco?: string;
    agencia?: string;
    conta?: string;
}

/**
 * Portal data containing all student information
 */
export interface PortalAlunoData {
    studentData: StudentData;
    beneficios: Beneficio[];
    atestados: MeusAtestados[];
}
