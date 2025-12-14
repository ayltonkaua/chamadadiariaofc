/**
 * Alertas Types
 * 
 * Type definitions for attendance alerts.
 */

export interface AlertaFrequencia {
    aluno_id: string;
    nome: string;
    turma_nome: string;
    total_aulas: number;
    total_faltas: number;
    percentual_faltas: number;
}

export interface AlertaGerado {
    id: string;
    alunoNome: string;
    turmaNome: string;
    mensagem: string;
    tipo: 'Faltas Elevadas' | 'Outro';
    dadosAdicionais: {
        totalAulas: number;
        totalFaltas: number;
        taxaFaltas: number;
    };
}

export const LIMITE_FALTAS_PERCENTUAL = 25;
