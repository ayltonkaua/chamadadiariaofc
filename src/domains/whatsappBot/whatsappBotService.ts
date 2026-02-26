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
        config: Partial<Pick<WhatsAppBotConfig, 'template_risco' | 'template_consecutiva' | 'template_mensal' | 'ativo'>>
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
};
