/**
 * Domains Module
 * 
 * Central export for all domain services and types.
 */

// Re-export logger from core for convenience
export { logger } from '@/core';

// Alunos
export { alunoService } from './alunos';
export { batchImportAlunos, checkDuplicateMatriculas } from './alunos';
export { perfilAlunoService } from './alunos';
export type { Aluno, AlunoInsert, AlunoUpdate, AlunoResumo, AlunoComTurma } from './alunos';
export type {
    PerfilAluno,
    IndicadoresAluno,
    HistoricoPresenca,
    NotaAluno,
    NotasPorDisciplina,
    TransferenciaAluno,
    ObservacaoAluno,
    ContatoBuscaAtiva,
    PerfilCompletoAluno
} from './alunos';

// Turmas
export { turmaService } from './turmas';
export type { Turma, TurmaInsert, TurmaUpdate, TurmaResumo, TurmaComContagem, TurnoType } from './turmas';

// Chamada / Presenca
export { presencaService } from './chamada';
export type {
    Presenca,
    PresencaInsert,
    StatusPresenca,
    RegistroPresenca,
    ChamadaPayload,
    HistoricoChamada
} from './chamada';

// Escola
export { escolaService } from './escola';
export type { EscolaConfig, EscolaConfigUpdate, EscolaTema } from './escola';

// Alertas
export { alertasService } from './alertas';
export type { AlertaFrequencia, AlertaGerado } from './alertas';

// Beneficios
export { beneficiosService } from './beneficios';
export type { ProgramaSocial, BeneficioRegistro, DadosPagamento } from './beneficios';

// Atestados
export { atestadosService } from './atestados';
export type {
    Atestado,
    AtestadoStatus,
    AtestadoInsert,
    AtestadoFilter,
    AtestadoPaginatedResult
} from './atestados';

// Observacoes
export { observacoesService } from './observacoes';
export type { Observacao } from './observacoes';

// Gestor (Admin Dashboard)
export { gestorService } from './gestor';
export type {
    KpiData,
    KpiAdminData,
    TurmaComparisonData,
    AlunoRiscoData,
    AlunoFaltasConsecutivasData,
    UltimaObservacaoData,
    TurmaMetadata,
    PresencaRecente,
    DashboardGestorData,
    UltimaPresenca
} from './gestor';

// Acesso (User Access Management)
export { acessoService } from './acesso';
export type { MembroEquipe, AlunoAcesso, ConviteAcesso } from './acesso';

// Atrasos (Tardy Records)
export { atrasosService } from './atrasos';
export type { RegistroAtraso, RegistroAtrasoInsert, RegistroAtrasoFormatado } from './atrasos';

// Programas Sociais (Social Programs)
export { programasService } from './programas';
export type { ProgramaSocialRow, ProgramaRegistro, MappingColumns } from './programas';
