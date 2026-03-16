/**
 * WhatsApp Bot Service
 *
 * Communicates with the bot-api backend.
 * All requests include x-api-key and x-escola-id headers.
 */

import { supabase } from '@/integrations/supabase/client';
import type {
    WhatsAppBotConfig,
    WhatsAppLog,
    BotStatus,
    QRCodeResponse,
    SendManualPayload,
    SendAlertPayload,
    SendToGroupPayload,
    Turma,
    WhatsAppGroup,
    SendResult,
    ApiResponse,
    BulkImportRow,
    BulkImportResult,
    GroupCandidate,
    AddToGroupResult,
    SendProgress,
    AiMessageRequest,
    AiMessageResponse,
} from './types';

// Bot API base URL — configure this to your Render deployment
const BOT_API_URL = import.meta.env.VITE_BOT_API_URL || 'http://localhost:3002';
const BOT_API_KEY = import.meta.env.VITE_BOT_API_KEY || '';

// Cast supabase to any for tables not yet in auto-generated types.
// After running `supabase gen types typescript`, replace with typed calls.
const db = supabase as any;

/**
 * Make authenticated request to the bot-api
 */
async function botFetch<T>(
    path: string,
    escolaId: string,
    options: RequestInit = {}
): Promise<ApiResponse<T>> {
    const url = `${BOT_API_URL}${path}`;

    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': BOT_API_KEY,
            'x-escola-id': escolaId,
            ...(options.headers || {}),
        },
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || `Erro ${response.status}`);
    }

    return data;
}

