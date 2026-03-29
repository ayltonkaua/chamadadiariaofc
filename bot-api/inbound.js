/**
 * WhatsApp Inbound Message Handler
 * 
 * URA-based menu system for incoming messages:
 * 1 - Justificar Falta (existing Kanban flow)
 * 2 - Carteira de Estudante
 * 3 - Histórico/Boletim Escolar
 * 4 - Declaração de Escolaridade
 * 5 - Pé-de-Meia
 * 
 * Options 2-5 create tickets in whatsapp_atendimentos table.
 */

const { supabase } = require('./supabase');
const { sendMessage } = require('./utils/formatMessage'); 

// Cache em memória para gerenciar conversas pendentes
const activeConversations = new Map();

// Helpers de Sessão
function clearSession(phone) {
    if (activeConversations.has(phone)) {
        clearTimeout(activeConversations.get(phone).timer);
        activeConversations.delete(phone);
    }
}

function setSession(phone, data, replyFn) {
    if (activeConversations.has(phone)) {
        clearTimeout(activeConversations.get(phone).timer);
    }
    // Timeout de 5 minutos
    const timer = setTimeout(async () => {
        try {
            await replyFn("⏱️ Tempo limite esgotado. Esta sessão foi encerrada. Se precisar, envie uma nova mensagem.");
        } catch(e) {}
        activeConversations.delete(phone);
    }, 5 * 60 * 1000);
    
    activeConversations.set(phone, { ...data, timer });
}

const RECENT_DAYS_THRESHOLD = 3;

const SETOR_MAP = {
    '2': { setor: 'carteirinha', label: 'Carteira de Estudante' },
    '3': { setor: 'boletim', label: 'Histórico/Boletim Escolar' },
    '4': { setor: 'declaracao', label: 'Declaração de Escolaridade' },
    '5': { setor: 'pe_de_meia', label: 'Pé-de-Meia' },
};

const URA_MENU = `🤖 *Olá! Sou o assistente virtual da escola.* 

Escolha uma opção digitando o número correspondente:

1️⃣ - Justificar Falta
2️⃣ - Carteira de Estudante
3️⃣ - Histórico/Boletim Escolar
4️⃣ - Declaração de Escolaridade
5️⃣ - Pé-de-Meia

_Responda apenas com o número da opção desejada._`;

function setupInboundListener(sock, escolaId) {
    sock.ev.on('messages.upsert', async (m) => {
        try {
            console.log(`\n\n=== 📥 NOVA MENSAGEM RECEBIDA [${escolaId.substring(0,8)}] ===`);
            console.log(JSON.stringify(m, null, 2));

            if (m.type !== 'notify') {
                console.log(`[INBOUND] Ignorando tipo não-notify: ${m.type}`);
                return;
            }

            const msg = m.messages[0];
            if (!msg || !msg.message) {
                console.log(`[INBOUND] Mensagem vazia ou sem prop message`);
                return;
            }
            if (msg.key.fromMe) {
                 console.log(`[INBOUND] Ignorando mensagem enviada por mim mesmo`);
                 return;
            }
            if (msg.key.remoteJid.endsWith('@g.us')) {
                 console.log(`[INBOUND] Ignorando mensagem de grupo: ${msg.key.remoteJid}`);
                 return;
            }

            // Extract text message (handle standard text and extended text from reply)
            const textContent = 
                msg.message.conversation || 
                msg.message.extendedTextMessage?.text || 
                msg.message.imageMessage?.caption || // If they send a photo of the "atestado" and write text
                '';

            if (!textContent.trim()) return;

            // Get sender phone number
            let rawPhone = msg.key.remoteJid;
            
            if (rawPhone.includes('@lid')) {
                const parsedMsg = JSON.parse(JSON.stringify(msg));
                const realPhoneJid = parsedMsg.key?.senderPn || parsedMsg.key?.participant || parsedMsg.participant;
                
                if (realPhoneJid) {
                    rawPhone = realPhoneJid;
                }
            }
            
            // Clean the domain part (@s.whatsapp.net, @lid, etc)
            rawPhone = rawPhone.split('@')[0];
            
            // For Baileys, we can just send response back using sock.sendMessage
            const reply = async (text) => {
                await sock.sendMessage(msg.key.remoteJid, { text }, { quoted: msg });
            };

            await processIncomingMessage(escolaId, rawPhone, textContent, reply);

        } catch (error) {
            console.error(`❌ [INBOUND] [${escolaId.substring(0,8)}] Error:`, error.message);
        }
    });
}

