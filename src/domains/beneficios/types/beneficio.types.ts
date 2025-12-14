/**
 * Beneficios Types
 * 
 * Type definitions for social programs and benefits.
 */

export interface ProgramaSocial {
    id: string;
    nome: string;
    ativo: boolean;
}

export interface BeneficioRegistro {
    id: string;
    matricula_beneficiario: string;
    programa_id: string;
    dados_pagamento: DadosPagamento | null;
    created_at: string;
    programas_sociais: ProgramaSocial | null;
}

export interface DadosPagamento {
    valor?: string;
    data_pagamento?: string;
    nome_responsavel?: string;
    cpf_responsavel?: string;
    banco?: string;
    agencia?: string;
    conta?: string;
}
