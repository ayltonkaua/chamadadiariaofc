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

// ═══════════════════════════════════════════════
// Mapa LID → Telefone real (resolve o bug @lid do Baileys v6+)
// ═══════════════════════════════════════════════
const lidToPhoneMap = new Map();

/**
 * Resolve o telefone REAL a partir de um remoteJid que pode ser @lid.
 * Baileys v6+ envia JIDs @lid em que o ID NÃO é o número de telefone.
 * 
 * Estratégia:
 * 1. Se é @s.whatsapp.net, extrair diretamente (caso clássico)
 * 2. Se é @lid, tentar diversas fontes do msg para encontrar o telefone real
 * 3. Se já mapeamos este LID antes, usar o cache
 * 4. Último recurso: usar o próprio LID (vai falhar nas queries, mas pelo menos loga)
 */
function resolvePhoneFromMessage(msg) {
    const remoteJid = msg.key.remoteJid || '';

    // ── Caso 1: JID normal @s.whatsapp.net ──
    if (remoteJid.includes('@s.whatsapp.net')) {
        const phone = remoteJid.split('@')[0];
        // Cachear para caso futuro vir como @lid
        return { phone, jid: remoteJid, source: 'jid' };
    }

    // ── Caso 2: JID @lid — precisamos encontrar o telefone real ──
    if (remoteJid.includes('@lid')) {
        const lidId = remoteJid.split('@')[0];

        // Fonte A: msg.verifiedBizName ou campos internos do Baileys
        // Fonte B: senderPn (disponível em algumas versões)
        // Fonte C: participant (usado em grupos, mas checamos)
        // Fonte D: pushName não ajuda, mas key.participant pode
        const parsedMsg = JSON.parse(JSON.stringify(msg));
        
        const candidates = [
            parsedMsg.key?.senderPn,
            parsedMsg.key?.participant,
            parsedMsg.participant,
            parsedMsg.verifiedBizName, // não é telefone, mas checamos
        ].filter(Boolean);

        for (const candidate of candidates) {
            // Extrair telefone de qualquer formato JID
            const cleaned = candidate.split('@')[0].replace(/\D/g, '');
            if (cleaned.length >= 10 && cleaned.length <= 13) {
                // Encontramos um telefone real! Cachear o mapeamento
                lidToPhoneMap.set(lidId, cleaned);
                console.log(`🔗 [LID-MAP] Mapeado ${lidId.substring(0,8)}... → ${cleaned.slice(-8)} (fonte: candidato)`);
                return { phone: cleaned, jid: remoteJid, source: 'lid-resolved' };
            }
        }

        // Fonte E: Cache de mapeamentos anteriores
        if (lidToPhoneMap.has(lidId)) {
            const cached = lidToPhoneMap.get(lidId);
            console.log(`🔗 [LID-MAP] Cache hit: ${lidId.substring(0,8)}... → ${cached.slice(-8)}`);
            return { phone: cached, jid: remoteJid, source: 'lid-cache' };
        }

        // Último recurso: LID puro (vai falhar nas queries, mas logamos para debug)
        console.warn(`⚠️ [LID-MAP] NÃO conseguimos resolver LID: ${lidId}. Mensagem será perdida.`);
        console.warn(`⚠️ [LID-MAP] msg.key:`, JSON.stringify(parsedMsg.key));
        return { phone: null, jid: remoteJid, source: 'lid-unresolved' };
    }

    // ── Caso 3: Formato desconhecido ──
    const phone = remoteJid.split('@')[0].replace(/\D/g, '');
    return { phone: phone || null, jid: remoteJid, source: 'unknown-format' };
}

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
            if (m.type !== 'notify') return;

            const msg = m.messages[0];
            if (!msg || !msg.message) return;
            if (msg.key.fromMe) return;
            if (msg.key.remoteJid?.endsWith('@g.us')) return;

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

            // ═══ RESOLVER O TELEFONE REAL (fix definitivo do @lid) ═══
            const resolved = resolvePhoneFromMessage(msg);
            
            if (!resolved.phone) {
                console.error(`❌ [INBOUND] [${escolaId.substring(0,8)}] Não conseguimos resolver telefone do JID: ${msg.key.remoteJid}`);
                // Tentar usar o JID numérico como último recurso
                const fallbackPhone = (msg.key.remoteJid || '').split('@')[0].replace(/\D/g, '');
                if (fallbackPhone.length < 8) {
                    console.error(`❌ [INBOUND] Telefone irrecuperável. Ignorando mensagem.`);
                    return;
                }
                resolved.phone = fallbackPhone;
            }

            // Se a mensagem veio de @s.whatsapp.net, pré-cachear para futuras @lid
            if (resolved.source === 'jid' && resolved.phone) {
                // O remoteJid é o telefone real. Quando o bot responder,
                // o Baileys pode converter para @lid internamente.
                // Vamos escutar a resposta do sendMessage para cachear.
            }

            console.log(`\n📥 [INBOUND] [${escolaId.substring(0,8)}] Msg de ${resolved.phone.slice(-8)} (${resolved.source}) | Texto: "${(textContent || '').substring(0,50)}"`);
            
            const phoneForMapping = resolved.phone;
            const replyFn = async (text) => {
                const sentMsg = await sock.sendMessage(msg.key.remoteJid, { text }, { quoted: msg });
                // Se o Baileys retornou a msg com um JID @lid diferente, cachear
                if (sentMsg?.key?.remoteJid?.includes('@lid') && phoneForMapping) {
                    const lidId = sentMsg.key.remoteJid.split('@')[0];
                    if (!lidToPhoneMap.has(lidId)) {
                        lidToPhoneMap.set(lidId, phoneForMapping);
                        console.log(`🔗 [LID-MAP] replyFn: ${lidId.substring(0,8)}... → ${phoneForMapping.slice(-8)}`);
                    }
                }
            };

            await processIncomingMessage(escolaId, resolved.phone, textContent, replyFn, mediaFallbackText);

        } catch (error) {
            console.error(`❌ [INBOUND] [${escolaId.substring(0,8)}] Error:`, error.message);
        }
    });

    // ═══ LISTENER ADICIONAL: Mapear LID quando o Baileys informa ═══
    // Alguns eventos do Baileys incluem mapeamento JID → telefone
    try {
        sock.ev.on('contacts.update', (contacts) => {
            for (const contact of contacts) {
                if (contact.id?.includes('@lid') && contact.notify) {
                    // notify pode conter o nome, não o telefone, mas tentamos
                }
                // Se o contact tem um JID @lid e a versão do Baileys expõe o telefone:
                if (contact.id?.includes('@lid')) {
                    const lidId = contact.id.split('@')[0];
                    // Checar lidPn (Phone Number) que algumas versões do Baileys incluem
                    const pn = contact.lidPn || contact.verifiedName;
                    if (pn) {
                        const cleaned = pn.replace(/\D/g, '');
                        if (cleaned.length >= 10) {
                            lidToPhoneMap.set(lidId, cleaned);
                            console.log(`🔗 [LID-MAP] contact.update: ${lidId.substring(0,8)}... → ${cleaned.slice(-8)}`);
                        }
                    }
                }
            }
        });
    } catch (e) {
        // Ignorar se o evento não existir nessa versão do Baileys
    }
}

async function processIncomingMessage(escolaId, phoneString, textContent, replyFn, mediaFallbackText) {
    const { sessionKey, phoneCom9, phoneSem9 } = normalizePhone(phoneString);

    console.log(`🔑 [INBOUND] [${escolaId.substring(0,8)}] sessionKey=${sessionKey.slice(-8)} | com9=${phoneCom9.slice(-8)} | sem9=${phoneSem9.slice(-8)}`);

    // ═══ PASSO 1: Session ativa na RAM? Continuar fluxo guiado ═══
    if (hasSession(sessionKey)) {
        const session = getSession(sessionKey);
        console.log(`📌 [INBOUND] [${escolaId.substring(0,8)}] Session ativa: stage=${session.stage}`);
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

module.exports = { setupInboundListener, lidToPhoneMap };