async function processIncomingMessage(escolaId, phoneString, textContent, replyFn) {
    // Treat the incoming phone to match local database format
    let cleanPhone = phoneString.split('@')[0].replace(/\D/g, '');
    
    // Calcula as duas variações do número que o WhatsApp nos deu:
    let phoneCom9 = cleanPhone;
    let phoneSem9 = cleanPhone;
    
    if (cleanPhone.length === 13 && cleanPhone.startsWith('55') && cleanPhone[4] === '9') {
        phoneSem9 = cleanPhone.substring(0, 4) + cleanPhone.substring(5);
    } else if (cleanPhone.length === 12 && cleanPhone.startsWith('55')) {
        phoneCom9 = cleanPhone.substring(0, 4) + '9' + cleanPhone.substring(4);
    }

    // Para o cache, usamos a string base q veio
    const sessionKey = cleanPhone;

    // --- ROTEADOR DE MÁQUINA DE ESTADO ---
    if (activeConversations.has(sessionKey)) {
        return await handleActiveConversation(escolaId, sessionKey, phoneCom9, phoneSem9, textContent, replyFn);
    }

    // --- FLUXO URA: EXIBIR MENU PRINCIPAL ---
    console.log(`📋 [INBOUND] [${escolaId.substring(0,8)}] Exibindo menu URA para ${sessionKey.slice(-8)}`);
    setSession(sessionKey, { 
        stage: 'WAIT_URA_CHOICE', 
        escolaId, 
        originalMessage: textContent 
    }, replyFn);
    await replyFn(URA_MENU);
}

/**
 * MÁQUINA DE ESTADO DO FLUXO COMPLETO
 */
async function handleActiveConversation(escolaId, sessionKey, phoneCom9, phoneSem9, textContent, replyFn) {
    const session = activeConversations.get(sessionKey);
    const textLower = textContent.toLowerCase().trim();

    try {
        // =====================
        // STAGE: URA MENU CHOICE
        // =====================
        if (session.stage === 'WAIT_URA_CHOICE') {
            // Aceita a opção APENAS se o usuário digitou o número isolado (com pontuação opcional). Ex: "1", "1.", "[1]"
            const match = textContent.trim().match(/^\[?0*([1-5])\]?[\.\-\)]*$/);
            const choice = match ? match[1] : null;

            if (choice === '1') {
                // OPÇÃO 1: Justificar Falta → verificar cadastro
                return await handleJustificativaFlow(escolaId, sessionKey, phoneCom9, phoneSem9, session.originalMessage, replyFn);
            }

            if (SETOR_MAP[choice]) {
                // OPÇÕES 2-5: Atendimento Secretaria
                const { setor, label } = SETOR_MAP[choice];
                setSession(sessionKey, { 
                    ...session, 
                    stage: 'WAIT_ATENDIMENTO_MSG',
                    setor,
                    setorLabel: label,
                }, replyFn);
                await replyFn(`Você selecionou: *${label}*\n\nPor favor, digite sua dúvida/pedido para os nossos secretários ou envie a foto do documento necessário.`);
                return;
            }

            // Opção inválida
            setSession(sessionKey, session, replyFn); // reset timer
            await replyFn("Não entendi. Por favor, responda apenas com o *número* da opção desejada (1 a 5).");
            return;
        }

        // =====================
        // STAGE: ATENDIMENTO MSG (Options 2-5)
        // =====================
        if (session.stage === 'WAIT_ATENDIMENTO_MSG') {
            const mensagem = textContent.trim();

            // Buscar nome do contato (se tiver cadastro)
            let nomeContato = null;
            const { data: students } = await supabase
                .from('alunos')
                .select('nome_responsavel')
                .eq('escola_id', escolaId)
                .eq('situacao', 'ativo')
                .or(`telefone_responsavel.in.(${phoneCom9},${phoneSem9}),telefone_responsavel_2.in.(${phoneCom9},${phoneSem9})`)
                .limit(1);
            
            if (students && students.length > 0) {
                nomeContato = students[0].nome_responsavel;
            }

            // Criar ticket na tabela whatsapp_atendimentos
            const { error: insertError } = await supabase
                .from('whatsapp_atendimentos')
                .insert({
                    escola_id: escolaId,
                    telefone_origem: sessionKey,
                    nome_contato: nomeContato,
                    setor: session.setor,
                    mensagem_inicial: mensagem.substring(0, 2000),
                    status: 'ABERTO',
                    respostas: [],
                });

            clearSession(sessionKey);

            if (insertError) {
                console.error(`❌ [INBOUND] [${escolaId.substring(0,8)}] Erro ao criar atendimento:`, insertError.message);
                await replyFn("Desculpe, ocorreu um erro ao registrar sua solicitação. Tente novamente mais tarde ou procure a secretaria presencialmente.");
                return;
            }

            console.log(`📩 [INBOUND] [${escolaId.substring(0,8)}] Atendimento criado: ${session.setorLabel} | Tel: ${sessionKey}`);
            await replyFn(`✅ *Solicitação registrada com sucesso!*\n\nSua solicitação de *${session.setorLabel}* foi encaminhada para a secretaria da escola. Nossa equipe analisará e responderá em breve por esta conversa.\n\n_Protocolo registrado automaticamente._`);
            return;
        }

        // =====================
        // STAGE: JUSTIFICATIVA MOTIVO (from registration flow)
        // =====================
        if (session.stage === 'WAIT_MOTIVO') {
            const motivo = textContent.trim();
            const studentId = session.studentObj.id;
            const nomeAluno = session.studentObj.nome;
            const todayStr = new Date().toISOString().split('T')[0];

            const { error: insertError } = await supabase
                .from('whatsapp_justificativas')
                .insert({
                    escola_id: escolaId,
                    aluno_id: studentId,
                    data_falta: todayStr,
                    telefone_origem: sessionKey,
                    mensagem_pai: motivo.substring(0, 1000),
                    status: 'PENDENTE'
                });
            
            clearSession(sessionKey);

            if (insertError) {
                console.error(`❌ [INBOUND] [${escolaId.substring(0,8)}] Insert erro:`, insertError.message);
                await replyFn("Tivemos um problema para registrar sua justificativa. Entre em contato com a secretaria.");
                return;
            }

            console.log(`📩 [INBOUND] [${escolaId.substring(0,8)}] Justificativa recebida para ${nomeAluno}`);
            await replyFn(`🤖 *Aviso do Assistente Virtual:*\n\nRecebemos sua mensagem! Ela foi encaminhada como *Justificativa de Falta* para a coordenação e está em análise. Emitiremos um retorno em breve.\n\n_(Nota: Esta linha do WhatsApp envia apenas notificações escolares automáticas)._`);
            return;
        }

    } catch (err) {
        console.error("Erro no fluxo do Chatbot:", err);
        clearSession(sessionKey);
    }
}

