/**
 * WhatsApp Inbound Message Handler — v2 (Modularizado)
 * 
 * URA-based menu system for incoming messages:
 * 1 - Justificar Falta (com listagem de datas e múltiplos alunos)
 * 2 - Carteira de Estudante
 * 3 - Histórico/Boletim Escolar
 * 4 - Declaração de Escolaridade
 * 5 - Pé-de-Meia
 * 
 * Se o telefone não está vinculado, oferece auto-cadastro
 * (pré-cadastro com aprovação da secretaria).
 */

const { normalizePhone } = require('./utils/phoneNormalizer');
const { hasSession, getSession, setSession } = require('./utils/sessionManager');
const { handleStateMachine } = require('./stateMachine');
const { routeToOpenAtendimento } = require('./flows/atendimentoFlow');

const URA_MENU = `🤖 *Olá! Sou o assistente virtual da escola.* 

Escolha uma opção digitando o número correspondente:

1️⃣ - Justificar Falta
2️⃣ - Carteira de Estudante
3️⃣ - Histórico/Boletim Escolar
4️⃣ - Declaração de Escolaridade
5️⃣ - Pé-de-Meia
6️⃣ - Consultar Faltas

_Responda apenas com o número da opção desejada._`;

const processedMessages = new Set();

function setupInboundListener(sock, escolaId) {
    sock.ev.on('messages.upsert', async (m) => {
        try {
            console.log(`\n\n=== 📥 NOVA MENSAGEM RECEBIDA [${escolaId.substring(0,8)}] ===`);

            if (m.type !== 'notify') return;

            const msg = m.messages[0];
            if (!msg || !msg.message) return;
            if (msg.key.fromMe) return;
            if (msg.key.remoteJid.endsWith('@g.us')) return;

            // Prevenção de duplicidade: ignorar se já processamos essa mensagem na memória
            if (msg.key.id && processedMessages.has(msg.key.id)) {
                return;
            }
            
            if (msg.key.id) {
                processedMessages.add(msg.key.id);
                // Limpar cache a cada 200 mensagens para não gastar RAM infinita
                if (processedMessages.size > 200) {
                    const firstItem = processedMessages.values().next().value;
                    processedMessages.delete(firstItem);
                }
            }

            // Detectar mídia (foto, documento, vídeo)
            const hasMedia = !!(
                msg.message.imageMessage || 
                msg.message.documentMessage ||
                msg.message.videoMessage
            );

            // Extrair texto (com fallback para mídia)
            const textContent = 
                msg.message.conversation || 
                msg.message.extendedTextMessage?.text || 
                msg.message.imageMessage?.caption ||
                '';

            const mediaFallbackText = hasMedia ? '[Atestado/Documento em anexo]' : null;

            // Se não tem texto E não tem mídia, ignorar
            if (!textContent.trim() && !mediaFallbackText) return;

            // Obter telefone do remetente e trata variacoes (@lid, etc)
            let rawPhone = msg.key.remoteJid;
            
            if (rawPhone.includes('@lid')) {
                const parsedMsg = JSON.parse(JSON.stringify(msg));
                const realPhoneJid = parsedMsg.key?.senderPn || parsedMsg.key?.participant || parsedMsg.participant;
                if (realPhoneJid) rawPhone = realPhoneJid;
            }
            
            const replyFn = async (text) => {
                await sock.sendMessage(msg.key.remoteJid, { text }, { quoted: msg });
            };

            await processIncomingMessage(escolaId, rawPhone, textContent, replyFn, mediaFallbackText);

        } catch (error) {
            console.error(`❌ [INBOUND] [${escolaId.substring(0,8)}] Error:`, error.message);
        }
    });
}

async function processIncomingMessage(escolaId, phoneString, textContent, replyFn, mediaFallbackText) {
    const { sessionKey, phoneCom9, phoneSem9 } = normalizePhone(phoneString);

    // 1. Verificar se usuário já está navegando no BOT (Session ativa em RAM)
    if (hasSession(sessionKey)) {
        const session = getSession(sessionKey);
        return await handleStateMachine(session, sessionKey, textContent, mediaFallbackText, replyFn);
    }

    // 2. Verificar se usuário tem um ATENDIMENTO ABERTO no BD.
    // (Pode não ter session na RAM pois estourou timeout, mas o ticket não foi fechado pela secretaria)
    const hasOpenTicket = await routeToOpenAtendimento(escolaId, sessionKey, phoneCom9, phoneSem9, textContent, mediaFallbackText, replyFn);
    if (hasOpenTicket) {
        console.log(`💬 [INBOUND] [${escolaId.substring(0,8)}] Mensagem canalizada para atendimento aberto | Tel: ${sessionKey.slice(-8)}`);
        return; // Mensagem absorvida pelo ticket
    }

    // 3. Primeira interação: Exibir menu URA
    console.log(`📋 [INBOUND] [${escolaId.substring(0,8)}] Exibindo menu URA para ${sessionKey.slice(-8)}`);
    setSession(sessionKey, { 
        stage: 'WAIT_URA_CHOICE', 
        escolaId, 
        phoneCom9,
        phoneSem9,
        originalMessage: textContent 
    }, replyFn);
    await replyFn(URA_MENU);
}

module.exports = { setupInboundListener };
