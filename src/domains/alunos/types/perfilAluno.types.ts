/**
 * Tipos para o Perfil Completo do Aluno
 * 
 * Define todas as interfaces necessárias para a funcionalidade
 * de Perfil do Aluno, incluindo indicadores, histórico e observações.
 */

export interface PerfilAluno {
    // Dados pessoais (tabela alunos)
    id: string;
    nome: string;
    matricula: string;
    turmaId: string;
    turmaNome: string;
    escolaId: string;
    escolaNome: string;
    nomeResponsavel?: string;
    telefoneResponsavel?: string;
    endereco?: string;
    dadosAtualizadosEm?: string;
}

export interface IndicadoresAluno {
    totalChamadas: number;
    totalFaltas: number;
    faltasJustificadas: number;
    percentualPresenca: number;
    faltasConsecutivas: number;
    situacao: 'Regular' | 'Risco' | 'Evasao';
}

export interface HistoricoPresenca {
    data: string;
    presente: boolean;
    faltaJustificada: boolean;
}

export interface NotaAluno {
    disciplinaId: string;
    disciplinaNome: string;
    disciplinaCor: string;
    semestre: number;
    valor: number;
    tipoAvaliacao: string;
}

export interface NotasPorDisciplina {
    disciplinaId: string;
    disciplinaNome: string;
    disciplinaCor: string;
    notas: {
        semestre: number;
        valor: number;
        tipoAvaliacao: string;
    }[];
    media: number;
    situacao: 'Aprovado' | 'Reprovado' | 'Cursando';
}

export interface TransferenciaAluno {
    id: string;
    dataTransferencia: string;
    turmaOrigemNome: string;
    turmaDestinoNome: string;
    motivo?: string;
    realizadoPor?: string;
}

export interface ObservacaoAluno {
    id: string;
    dataObservacao: string;
    titulo: string;
    descricao: string;
    autorNome?: string;
    turmaNome?: string;
}

export interface ContatoBuscaAtiva {
    id: string;
    dataContato: string;
    formaContato: string;
    justificativaFaltas: string;
    monitorResponsavel: string;
    linkArquivo?: string;
}

export interface PerfilCompletoAluno {
    dadosPessoais: PerfilAluno;
    indicadores: IndicadoresAluno;
}
