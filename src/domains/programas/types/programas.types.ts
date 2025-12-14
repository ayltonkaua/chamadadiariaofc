/**
 * Programas Sociais Types
 */

export interface ProgramaSocialRow {
    id: string;
    nome: string;
    escola_id: string;
    ativo: boolean;
    created_at: string;
}

export interface ProgramaRegistro {
    programa_id: string;
    matricula_beneficiario: string;
    dados_pagamento: DadosPagamentoDB;
}

export interface DadosPagamentoDB {
    nome_responsavel?: string;
    cpf_responsavel?: string;
    banco?: string;
    agencia?: string;
    conta?: string;
    valor?: number | string;
    data_pagamento?: string | number;
}

export interface MappingColumns {
    matricula: string;
    nome_responsavel: string;
    cpf_responsavel: string;
    banco: string;
    agencia: string;
    conta: string;
    valor: string;
    data_pagamento: string;
}
