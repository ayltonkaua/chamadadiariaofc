/**
 * WhatsApp Inbound Message Handler
 * 
 * Intercepts incoming messages to detect parents justifying absences.
 * Links the incoming message (by phone number) to a recent absence
 * and saves it in the 'whatsapp_justificativas' Kanban table.
 */

const { supabase } = require('./supabase');
const { sendMessage } = require('./utils/formatMessage'); 

// Cache em memória para gerenciar conversas pendentes
// Formato: { [telefone]: { stage: 'WAIT_OPT_IN' | 'WAIT_NAME' | 'WAIT_MATRICULA' | 'WAIT_MOTIVO', escolaId, studentObj, timerObj, lastReason } }
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
    // Timeout de 3 minutos
    const timer = setTimeout(async () => {
        try {
            await replyFn("⏱️ Tempo limite esgotado. Esta sessão foi encerrada. Se precisar, envie uma nova mensagem.");
        } catch(e) {}
        activeConversations.delete(phone);
    }, 3 * 60 * 1000);
    
    activeConversations.set(phone, { ...data, timer });
}

const RECENT_DAYS_THRESHOLD = 3;

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
            // WhatsApp Web/Multi-device sometimes sends messages via Linked Device IDs (LID)
            // Example: 211982925971541@lid
            let rawPhone = msg.key.remoteJid;
            
            if (rawPhone.includes('@lid')) {
                // Break baileys class encapsulation to safely extract hidden fields
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
    // WhatsApp sends it as 5581996200651 or similar.
    let cleanPhone = phoneString.replace(/\D/g, ''); // Remove any non-digit
    
    // Most brazilian whatsapp numbers start with 55. We want to cut it if it exists.
    if (cleanPhone.startsWith('55') && cleanPhone.length >= 12) {
        cleanPhone = cleanPhone.substring(2);
    }

    // Sometimes the database has the 9th digit (e.g. 81996200651), sometimes it doesn't (8196200651).
    // Let's create a very flexible search: just the last 8 digits are usually unique enough within a school.
    const last8Digits = cleanPhone.slice(-8);

    // --- ROTEADOR DE MÁQUINA DE ESTADO ---
    if (activeConversations.has(cleanPhone)) {
        return await handleActiveConversation(escolaId, cleanPhone, last8Digits, textContent, replyFn);
    }

    // --- FLUXO NORMAL DE RECEBIMENTO INICIAL ---
    // 1. Identify if this phone number belongs to any active student's guardian
    const { data: students, error: studentError } = await supabase
        .from('alunos')
        .select('id, nome, telefone_responsavel, telefone_responsavel_2')
        .eq('escola_id', escolaId)
        .eq('situacao', 'ativo')
        .or(`telefone_responsavel.ilike.%${last8Digits}%,telefone_responsavel_2.ilike.%${last8Digits}%`);

    if (studentError || !students || students.length === 0) {
        // Unknown number or not an active student's guardian.
        // Instead of ignoring silently, we start the Cadaster flow.
        console.log(`⚠️ [INBOUND] [${escolaId.substring(0,8)}] Desconhecido (${last8Digits}). Iniciando fluxo de cadastro.`);
        setSession(cleanPhone, { stage: 'WAIT_OPT_IN', escolaId, originalMessage: textContent }, replyFn);
        await replyFn("Olá! 🤖 Não identifiquei este número em nosso sistema. \nVocê é responsável por algum aluno e deseja justificar uma falta? Responda *SIM* ou *NÃO*.");
        return;
    }

    // Since a parent might have multiple kids, we need to find which one had a recent absence
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
            break; // Found a recent absence
        }
    }

    // Priority 2: Preemptive Justification (Atestado Antecipado). 
    // If no recent absence found, we assume the parent is sending an excuse for TODAY.
    if (!targetStudent) {
        // If parent has multiple active kids but no previous absence, we default to the first one.
        targetStudent = students[0];
        targetAbsenceDate = todayStr;
    }

    // 2. We found a recent absence. Let's create a pending justification.
    
    // First, check if there's already a pending one to avoid spam
    const { data: existing } = await supabase
        .from('whatsapp_justificativas')
        .select('id')
        .eq('aluno_id', targetStudent.id)
        .eq('data_falta', targetAbsenceDate)
        .in('status', ['PENDENTE', 'APROVADA'])
        .maybeSingle();

    if (existing) {
        // Already handling this absence
        return;
    }

    // 3. Insert into the Kanban table
    const { error: insertError } = await supabase
        .from('whatsapp_justificativas')
        .insert({
            escola_id: escolaId,
            aluno_id: targetStudent.id,
            data_falta: targetAbsenceDate,
            telefone_origem: phoneString,
            mensagem_pai: textContent.substring(0, 1000), // Max length safety
            status: 'PENDENTE'
        });

    if (insertError) {
        console.error(`❌ [INBOUND] [${escolaId.substring(0,8)}] Insert error:`, insertError.message);
        return;
    }

    console.log(`📩 [INBOUND] [${escolaId.substring(0,8)}] Absency Justification received for ${targetStudent.nome}`);

    // 4. Send Confirmation Reply
    await replyFn(`Recebemos sua mensagem! Ela foi encaminhada como *Justificativa de Falta* para a coordenação e está em análise. Emitiremos um retorno em breve.`);
}

