/**
 * WhatsApp Inbound Message Handler — v3 (AI Humanizado)
 * 
 * Substitui o menu URA rígido (1-6) por classificação de intenções via IA.
 * A IA (Gemini Flash / Groq) é usada APENAS na primeira mensagem do usuário.
 * Após classificada a intenção, os fluxos guiados (justificativa, cadastro, etc.)
 * funcionam exatamente como antes via state machine.
 * 
 * Fallback: se a IA falhar, exibe o menu URA clássico.
 */

const { normalizePhone } = require('./utils/phoneNormalizer');
const { hasSession, getSession, setSession } = require('./utils/sessionManager');
const { handleStateMachine } = require('./stateMachine');
const { routeToOpenAtendimento } = require('./flows/atendimentoFlow');
const { classifyIntent, getGreetingMessage, getUnknownMessage } = require('./utils/aiClassifier');
const { startJustificativaFlow } = require('./flows/justificativaFlow');
const { startConsultaFaltasFlow } = require('./flows/consultaFaltasFlow');
const { handleWaitAtendimentoMsg } = require('./flows/atendimentoFlow');

// Menu URA clássico como fallback
const URA_MENU = `🤖 *Olá! Sou o assistente virtual da escola.* 

Escolha uma opção digitando o número correspondente:

1️⃣ - Justificar Falta
2️⃣ - Carteira de Estudante
3️⃣ - Histórico/Boletim Escolar
4️⃣ - Declaração de Escolaridade
5️⃣ - Pé-de-Meia
6️⃣ - Consultar Faltas

_Responda apenas com o número da opção desejada._`;

// Mapa de intents de atendimento → setor + label
const ATENDIMENTO_INTENTS = {
    carteirinha: { setor: 'carteirinha', label: 'Carteira de Estudante' },
    boletim:     { setor: 'boletim',     label: 'Histórico/Boletim Escolar' },
    declaracao:  { setor: 'declaracao',  label: 'Declaração de Escolaridade' },
    pe_de_meia:  { setor: 'pe_de_meia',  label: 'Pé-de-Meia' },
};

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

            // Prevenção de duplicidade
            if (msg.key.id && processedMessages.has(msg.key.id)) {
                return;
            }
            if (msg.key.id) {
                processedMessages.add(msg.key.id);
                if (processedMessages.size > 200) {
                    const firstItem = processedMessages.values().next().value;
                    processedMessages.delete(firstItem);
                }
            }

            // Detectar mídia
            const hasMedia = !!(
                msg.message.imageMessage || 
                msg.message.documentMessage ||
                msg.message.videoMessage
            );

            // Extrair texto
            const textContent = 
                msg.message.conversation || 
                msg.message.extendedTextMessage?.text || 
                msg.message.imageMessage?.caption ||
                '';

            const mediaFallbackText = hasMedia ? '[Atestado/Documento em anexo]' : null;

            if (!textContent.trim() && !mediaFallbackText) return;

            // Obter telefone do remetente
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

    // ═══ PASSO 1: Session ativa na RAM? Continuar fluxo guiado ═══
    if (hasSession(sessionKey)) {
        const session = getSession(sessionKey);
        return await handleStateMachine(session, sessionKey, textContent, mediaFallbackText, replyFn);
    }

    // ═══ PASSO 2: Ticket de atendimento aberto no BD? Canalizar ═══
    const hasOpenTicket = await routeToOpenAtendimento(escolaId, sessionKey, phoneCom9, phoneSem9, textContent, mediaFallbackText, replyFn);
    if (hasOpenTicket) {
        console.log(`💬 [INBOUND] [${escolaId.substring(0,8)}] Mensagem canalizada para atendimento aberto | Tel: ${sessionKey.slice(-8)}`);
        return;
    }

    // ═══ PASSO 3: Classificar intenção via IA ═══
    console.log(`🧠 [INBOUND] [${escolaId.substring(0,8)}] Classificando intenção para ${sessionKey.slice(-8)}...`);
    
    const classification = await classifyIntent(textContent);

    if (classification) {
        return await executeIntent(classification, escolaId, sessionKey, phoneCom9, phoneSem9, textContent, mediaFallbackText, replyFn);
    }

    // ═══ PASSO 4: IA não entendeu → Mensagem amigável com menu fallback ═══
    console.log(`📋 [INBOUND] [${escolaId.substring(0,8)}] Fallback: exibindo ajuda para ${sessionKey.slice(-8)}`);
    setSession(sessionKey, { 
        stage: 'WAIT_URA_CHOICE', 
        escolaId, 
        phoneCom9,
        phoneSem9,
        originalMessage: textContent 
    }, replyFn);
    await replyFn(getUnknownMessage());
}

