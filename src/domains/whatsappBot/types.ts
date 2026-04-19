/**
 * WhatsApp Bot Types
 */

export interface WhatsAppBotConfig {
    id: string;
    escola_id: string;
    template_risco: string;
    template_consecutiva: string;
    template_mensal: string;
    template_falta_diaria: string;
    template_escalacao: string;
    grupo_busca_ativa_id: string | null;
    grupos_favoritos: Array<{ id: string; name: string }>;
    auto_falta_diaria: boolean;
    auto_consecutiva: boolean;
    auto_mensal: boolean;
    horario_falta_diaria: string;
    ativo: boolean;
    tem_aula_hoje: boolean;     // NOVO CAMPO
    motivo_sem_aula: string;    // NOVO CAMPO
    created_at: string;
    updated_at: string;
}

export interface WhatsAppLog {
    id: string;
    escola_id: string;
    aluno_id: string | null;
    telefone: string;
    mensagem: string;
    tipo: 'manual' | 'risco' | 'consecutiva' | 'mensal' | 'falta_diaria' | 'escalacao' | 'busca_ativa_grupo';
    status: 'enviado' | 'falha' | 'pendente';
    erro: string | null;
    created_at: string;
}

export interface BotStatus {
    escola_id: string;
    connected: boolean;
    phone: string | null;
    hasQR: boolean;
}

export interface QRCodeResponse {
    connected: boolean;
    phone: string | null;
    qr: string | null; // data:image/png;base64,...
}

export interface SendManualPayload {
    telefone: string;
    mensagem: string;
}

export interface SendAlertPayload {
    template?: string;
}

export interface Turma {
    id: string;
    nome: string;
    turno: string;
    alunos_count: number;
    alunos_com_telefone: number;
}

export interface SendToGroupPayload {
    turma_id: string;
    mensagem: string;
}

export interface WhatsAppGroup {
    id: string;        // JID e.g. 120363012345678901@g.us
    name: string;      // Group subject/name
    participants: number;
    creation: number | null;
    desc: string;
}

export interface SendResult {
    success: boolean;
    sent?: number;
    failed?: number;
    total?: number;
    message?: string;
    error?: string;
}

export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

// =====================
// Bulk Import Types
// =====================

export interface BulkImportRow {
    matricula: string;
    telefone: string;
    telefone_2?: string;
}

export interface BulkImportResult {
    total: number;
    updated: number;
    not_found: number;
    invalid_phone: number;
    errors: Array<{ matricula: string; error: string }>;
}

// =====================
// Group Participant Types
// =====================

export interface GroupCandidate {
    id: string;
    nome: string;
    matricula: string;
    turma: string;
    telefone_responsavel: string | null;
    telefone_responsavel_2: string | null;
}

export interface AddToGroupResult {
    added: number;
    failed: number;
    total: number;
    details: Array<{
        phone: string;
        success: boolean;
        error?: string;
    }>;
}

export interface SendProgress {
    active: boolean;
    turma: string;
    total: number;
    sent: number;
    failed: number;
    processed: number;
    remaining: number;
    currentPhone: string;
    currentName: string;
    elapsedMs: number;
    estimatedRemainingMs: number;
    percentComplete: number;
}

// =====================
// AI Message Generation Types
// =====================

export type AiMessageTom = 'formal' | 'amigavel' | 'urgente' | 'informativo';
export type AiMessageTipo = 'aviso' | 'evento' | 'reuniao' | 'frequencia' | 'outro';

export interface AiMessageRequest {
    descricao: string;
    tom: AiMessageTom;
    tipo: AiMessageTipo;
}

export interface AiMessageResponse {
    versoes: string[];
    modelo: string;
}

// =====================
// Inbound Justificativas Types
// =====================

export type JustificativaStatus = 'PENDENTE' | 'APROVADA' | 'RECUSADA';

export interface JustificativaPendente {
    id: string;
    escola_id: string;
    aluno_id: string;
    data_falta: string; // YYYY-MM-DD
    telefone_origem: string;
    mensagem_pai: string;
    status: JustificativaStatus;
    data_recebimento: string;
    reviewer_id: string | null;
    data_revisao: string | null;
    
    // Relational fields useful for the UI
    aluno?: {
        nome: string;
        matricula: string;
        turma?: {
            nome: string;
        };
    };
}

// =====================
// WhatsApp Atendimentos (URA) Types
// =====================

export type AtendimentoSetor = 'carteirinha' | 'boletim' | 'declaracao' | 'pe_de_meia' | 'secretaria' | 'correcao_beneficio';
export type AtendimentoStatus = 'ABERTO' | 'EM_ATENDIMENTO' | 'FINALIZADO';

export interface AtendimentoReply {
    remetente: 'secretaria' | 'pai';
    mensagem: string;
    timestamp: string;
}

export interface WhatsAppAtendimento {
    id: string;
    escola_id: string;
    telefone_origem: string;
    nome_contato: string | null;
    setor: AtendimentoSetor;
    mensagem_inicial: string | null;
    status: AtendimentoStatus;
    respostas: AtendimentoReply[];
    created_at: string;
    updated_at: string;
}

// =====================
// CRM Contact Info Types
// =====================

export interface ContactAluno {
    id: string;
    nome: string;
    matricula: string;
    situacao: string;
    turma_nome: string | null;
}

export interface ContactInfo {
    nome_responsavel: string | null;
    alunos: ContactAluno[];
    tickets_anteriores: number;
    primeiro_contato: string | null;
}