/**
 * MÁQUINA DE ESTADO DO FLUXO DE CADASTRO
 */
async function handleActiveConversation(escolaId, cleanPhone, last8Digits, textContent, replyFn) {
    const session = activeConversations.get(cleanPhone);
    const textLower = textContent.toLowerCase().trim();

    try {
        if (session.stage === 'WAIT_OPT_IN') {
            if (textLower === 'sim' || textLower === 's') {
                setSession(cleanPhone, { ...session, stage: 'WAIT_NAME' }, replyFn);
                await replyFn("Perfeito. Para localizarmos o cadastro e registrar seu número, por favor, digite o *Nome Completo* do aluno:");
            } else if (textLower === 'nao' || textLower === 'não' || textLower === 'n') {
                clearSession(cleanPhone);
                await replyFn("Tudo bem, em caso de dúvidas procure a secretaria da escola. Até logo! 👋");
            } else {
                setSession(cleanPhone, session, replyFn); // reset timer
                await replyFn("Não entendi. Por favor, responda apenas *SIM* ou *NÃO*.");
            }
            return;
        }

        if (session.stage === 'WAIT_NAME') {
            // Busca aluno por nome na escola (busca flexível)
            const searchName = textContent.trim();
            // A busca full text / ilike simples
            const { data: searchStudents, error } = await supabase
                .from('alunos')
                .select('id, nome, matricula')
                .eq('escola_id', escolaId)
                .eq('situacao', 'ativo')
                .ilike('nome', `%${searchName}%`);
            
            if (error || !searchStudents || searchStudents.length === 0) {
                setSession(cleanPhone, session, replyFn); // reset timer
                await replyFn(`Não encontrei nenhum aluno contendo "${searchName}" ativo na escola. Pode tentar digitar o nome novamente?`);
                return;
            }

            // Achou um ou mais alunos
            setSession(cleanPhone, { ...session, stage: 'WAIT_MATRICULA', possibleStudents: searchStudents }, replyFn);
            await replyFn("Certo! Agora, por favor, digite a *Matrícula* (código de estudante) desse aluno para confirmarmos a sua identidade:");
            return;
        }

        if (session.stage === 'WAIT_MATRICULA') {
            const inputMatricula = textContent.trim();
            
            // Verifica se a matrícula bate com algum dos alunos possíveis encontrados antes
            const matchedStudent = session.possibleStudents.find(
                s => s.matricula.trim().toLowerCase() === inputMatricula.toLowerCase()
            );

            if (!matchedStudent) {
                setSession(cleanPhone, session, replyFn); // reset timer
                await replyFn("A matrícula informada não confere com o aluno. Por favor, digite a matrícula correta:");
                return;
            }

            // Bateu! Atualiza o banco e segue pra justificativa
            const { error: updateError } = await supabase
                .from('alunos')
                .update({ telefone_responsavel_2: cleanPhone }) // Salvamos no telefone_responsavel_2 por precaução
                .eq('id', matchedStudent.id);
            
            if (updateError) {
                console.error("Erro ao atualizar telefone do pai:", updateError);
                await replyFn("Desculpe, ocorreu um erro interno ao salvar seu cadastro. Tente mais tarde.");
                clearSession(cleanPhone);
                return;
            }

            setSession(cleanPhone, { ...session, stage: 'WAIT_MOTIVO', studentObj: matchedStudent }, replyFn);
            await replyFn(`✅ Cadastro realizado com sucesso! Registramos seu número como responsável por *${matchedStudent.nome}*.\n\nVocê comentou no início que desejava justificar uma falta. Qual o motivo da ausência?`);
            return;
        }

        if (session.stage === 'WAIT_MOTIVO') {
            const motivo = textContent.trim();
            const studentId = session.studentObj.id;
            const nomeAluno = session.studentObj.nome;
            const todayStr = new Date().toISOString().split('T')[0];

            // Cria Justificativa Preventiva no Kanban com a data de hoje
            const { error: insertError } = await supabase
                .from('whatsapp_justificativas')
                .insert({
                    escola_id: escolaId,
                    aluno_id: studentId,
                    data_falta: todayStr,
                    telefone_origem: cleanPhone,
                    mensagem_pai: session.originalMessage + " | Motivo extra: " + motivo.substring(0, 800),
                    status: 'PENDENTE'
                });
            
            clearSession(cleanPhone);

            if (insertError) {
                console.error(`❌ [INBOUND] [${escolaId.substring(0,8)}] Insert erro no fluxo manual:`, insertError.message);
                await replyFn("Tivemos um problema para registrar sua justificativa. Entre em contato com a secretaria.");
                return;
            }

            console.log(`📩 [INBOUND] [${escolaId.substring(0,8)}] Absency Justification via Novo Cadastro received for ${nomeAluno}`);
            await replyFn("Recebemos sua mensagem! Ela foi encaminhada como *Justificativa de Falta* para a coordenação e está em análise. Emitiremos um retorno em breve.");
            return;
        }

    } catch (err) {
        console.error("Erro no fluxo do Chatbot:", err);
        clearSession(cleanPhone);
    }
}

module.exports = { setupInboundListener };
