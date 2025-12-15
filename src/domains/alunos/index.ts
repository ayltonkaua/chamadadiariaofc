export { alunoService } from './services/aluno.service';
export { batchImportAlunos, checkDuplicateMatriculas } from './services/batchImport.service';
export { perfilAlunoService } from './services/perfilAluno.service';
export type { Aluno, AlunoInsert, AlunoUpdate, AlunoResumo, AlunoComTurma } from './types/aluno.types';
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
} from './types/perfilAluno.types';
