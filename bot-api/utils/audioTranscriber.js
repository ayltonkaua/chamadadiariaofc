/**
 * Audio Transcriber — Helper para transcrição de áudio via Faster-Whisper
 * 
 * Envia o buffer do áudio para o serviço Python local (porta 8787)
 * e retorna o texto transcrito.
 * 
 * Fallback: se o serviço estiver offline, retorna null (caller trata).
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const WHISPER_URL = process.env.WHISPER_URL || 'http://127.0.0.1:8787';
const TRANSCRIBE_TIMEOUT_MS = 60000; // 60s max para transcrição

/**
 * Transcreve um buffer de áudio via serviço faster-whisper local.
 * 
 * @param {Buffer} audioBuffer - Buffer do áudio (OGG/opus do WhatsApp)
 * @returns {Promise<{text: string, duration: number}|null>} Texto transcrito ou null se falhar
 */
async function transcribeAudio(audioBuffer) {
    if (!audioBuffer || audioBuffer.length === 0) {
        console.error('[TRANSCRIBE] Buffer de áudio vazio');
        return null;
    }

    // Salvar em arquivo temporário
    const tmpFile = path.join(os.tmpdir(), `wa_audio_${Date.now()}.ogg`);

    try {
        fs.writeFileSync(tmpFile, audioBuffer);

        // Enviar para o serviço whisper via fetch (Node 18+)
        const FormData = (await import('undici')).FormData;
        const { File: UndiciFile } = await import('undici');

        // Usar fetch nativo com FormData
        const formData = new FormData();
        const fileBlob = new Blob([audioBuffer], { type: 'audio/ogg' });
        formData.append('file', fileBlob, 'audio.ogg');

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), TRANSCRIBE_TIMEOUT_MS);

        const response = await fetch(`${WHISPER_URL}/transcribe`, {
            method: 'POST',
            body: formData,
            signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[TRANSCRIBE] Serviço retornou ${response.status}: ${errorText}`);
            return null;
        }

        const result = await response.json();
        console.log(`🎤 [TRANSCRIBE] ${result.duration || 0}s áudio → "${(result.text || '').substring(0, 80)}..." (${result.processing_time || 0}s proc)`);

        if (!result.text || result.text.trim().length === 0) {
            console.warn('[TRANSCRIBE] Áudio transcrito mas sem texto (silêncio?)');
            return null;
        }

        return {
            text: result.text.trim(),
            duration: result.duration || 0,
        };

    } catch (err) {
        if (err.name === 'AbortError') {
            console.error('[TRANSCRIBE] Timeout — transcrição demorou mais de 60s');
        } else if (err.code === 'ECONNREFUSED') {
            console.error('[TRANSCRIBE] Serviço whisper offline (porta 8787)');
        } else {
            console.error('[TRANSCRIBE] Erro:', err.message);
        }
        return null;
    } finally {
        // Limpar arquivo temporário
        try { fs.unlinkSync(tmpFile); } catch (_) {}
    }
}

/**
 * Verifica se o serviço whisper está online.
 * @returns {Promise<boolean>}
 */
async function isWhisperOnline() {
    try {
        const response = await fetch(`${WHISPER_URL}/health`, { 
            signal: AbortSignal.timeout(3000) 
        });
        return response.ok;
    } catch {
        return false;
    }
}

module.exports = { transcribeAudio, isWhisperOnline };
