/**
 * WhatsApp Bot Types
 */

export interface WhatsAppBotConfig {
    id: string;
    escola_id: string;
    template_risco: string;
    template_consecutiva: string;
    template_mensal: string;
    ativo: boolean;
    created_at: string;
    updated_at: string;
}

export interface WhatsAppLog {
    id: string;
    escola_id: string;
    aluno_id: string | null;
    telefone: string;
    mensagem: string;
    tipo: 'manual' | 'risco' | 'consecutiva' | 'mensal';
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
