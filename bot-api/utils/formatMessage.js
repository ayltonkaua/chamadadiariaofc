/**
 * Format Message Utility
 * 
 * Replaces template variables with actual values.
 * Supported variables: {nome}, {faltas}, {responsavel}, {data}
 */

/**
 * Replace template variables with provided values
 * @param {string} template - Message template with {variable} placeholders
 * @param {object} data - Key-value pairs for replacement
 * @returns {string} Formatted message
 */
function formatMessage(template, data = {}) {
    if (!template) return '';

    let message = template;

    const replacements = {
        '{nome}': data.nome || 'Aluno(a)',
        '{faltas}': data.faltas != null ? String(data.faltas) : '0',
        '{responsavel}': data.responsavel || 'Responsável',
        '{data}': data.data || new Date().toLocaleDateString('pt-BR'),
        '{turma}': data.turma || 'Turma',
    };

    for (const [key, value] of Object.entries(replacements)) {
        message = message.replaceAll(key, value);
    }

    return message;
}

/**
 * Sanitize phone number to WhatsApp format
 * Removes all non-digit characters
 * Adds country code 55 if not present
 */
function sanitizePhone(phone) {
    if (!phone) return null;

    let cleaned = phone.replace(/\D/g, '');

    // Add Brazil country code if missing
    if (cleaned.length === 10 || cleaned.length === 11) {
        cleaned = '55' + cleaned;
    }

    // Fix missing 9th digit for typical BR numbers (if length is 12, inject 9 after DDD)
    // 55 (2) + DD (2) + XXXXXXXX (8) = 12 digits
    if (cleaned.length === 12 && cleaned.startsWith('55')) {
        // e.g. 558588887777 -> 55 85 9 88887777
        cleaned = cleaned.substring(0, 4) + '9' + cleaned.substring(4);
    }

    // Validate length (BR: 55 + DDD 2 digits + number 8-9 digits = 12-13)
    if (cleaned.length < 12 || cleaned.length > 15) {
        return null;
    }

    return cleaned;
}

/**
 * Convert a stored phone number (13 digits, with 9th digit) to Baileys JID format
 * Brazilian numbers work on Baileys with 12 digits (without the 9th digit).
 * 
 * Example: 5581912345678 → 558112345678@s.whatsapp.net
 * 
 * @param {string} phone - Sanitized phone number (digits only)
 * @returns {string|null} JID string for Baileys, or null if invalid
 */
function toBaileysJid(phone) {
    if (!phone) return null;

    let cleaned = phone.replace(/\D/g, '');

    // Add Brazil country code if missing
    if (cleaned.length === 10 || cleaned.length === 11) {
        cleaned = '55' + cleaned;
    }

    // Fix missing 9th digit to standardize first
    if (cleaned.length === 12 && cleaned.startsWith('55')) {
        cleaned = cleaned.substring(0, 4) + '9' + cleaned.substring(4);
    }

    // Remove 9th digit for Brazilian numbers: 55 + DD + 9XXXXXXXX → 55 + DD + XXXXXXXX
    if (cleaned.length === 13 && cleaned.startsWith('55') && cleaned[4] === '9') {
        cleaned = cleaned.substring(0, 4) + cleaned.substring(5);
    }

    if (cleaned.length < 12 || cleaned.length > 13) {
        return null;
    }

    return `${cleaned}@s.whatsapp.net`;
}

/**
 * Delay utility for rate limiting between messages
 * Integrado com Inteligência Anti-Ban Aleatória: se o painel pedir 20s, 
 * o bot vai sortear dinamicamente um tempo entre 14s e 38s (simulando humano).
 */
function delay(ms) {
    let finalMs = ms;
    // Se o core do bot enviar 20000ms de delay (padrão hardcoded), sorteamos um delay humano
    if (ms === 20000) {
        const minMs = 14000;
        const maxMs = 38000;
        finalMs = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
        console.log(`⏳ [ANTI-BAN] Inteligência ativada: Simulando digitação por ${(finalMs / 1000).toFixed(1)} segundos...`);
    }
    return new Promise(resolve => setTimeout(resolve, finalMs));
}

module.exports = { formatMessage, sanitizePhone, toBaileysJid, delay };