/**
 * Executa a ação correspondente à intenção classificada pela IA.
 */
async function executeIntent(classification, escolaId, sessionKey, phoneCom9, phoneSem9, textContent, mediaFallbackText, replyFn) {
    const { intent } = classification;

    // ── Justificar falta ──
    if (intent === 'justificar_falta') {
        console.log(`📝 [INBOUND] [${escolaId.substring(0,8)}] Intent: justificar_falta`);
        return await startJustificativaFlow(escolaId, sessionKey, phoneCom9, phoneSem9, replyFn);
    }

    // ── Consultar faltas ──
    if (intent === 'consultar_faltas') {
        console.log(`📊 [INBOUND] [${escolaId.substring(0,8)}] Intent: consultar_faltas`);
        return await startConsultaFaltasFlow(escolaId, sessionKey, phoneCom9, phoneSem9, replyFn);
    }

    // ── Atendimento (carteirinha, boletim, declaração, pé-de-meia) ──
    if (ATENDIMENTO_INTENTS[intent]) {
        const { setor, label } = ATENDIMENTO_INTENTS[intent];
        console.log(`🎫 [INBOUND] [${escolaId.substring(0,8)}] Intent: ${intent} → atendimento ${setor}`);

        // Se veio com texto substancial (>10 chars), criar ticket diretamente
        const textoSubstancial = (textContent || '').trim();
        if (textoSubstancial.length > 10) {
            // Criar ticket direto com a mensagem do usuário
            const fakeSession = { 
                setor, 
                setorLabel: label, 
                escolaId, 
                phoneCom9, 
                phoneSem9 
            };
            return await handleWaitAtendimentoMsg(
                fakeSession, sessionKey, escolaId, phoneCom9, phoneSem9,
                textoSubstancial, mediaFallbackText, replyFn
            );
        }

        // Texto curto (ex: "boletim") → pedir detalhes
        setSession(sessionKey, { 
            stage: 'WAIT_ATENDIMENTO_MSG',
            escolaId,
            phoneCom9,
            phoneSem9,
            setor,
            setorLabel: label,
        }, replyFn);
        await replyFn(`Entendi! Você precisa de ajuda com *${label}*. 😊\n\nPor favor, descreva seu pedido ou envie a foto do documento necessário para que a secretaria possa atender:`)
        return;
    }

    // ── Saudação ──
    if (intent === 'saudacao') {
        console.log(`👋 [INBOUND] [${escolaId.substring(0,8)}] Intent: saudacao`);
        setSession(sessionKey, { 
            stage: 'WAIT_URA_CHOICE', 
            escolaId, 
            phoneCom9,
            phoneSem9,
            originalMessage: textContent 
        }, replyFn);
        await replyFn(getGreetingMessage());
        return;
    }

    // ── Desconhecido / fallback ──
    console.log(`❓ [INBOUND] [${escolaId.substring(0,8)}] Intent: desconhecido`);
    setSession(sessionKey, { 
        stage: 'WAIT_URA_CHOICE', 
        escolaId, 
        phoneCom9,
        phoneSem9,
        originalMessage: textContent 
    }, replyFn);
    await replyFn(getUnknownMessage());
}

module.exports = { setupInboundListener };