/**
 * FLUXO DE JUSTIFICATIVA DE FALTA (Opção 1 da URA)
 * 
 * 1. Verifica se o telefone está cadastrado em alunos
 * 2. Se SIM → segue fluxo de justificativa
 * 3. Se NÃO → orienta a procurar a secretaria
 */
async function handleJustificativaFlow(escolaId, sessionKey, phoneCom9, phoneSem9, originalMessage, replyFn) {
    // 1. Buscar aluno pelo telefone (busca indexável nos formatos exatos)
    const { data: students, error: studentError } = await supabase
        .from('alunos')
        .select('id, nome, telefone_responsavel, telefone_responsavel_2')
        .eq('escola_id', escolaId)
        .eq('situacao', 'ativo')
        .or(`telefone_responsavel.in.(${phoneCom9},${phoneSem9}),telefone_responsavel_2.in.(${phoneCom9},${phoneSem9})`);

    if (studentError || !students || students.length === 0) {
        // Número NÃO cadastrado → orientar cadastro presencial
        clearSession(sessionKey);
        console.log(`⚠️ [INBOUND] [${escolaId.substring(0,8)}] Telefone não cadastrado: ${phoneCom9}`);
        await replyFn("⚠️ *Número não cadastrado!*\n\nSeu número de telefone não está registrado no sistema da escola.\n\nPara justificar faltas por WhatsApp, é necessário que a secretaria cadastre seu número como responsável do aluno.\n\n*Procure a secretaria da escola para realizar o cadastro.* Após isso, poderá usar este canal normalmente.");
        return;
    }

    // 2. Número cadastrado → buscar falta recente
    let targetStudent = null;
    let targetAbsenceDate = null;
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const threeDaysAgo = new Date(today.getTime() - (RECENT_DAYS_THRESHOLD * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];

    // Priority 1: Find a student that ALREADY has a recent unjustified absence
    for (const student of students) {
        const { data: presencas } = await supabase
            .from('presencas')
            .select('data_chamada')
            .eq('aluno_id', student.id)
            .eq('escola_id', escolaId)
            .eq('presente', false)
            .eq('falta_justificada', false)
            .gte('data_chamada', threeDaysAgo)
            .order('data_chamada', { ascending: false })
            .limit(1);

        if (presencas && presencas.length > 0) {
            targetStudent = student;
            targetAbsenceDate = presencas[0].data_chamada;
            break;
        }
    }

    // Priority 2: Preemptive Justification (Atestado Antecipado)
    if (!targetStudent) {
        targetStudent = students[0];
        targetAbsenceDate = todayStr;
    }

    // 3. Check for duplicate justification
    const { data: existing } = await supabase
        .from('whatsapp_justificativas')
        .select('id')
        .eq('aluno_id', targetStudent.id)
        .eq('data_falta', targetAbsenceDate)
        .in('status', ['PENDENTE', 'APROVADA'])
        .maybeSingle();

    if (existing) {
        clearSession(sessionKey);
        await replyFn(`🤖 Já existe uma justificativa registrada para o aluno(a) *${targetStudent.nome}* nesta data. Aguarde o retorno da coordenação.`);
        return;
    }

    // 4. Pedir o motivo
    setSession(sessionKey, { 
        stage: 'WAIT_MOTIVO', 
        escolaId, 
        studentObj: targetStudent, 
        absenceDate: targetAbsenceDate 
    }, replyFn);
    await replyFn(`Identificamos o aluno(a) *${targetStudent.nome}*.\n\nPor favor, descreva o motivo da falta (ou envie a foto do atestado) para encaminharmos à coordenação:`);
}

module.exports = { setupInboundListener };
