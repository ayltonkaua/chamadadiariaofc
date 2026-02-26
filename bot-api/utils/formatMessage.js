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

    // Validate length (BR: 55 + DDD 2 digits + number 8-9 digits = 12-13)
    if (cleaned.length < 12 || cleaned.length > 15) {
        return null;
    }

    return cleaned;
}

/**
 * Delay utility for rate limiting between messages
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { formatMessage, sanitizePhone, delay };
