/**
 * Gestor (Admin Dashboard) Types
 */

export interface KpiData {
    taxa_presenca_geral: number;
    total_alunos: number;
}

export interface KpiAdminData {
    atestados_pendentes: number;
    justificativas_a_rever: number;
    faltas_hoje: number;
    turmas_sem_chamada: number;
}

export interface TurmaComparisonData {
    turma_nome: string;
    taxa_presenca: number;
    turma_id?: string;
}

export interface AlunoRiscoData {
    aluno_id: string;
    aluno_nome: string;
    turma_nome: string;
    total_faltas: number;
}

export interface AlunoFaltasConsecutivasData {
    aluno_id: string;
    aluno_nome: string;
    turma_nome: string;
    ultima_falta?: string;
    contagem_faltas_consecutivas: number;
}

export interface UltimaObservacaoData {
    aluno_nome: string;
    aluno_matricula?: string;
    titulo: string;
    descricao: string;
    created_at?: string;
    data_criacao?: string;
}

export interface UltimaPresenca {
    data_chamada: string;
    presente: boolean;
}

export interface TurmaMetadata {
    id: string;
    nome: string;
    turno: string | null;
}

export interface PresencaRecente {
    data_chamada: string;
    presente: boolean;
    turma_id: string;
    escola_id: string;
}

export interface FrequenciaDisciplinaData {
    disciplina_id: string;
    disciplina_nome: string;
    total_presencas: number;
    total_faltas: number;
    total_aulas: number;
    taxa_frequencia: number;
}

export interface FaltasDiaSemanaData {
    dia_semana_nome: string;
    dia_semana_num: number;
    total_registros: number;
    total_faltas: number;
    percentual_faltas: number;
}

export interface DashboardGestorData {
    kpis: KpiData | null;
    kpisAdmin: KpiAdminData | null;
    turmaComparison: TurmaComparisonData[];
    alunosRisco: AlunoRiscoData[];
    alunosConsecutivos: AlunoFaltasConsecutivasData[];
    ultimasObservacoes: UltimaObservacaoData[];
    turmasDisponiveis: TurmaMetadata[];
    faltasPorDiaSemana: FaltasDiaSemanaData[];
    frequenciaDisciplina: FrequenciaDisciplinaData[];
}
