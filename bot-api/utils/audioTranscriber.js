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

        // Enviar arquivo para o serviço whisper via HTTP multipart
        const http = require('http');
        
        const result = await new Promise((resolve, reject) => {
            const boundary = '----WhisperBoundary' + Date.now();
            const fileData = fs.readFileSync(tmpFile);
            
            // Construir body multipart manualmente
            const header = Buffer.from(
                `--${boundary}\r\n` +
                `Content-Disposition: form-data; name="file"; filename="audio.ogg"\r\n` +
                `Content-Type: audio/ogg\r\n\r\n`
            );
            const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
            const body = Buffer.concat([header, fileData, footer]);

            const url = new URL(`${WHISPER_URL}/transcribe`);
            const options = {
                hostname: url.hostname,
                port: url.port,
                path: url.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': `multipart/form-data; boundary=${boundary}`,
                    'Content-Length': body.length,
                },
                timeout: TRANSCRIBE_TIMEOUT_MS,
            };

            const req = http.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    if (res.statusCode >= 400) {
                        reject(new Error(`Serviço retornou ${res.statusCode}: ${data}`));
                        return;
                    }
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(new Error(`Resposta inválida: ${data}`));
                    }
                });
            });

            req.on('error', reject);
            req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
            req.write(body);
            req.end();
        });

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
