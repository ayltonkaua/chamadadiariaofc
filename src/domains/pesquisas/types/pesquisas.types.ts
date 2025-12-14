/**
 * Pesquisas Types
 */

export interface Pesquisa {
    id: string;
    titulo: string;
    descricao: string | null;
    status: 'ativa' | 'inativa';
    user_id: string;
    created_at: string;
    slug?: string;
}

export interface PerguntaPesquisa {
    id: string;
    pesquisa_id: string;
    texto: string;
    tipo: 'texto' | 'multipla_escolha' | 'escala';
    opcoes?: string[];
    ordem: number;
}

export interface RespostaPesquisa {
    id: string;
    pesquisa_id: string;
    pergunta_id: string;
    resposta: string;
    respondente_id?: string;
    created_at: string;
}

export interface PesquisaInsert {
    titulo: string;
    descricao?: string;
    status?: string;
    user_id: string;
}