export const whatsappBotService = {
    // =====================
    // Bot Connection
    // =====================

    async getStatus(escolaId: string): Promise<BotStatus> {
        const response = await botFetch<BotStatus>('/status', escolaId);
        return response.data!;
    },

    async generateQR(escolaId: string): Promise<QRCodeResponse> {
        const response = await botFetch<QRCodeResponse>('/generate-qr', escolaId);
        return response.data!;
    },

    /**
     * Disconnect WhatsApp session and clear session data
     */
    async disconnect(escolaId: string): Promise<void> {
        await botFetch('/disconnect', escolaId, { method: 'POST' });
    },

    // =====================
    // Manual Send
    // =====================

    async sendManual(escolaId: string, payload: SendManualPayload): Promise<void> {
        await botFetch('/sendManual', escolaId, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    },

    // =====================
    // Alert Sends
    // =====================

    async sendRiskAlert(escolaId: string, payload?: SendAlertPayload): Promise<SendResult> {
        const response = await botFetch<SendResult>('/sendRiskAlert', escolaId, {
            method: 'POST',
            body: JSON.stringify(payload || {}),
        });
        return response as unknown as SendResult;
    },

    async sendConsecutiveAlert(escolaId: string, payload?: SendAlertPayload): Promise<SendResult> {
        const response = await botFetch<SendResult>('/sendConsecutiveAlert', escolaId, {
            method: 'POST',
            body: JSON.stringify(payload || {}),
        });
        return response as unknown as SendResult;
    },

    async sendMonthlySummary(escolaId: string, payload?: SendAlertPayload): Promise<SendResult> {
        const response = await botFetch<SendResult>('/sendMonthlySummary', escolaId, {
            method: 'POST',
            body: JSON.stringify(payload || {}),
        });
        return response as unknown as SendResult;
    },

    // =====================
    // Groups (Turmas)
    // =====================

    /**
     * Get all turmas for the escola with student counts
     */
    async getTurmas(escolaId: string): Promise<Turma[]> {
        // Get turmas
        const { data: turmas, error: turmaError } = await supabase
            .from('turmas')
            .select('id, nome, turno')
            .eq('escola_id', escolaId)
            .order('nome');

        if (turmaError) throw turmaError;
        if (!turmas || turmas.length === 0) return [];

        // For each turma, count total students and students with phone
        const result: Turma[] = [];
        for (const turma of turmas) {
            const { count: totalAlunos } = await supabase
                .from('alunos')
                .select('id', { count: 'exact', head: true })
                .eq('turma_id', turma.id)
                .eq('escola_id', escolaId)
                .eq('situacao', 'ativo');

            const { count: comTelefone } = await supabase
                .from('alunos')
                .select('id', { count: 'exact', head: true })
                .eq('turma_id', turma.id)
                .eq('escola_id', escolaId)
                .eq('situacao', 'ativo')
                .not('telefone_responsavel', 'is', null);

            result.push({
                id: turma.id,
                nome: turma.nome,
                turno: turma.turno || '',
                alunos_count: totalAlunos || 0,
                alunos_com_telefone: comTelefone || 0,
            });
        }

        return result;
    },

    /**
     * Send a personalized message to all parents in a turma
     */
    async sendToGroup(escolaId: string, payload: SendToGroupPayload): Promise<SendResult> {
        const response = await botFetch<SendResult>('/sendToGroup', escolaId, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
        return response as unknown as SendResult;
    },

    // =====================
    // WhatsApp Groups (from connected account)
    // =====================

    /**
     * Get all WhatsApp groups from the connected account
     */
    async getWhatsAppGroups(escolaId: string): Promise<WhatsAppGroup[]> {
        const response = await botFetch<WhatsAppGroup[]>('/whatsapp-groups', escolaId);
        return response.data || [];
    },

    /**
     * Send a message to a WhatsApp group
     */
    async sendToWhatsAppGroup(escolaId: string, groupId: string, mensagem: string): Promise<void> {
        await botFetch('/sendToWhatsAppGroup', escolaId, {
            method: 'POST',
            body: JSON.stringify({ group_id: groupId, mensagem }),
        });
    },

    // =====================
    // Config (via Supabase)
    // =====================

    async getConfig(escolaId: string): Promise<WhatsAppBotConfig | null> {
        const { data, error } = await db
            .from('whatsapp_bot_config')
            .select('*')
            .eq('escola_id', escolaId)
            .maybeSingle();

        if (error) throw error;
        return data as WhatsAppBotConfig | null;
    },

    async saveConfig(
        escolaId: string,
        config: Partial<Pick<WhatsAppBotConfig, 
            'template_risco' | 'template_consecutiva' | 'template_mensal' | 
            'template_falta_diaria' | 'template_escalacao' | 'grupo_busca_ativa_id' | 
            'ativo' | 'auto_falta_diaria' | 'auto_consecutiva' | 'auto_mensal' | 'horario_falta_diaria'
        >>
    ): Promise<WhatsAppBotConfig> {
        const existing = await whatsappBotService.getConfig(escolaId);

        if (existing) {
            const { data, error } = await db
                .from('whatsapp_bot_config')
                .update({ ...config, updated_at: new Date().toISOString() })
                .eq('escola_id', escolaId)
                .select()
                .single();

            if (error) throw error;
            return data as WhatsAppBotConfig;
        }

        const { data, error } = await db
            .from('whatsapp_bot_config')
            .insert({ escola_id: escolaId, ...config })
            .select()
            .single();

        if (error) throw error;
        return data as WhatsAppBotConfig;
    },

    // =====================
    // Logs (via Supabase)
    // =====================

    async getLogs(escolaId: string, limit = 50): Promise<WhatsAppLog[]> {
        const { data, error } = await db
            .from('whatsapp_logs')
            .select('*')
            .eq('escola_id', escolaId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return (data || []) as WhatsAppLog[];
    },

    // =====================
    // Bulk Import
    // =====================

    /**
     * Bulk import phone numbers from Excel/CSV data
     * Matches students by matricula and updates their phone numbers
     */
    async bulkImportPhones(escolaId: string, data: BulkImportRow[]): Promise<BulkImportResult> {
        const response = await botFetch<BulkImportResult>('/bulk-import-phones', escolaId, {
            method: 'POST',
            body: JSON.stringify({ data }),
        });
        return response.data!;
    },

    // =====================
    // Group Participants
    // =====================

    /**
     * Add participants to a WhatsApp group (max 5 per call)
     */
    async addToGroup(escolaId: string, groupId: string, telefones: string[]): Promise<AddToGroupResult> {
        const response = await botFetch<AddToGroupResult>('/add-to-group', escolaId, {
            method: 'POST',
            body: JSON.stringify({ group_id: groupId, telefones }),
        });
        return response.data!;
    },

    /**
     * Get students with phone numbers that can be added to a WhatsApp group
     */
    async getGroupCandidates(escolaId: string, groupId: string): Promise<GroupCandidate[]> {
        const response = await botFetch<GroupCandidate[]>(`/group-candidates/${groupId}`, escolaId);
        return response.data || [];
    },

    /**
     * Poll send-to-group progress
     */
    async getSendProgress(escolaId: string): Promise<SendProgress | null> {
        const response = await botFetch<SendProgress>('/send-progress', escolaId);
        return response.data || null;
    },

    // =====================
    // Absence Messaging
    // =====================

    /**
     * Send daily absence alerts to parents of absent students (queue + progress)
     */
    async sendDailyAbsences(escolaId: string, data?: string): Promise<{ total: number; message: string }> {
        const response = await botFetch<{ total: number; message: string }>('/sendDailyAbsences', escolaId, {
            method: 'POST',
            body: JSON.stringify({ data }),
        });
        return response as unknown as { total: number; message: string };
    },

    /**
     * Send escalation for 3+ consecutive absences without response
     */
    async sendEscalation(escolaId: string): Promise<{ sent: number; failed: number; skipped: number }> {
        const response = await botFetch<{ sent: number; failed: number; skipped: number }>('/sendEscalation', escolaId, {
            method: 'POST',
            body: JSON.stringify({}),
        });
        return response as unknown as { sent: number; failed: number; skipped: number };
    },

    /**
     * Send daily absence summary to Busca Ativa WhatsApp group
     */
    async sendDailyAbsencesToGroup(escolaId: string, groupId?: string, data?: string): Promise<{ totalFaltosos: number; criticos: number; message: string }> {
        const response = await botFetch<{ totalFaltosos: number; criticos: number; message: string }>('/sendDailyAbsencesToGroup', escolaId, {
            method: 'POST',
            body: JSON.stringify({ group_id: groupId, data }),
        });
        return response as unknown as { totalFaltosos: number; criticos: number; message: string };
    },

    /**
     * Poll daily absence send progress
     */
    async getAbsenceProgress(escolaId: string): Promise<SendProgress | null> {
        const response = await botFetch<SendProgress>('/absence-progress', escolaId);
        return response.data || null;
    },

    // =====================
    // AI Message Generation
    // =====================

    /**
     * Generate AI-formatted messages for WhatsApp
     * Uses the existing analyze-evasao Edge Function (Groq/Gemini)
     */
    async generateAiMessage(params: AiMessageRequest): Promise<AiMessageResponse> {
        const tomLabels: Record<string, string> = {
            formal: 'Formal e profissional',
            amigavel: 'Amigável e acolhedor',
            urgente: 'Urgente e direto',
            informativo: 'Informativo e neutro',
        };

        const tipoLabels: Record<string, string> = {
            aviso: 'Aviso geral',
            evento: 'Evento escolar',
            reuniao: 'Reunião de pais/responsáveis',
            frequencia: 'Frequência e faltas',
            outro: 'Outro assunto',
        };

        const prompt = `Você é um especialista em comunicação escolar brasileira. A escola precisa enviar uma mensagem por WhatsApp para os responsáveis dos alunos.

INFORMAÇÕES:
- Assunto: ${params.descricao}
- Tom desejado: ${tomLabels[params.tom] || params.tom}
- Tipo de mensagem: ${tipoLabels[params.tipo] || params.tipo}

Gere EXATAMENTE 3 versões diferentes da mensagem, seguindo estas regras:
1. Use formatação do WhatsApp: *negrito*, _itálico_, ~tachado~
2. Use emojis apropriados para o contexto escolar
3. Seja conciso — cada mensagem deve ter no máximo 500 caracteres
4. Inclua saudação e despedida adequadas
5. Mantenha o tom solicitado em todas as versões
6. Se o tipo for sobre frequência/faltas, inclua as variáveis {nome}, {faltas}, {responsavel}, {data} onde faça sentido

RESPONDA EXATAMENTE neste formato, sem texto extra antes ou depois:
---VERSAO1---
[mensagem 1 aqui]
---VERSAO2---
[mensagem 2 aqui]
---VERSAO3---
[mensagem 3 aqui]`;

        const { data, error } = await supabase.functions.invoke('analyze-evasao', {
            body: { prompt },
        });

        if (error) {
            throw new Error(`Erro ao gerar mensagem: ${error.message}`);
        }

        const texto: string = data?.texto || '';
        const modelo: string = data?.modelo || 'local';

        if (!texto) {
            throw new Error('A IA não retornou nenhuma resposta. Tente novamente.');
        }

        // Parse the 3 versions from the response
        const versoes = parseVersoes(texto);

        return { versoes, modelo };
    },
};

/**
 * Parse the AI response into 3 separate message versions.
 * Handles the ---VERSAON--- delimiter format.
 */
function parseVersoes(texto: string): string[] {
    // Try to split by the delimiter format
    const parts = texto.split(/---VERSAO\d+---/i).filter((p) => p.trim());

    if (parts.length >= 3) {
        return parts.slice(0, 3).map((p) => p.trim());
    }

    // Fallback: try splitting by double newlines or numbered patterns
    const numbered = texto.split(/\n\s*(?:Versão|Opção|Mensagem)\s*\d+[:\-–]*/i).filter((p) => p.trim());
    if (numbered.length >= 3) {
        return numbered.slice(0, 3).map((p) => p.trim());
    }

    // Last fallback: return the whole text as a single version
    return [texto.trim()];
}
