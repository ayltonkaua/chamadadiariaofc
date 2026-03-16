/**
 * Alert Helpers
 *
 * Shared utilities for all alert routes:
 *   - getTemplates          — fetch bot config / default templates
 *   - requireConnected      — guard clause (WhatsApp online?)
 *   - sendAndLog            — send message + insert whatsapp_logs
 *   - getActiveStudentsWithPhone — batch query for active students
 *   - countConsecutiveAbsences   — count leading unjustified absences
 *   - validateDate          — YYYY-MM-DD format check
 *   - log                   — structured console logging
 */

const { sendMessage } = require('../../whatsapp');
const { supabase } = require('../../supabase');
const { getStatus } = require('../../whatsapp');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SEND_DELAY_MS = 20000; // 20 s between sends (safe for WhatsApp)

// ---------------------------------------------------------------------------
// Structured logging
// ---------------------------------------------------------------------------

/**
 * Structured log:  [ALERT] [LEVEL] [escolaId:8] [route] message
 */
function log(level, escolaId, route, message) {
    const id = (escolaId || '').substring(0, 8);
    console.log(`[ALERT] [${level}] [${id}] [${route}] ${message}`);
}

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validate a YYYY-MM-DD string.
 * Returns the sanitised string if valid, or null.
 */
function validateDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return null;
    if (!DATE_RE.test(dateStr)) return null;

    // Check actual date validity (e.g. 2026-13-45 → Invalid)
    const d = new Date(dateStr + 'T12:00:00');
    if (isNaN(d.getTime())) return null;

    // Ensure it round-trips (catches month overflow etc.)
    const iso = d.toISOString().split('T')[0];
    if (iso !== dateStr) return null;

    return dateStr;
}

/**
 * Get current date in America/Sao_Paulo timezone as YYYY-MM-DD
 * Prevents UTC bugs where 22:00 in BR is treated as the next day.
 */
function getTodayBR() {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(new Date());
}

/**
 * Basic group_id sanitation.  Must be non-empty string.
 */
function validateGroupId(groupId) {
    if (!groupId || typeof groupId !== 'string') return null;
    return groupId.trim() || null;
}

// ---------------------------------------------------------------------------
// WhatsApp guard
// ---------------------------------------------------------------------------

/**
 * Guard clause that checks WhatsApp connection.
 * Returns true if connected; otherwise sends a 400 response and returns false.
 */
function requireConnected(escolaId, res) {
    const status = getStatus(escolaId);
    if (!status.connected) {
        res.status(400).json({ success: false, error: 'WhatsApp não conectado' });
        return false;
    }
    return true;
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

async function getTemplates(escolaId) {
    const { data } = await supabase
        .from('whatsapp_bot_config')
        .select('*')
        .eq('escola_id', escolaId)
        .single();

    return {
        template_risco: data?.template_risco ||
            'Olá {responsavel}, o(a) aluno(a) {nome} está em situação de risco com {faltas} faltas. Entre em contato com a escola. Data: {data}',
        template_consecutiva: data?.template_consecutiva ||
            'Olá {responsavel}, o(a) aluno(a) {nome} possui {faltas} faltas consecutivas. Data: {data}',
        template_mensal: data?.template_mensal ||
            'Olá {responsavel}, resumo mensal de {nome}: {faltas} faltas no mês. Data: {data}',
        template_falta_diaria: data?.template_falta_diaria ||
            'Prezado(a) {responsavel}, informamos que o(a) aluno(a) *{nome}* não compareceu à aula hoje ({data}). Caso haja algum motivo, por favor entre em contato com a escola.',
        template_escalacao: data?.template_escalacao ||
            'Prezado(a) {responsavel}, o(a) aluno(a) *{nome}* acumula *{faltas} faltas consecutivas* sem justificativa. É fundamental que nos informe o motivo para que possamos acionar a Busca Ativa e garantir a permanência escolar. Entre em contato com urgência.',
        grupo_busca_ativa_id: data?.grupo_busca_ativa_id || null,
    };
}

// ---------------------------------------------------------------------------
// Student queries (batch — no N+1)
// ---------------------------------------------------------------------------

/**
 * Fetch all active students that have a phone number.
 * @param {string} escolaId
 * @param {string} [extraSelect] – additional columns (comma-separated)
 */
async function getActiveStudentsWithPhone(escolaId, extraSelect) {
    const cols = extraSelect
        ? `id, nome, nome_responsavel, telefone_responsavel, ${extraSelect}`
        : 'id, nome, nome_responsavel, telefone_responsavel';

    const { data, error } = await supabase
        .from('alunos')
        .select(cols)
        .eq('escola_id', escolaId)
        .eq('situacao', 'ativo')
        .not('telefone_responsavel', 'is', null);

    if (error) throw error;
    return data || [];
}

// ---------------------------------------------------------------------------
// Consecutive absences
// ---------------------------------------------------------------------------

/**
 * Count leading consecutive unjustified absences.
 * `presencas` must be sorted descending by date (most recent first).
 */
function countConsecutiveAbsences(presencas) {
    let count = 0;
    for (const p of presencas) {
        if (!p.presente && !p.falta_justificada) {
            count++;
        } else {
            break;
        }
    }
    return count;
}

// ---------------------------------------------------------------------------
// Send + Log (DRY)
// ---------------------------------------------------------------------------

const { formatMessage, sanitizePhone, delay } = require('../../utils/formatMessage');

/**
 * Send a WhatsApp message and log the result to `whatsapp_logs`.
 * Returns { ok: boolean }.
 */
async function sendAndLog(escolaId, alunoId, phone, message, tipo) {
    try {
        await sendMessage(escolaId, phone, message);
        await supabase.from('whatsapp_logs').insert({
            escola_id: escolaId,
            aluno_id: alunoId,
            telefone: phone,
            mensagem: message,
            tipo,
            status: 'enviado',
        });
        return { ok: true };
    } catch (err) {
        log('ERROR', escolaId, tipo, `Falha ao enviar para ${phone}: ${err.message}`);
        await supabase.from('whatsapp_logs').insert({
            escola_id: escolaId,
            aluno_id: alunoId,
            telefone: phone,
            mensagem: message,
            tipo,
            status: 'falha',
            erro: err.message,
        });
        return { ok: false };
    }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
    SEND_DELAY_MS,
    log,
    getTodayBR,
    validateDate,
    validateGroupId,
    requireConnected,
    getTemplates,
    getActiveStudentsWithPhone,
    countConsecutiveAbsences,
    sendAndLog,
    // Re-export frequently used utils so route files don't need extra requires
    formatMessage,
    sanitizePhone,
    delay,
    supabase,
};
