/**
 * WhatsApp Inbound Message Handler — v2
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

const { supabase } = require('./supabase');
const { sendMessage } = require('./utils/formatMessage'); 

// =====================
// Cache de conversas ativas
// =====================
const activeConversations = new Map();

// =====================
// Helpers de Sessão
// =====================
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
        activeConversations.delete(phone);
        
        // Finalizar tickets em aberto se a inatividade ocorrer no meio do atendimento
        if (data && data.escolaId && data.phoneCom9) {
            try {
                await supabase
                    .from('whatsapp_atendimentos')
                    .update({ status: 'FINALIZADO', updated_at: new Date().toISOString() })
                    .eq('escola_id', data.escolaId)
                    .in('telefone_origem', [phone, data.phoneCom9, data.phoneSem9])
                    .in('status', ['ABERTO', 'EM_ATENDIMENTO']);
            } catch (err) {
                console.error("Erro ao fechar ticket por inatividade:", err);
            }
        }

        if (replyFn) {
            try {
                await replyFn("⏱️ Tempo inativo. Este atendimento automático foi encerrado. Se precisar de algo, envie uma nova mensagem.");
            } catch(e) {}
        }
    }, 3 * 60 * 1000);
    
    activeConversations.set(phone, { ...data, timer });
}

// =====================
// Constantes
// =====================
const RECENT_DAYS_THRESHOLD = 30;

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
6️⃣ - Consultar Faltas

_Responda apenas com o número da opção desejada._`;

const DIAS_SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

// =====================
// Formatar telefone para exibição
// =====================
function formatPhoneDisplay(phone) {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 13 && cleaned.startsWith('55')) {
        const ddd = cleaned.substring(2, 4);
        const p1 = cleaned.substring(4, 5);
        const p2 = cleaned.substring(5, 9);
        const p3 = cleaned.substring(9, 13);
        return `(${ddd}) ${p1} ${p2}-${p3}`;
    }
    if (cleaned.length === 12 && cleaned.startsWith('55')) {
        const ddd = cleaned.substring(2, 4);
        const p1 = cleaned.substring(4, 8);
        const p2 = cleaned.substring(8, 12);
        return `(${ddd}) ${p1}-${p2}`;
    }
    return phone;
}

// =====================
// Formatar data para exibição BR com dia da semana
// =====================
function formatDateBR(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    const diaSem = DIAS_SEMANA[d.getDay()];
    return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year} (${diaSem})`;
}

// =====================
// Listener de Mensagens Recebidas
// =====================
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

            // Obter telefone do remetente
            let rawPhone = msg.key.remoteJid;
            
            if (rawPhone.includes('@lid')) {
                const parsedMsg = JSON.parse(JSON.stringify(msg));
                const realPhoneJid = parsedMsg.key?.senderPn || parsedMsg.key?.participant || parsedMsg.participant;
                if (realPhoneJid) rawPhone = realPhoneJid;
            }
            
            rawPhone = rawPhone.split('@')[0];
            
            const reply = async (text) => {
                await sock.sendMessage(msg.key.remoteJid, { text }, { quoted: msg });
            };

            await processIncomingMessage(escolaId, rawPhone, textContent, reply, mediaFallbackText);

        } catch (error) {
            console.error(`❌ [INBOUND] [${escolaId.substring(0,8)}] Error:`, error.message);
        }
    });
}

// =====================
// Processador Principal
// =====================
async function processIncomingMessage(escolaId, phoneString, textContent, replyFn, mediaFallbackText) {
    let cleanPhone = phoneString.split('@')[0].replace(/\D/g, '');
    
    // Variações do número brasileiro (com e sem nono dígito)
    let phoneCom9 = cleanPhone;
    let phoneSem9 = cleanPhone;
    
    if (cleanPhone.length === 13 && cleanPhone.startsWith('55') && cleanPhone[4] === '9') {
        phoneSem9 = cleanPhone.substring(0, 4) + cleanPhone.substring(5);
    } else if (cleanPhone.length === 12 && cleanPhone.startsWith('55')) {
        phoneCom9 = cleanPhone.substring(0, 4) + '9' + cleanPhone.substring(4);
    }

    const sessionKey = cleanPhone;

    // Se tem conversa ativa, rotear para a máquina de estado
    if (activeConversations.has(sessionKey)) {
        return await handleActiveConversation(escolaId, sessionKey, phoneCom9, phoneSem9, textContent, replyFn, mediaFallbackText);
    }

    // Verificar se há atendimento aberto para este telefone — se sim, canalizar mensagem
    const hasOpenTicket = await routeToOpenAtendimento(escolaId, sessionKey, phoneCom9, phoneSem9, textContent, mediaFallbackText, replyFn);
    if (hasOpenTicket) {
        console.log(`💬 [INBOUND] [${escolaId.substring(0,8)}] Mensagem canalizada para atendimento aberto | Tel: ${sessionKey.slice(-8)}`);
        return; // Mensagem foi adicionada ao ticket, não mostra menu
    }

    // Exibir menu URA
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

// =====================
// MÁQUINA DE ESTADO COMPLETA
// =====================
async function handleActiveConversation(escolaId, sessionKey, phoneCom9, phoneSem9, textContent, replyFn, mediaFallbackText) {
    const session = activeConversations.get(sessionKey);
    const textLower = textContent.toLowerCase().trim();
    const text = textContent.trim();

    try {
        // ===================================
        // MENU URA — Escolha da Opção
        // ===================================
        if (session.stage === 'WAIT_URA_CHOICE') {
            const match = text.match(/^\[?0*([1-6])\]?[\.\-\)]*$/);
            const choice = match ? match[1] : null;

            if (choice === '1') {
                return await startJustificativaFlow(escolaId, sessionKey, phoneCom9, phoneSem9, replyFn);
            }

            if (choice === '6') {
                return await startConsultaFaltasFlow(escolaId, sessionKey, phoneCom9, phoneSem9, replyFn);
            }

            if (SETOR_MAP[choice]) {
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

            setSession(sessionKey, session, replyFn);
            await replyFn("Não entendi. Por favor, responda apenas com o *número* da opção desejada (1 a 6).");
            return;
        }

        // ===================================
        // ATENDIMENTO (Opções 2-5)
        // ===================================
        if (session.stage === 'WAIT_ATENDIMENTO_MSG') {
            const mensagem = text || mediaFallbackText || '';
            if (!mensagem) {
                setSession(sessionKey, session, replyFn);
                await replyFn("Por favor, envie sua mensagem ou documento.");
                return;
            }

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

            const { error: insertError } = await supabase
                .from('whatsapp_atendimentos')
                .insert({
                    escola_id: escolaId,
                    telefone_origem: phoneCom9,
                    nome_contato: nomeContato,
                    setor: session.setor,
                    mensagem_inicial: mensagem.substring(0, 2000),
                    status: 'ABERTO',
                    respostas: [],
                });

            // Manter sessão ativa para escutar novas mensagens (renovar timeout a cada envio)
            setSession(sessionKey, { 
                stage: 'IN_ATENDIMENTO', 
                escolaId, 
                phoneCom9, 
                phoneSem9 
            }, replyFn);

            if (insertError) {
                console.error(`❌ [INBOUND] [${escolaId.substring(0,8)}] Erro ao criar atendimento:`, insertError.message);
                await replyFn("Desculpe, ocorreu um erro ao registrar sua solicitação. Tente novamente mais tarde ou procure a secretaria presencialmente.");
                return;
            }

            console.log(`📩 [INBOUND] [${escolaId.substring(0,8)}] Atendimento criado: ${session.setorLabel} | Tel: ${sessionKey}`);
            await replyFn(`✅ *Solicitação registrada com sucesso!*\n\nSua solicitação de *${session.setorLabel}* foi encaminhada para a secretaria da escola. Enquanto o atendimento estiver aberto, todas as suas mensagens nesta conversa serão encaminhadas para a secretaria.\n\n_Protocolo registrado automaticamente._`);
            return;
        }

        // ===================================
        // ATENDIMENTO HUMANIZADO (MENSAGENS RETORNADAS)
        // ===================================
        if (session.stage === 'IN_ATENDIMENTO') {
            // Repassa a nova mensagem para o canal do painel e renova a sessão para +3min
            const hasOpenTicket = await routeToOpenAtendimento(escolaId, sessionKey, phoneCom9, phoneSem9, textContent, mediaFallbackText, replyFn);
            
            if (!hasOpenTicket) {
                // Se a secretaria fechou (ou ocorreu erro), perguntar antes de jogar menu pra garantir fluxo limpo
                clearSession(sessionKey);
                // Não força o URA imediatamente para evitar poluição visual de ping-pong. 
                // Se o ticket encerrou, ele avisa (o route já avisa). Se não tinha ticket, ignoramos para ele dar um "oi".
            } else if (textContent.trim().match(/^(0|menu)$/i)) {
                // Usuário encerrou o ticket
                clearSession(sessionKey);
            } else {
                // Ticket está aberto, mensagem processada. Renova o timer.
                setSession(sessionKey, session, null);
            }
            return;
        }

        // ===================================
        // CADASTRO — Quer se cadastrar?
        // ===================================
        if (session.stage === 'WAIT_QUER_CADASTRO') {
            if (textLower === 's' || textLower === 'sim') {
                setSession(sessionKey, {
                    ...session,
                    stage: 'WAIT_CAD_TIPO_USUARIO',
                }, replyFn);
                await replyFn("Para iniciarmos, me diga:\n\nVocê é o *Aluno(a)* (Responda 1) ou o *Responsável Legal* (Responda 2)?");
                return;
            }
            if (textLower === 'n' || textLower === 'não' || textLower === 'nao') {
                clearSession(sessionKey);
                await replyFn("Ok! Se precisar, envie uma nova mensagem a qualquer momento. 👋");
                return;
            }
            setSession(sessionKey, session, replyFn);
            await replyFn("Responda apenas com *S* (Sim) ou *N* (Não).");
            return;
        }

        // ===================================
        // CADASTRO — Tipo de Usuário (Aluno ou Responsável)
        // ===================================
        if (session.stage === 'WAIT_CAD_TIPO_USUARIO') {
            if (text === '1') {
                setSession(sessionKey, {
                    ...session,
                    stage: 'WAIT_CAD_ESTUDANTE_TEL_RESP',
                    isEstudante: true
                }, replyFn);
                await replyFn("👨‍🎓 Como você é aluno, para habilitar suas funções de segurança precisamos do celular do seu responsável legal.\n\n*Digite o celular do seu responsável* com DDD (Exemplo: 85999999999):");
                return;
            } else if (text === '2') {
                setSession(sessionKey, {
                    ...session,
                    stage: 'WAIT_CAD_NOME_ALUNO',
                    isEstudante: false
                }, replyFn);
                await replyFn("📝 *Certo! Vamos iniciar seu cadastro como responsável.*\n\nDigite o *nome completo do aluno(a)*:");
                return;
            } else {
                setSession(sessionKey, session, replyFn);
                await replyFn("Responda apenas com *1* (Aluno) ou *2* (Responsável).");
                return;
            }
        }

        // ===================================
        // CADASTRO ESTUDANTE — Recebe número do Pai e pede nome do aluno
        // ===================================
        if (session.stage === 'WAIT_CAD_ESTUDANTE_TEL_RESP') {
            let cleanTel = text.replace(/\D/g, '');
            if (cleanTel.length < 10) {
                setSession(sessionKey, session, replyFn);
                await replyFn("⚠️ Telefone inválido. Por favor, digite o celular do responsável COM DDD (ex: 85999999999):");
                return;
            }
            // fix br phone formatting internally
            if (cleanTel.length === 10 || cleanTel.length === 11) {
                cleanTel = '55' + cleanTel;
            }
            if (cleanTel.length === 12 && cleanTel.startsWith('55')) {
                cleanTel = cleanTel.substring(0, 4) + '9' + cleanTel.substring(4);
            }
            
            setSession(sessionKey, {
                ...session,
                stage: 'WAIT_CAD_NOME_ALUNO',
                telefoneRespInformadoPeloEstudante: cleanTel
            }, replyFn);
            await replyFn("Obrigado. Agora, digite seu *nome completo* (nome do aluno) para eu encontrá-lo:");
            return;
        }

        // ===================================
        // CADASTRO — Nome do aluno (busca fuzzy)
        // ===================================
        if (session.stage === 'WAIT_CAD_NOME_ALUNO') {
            if (text.length < 3) {
                setSession(sessionKey, session, replyFn);
                await replyFn("O nome precisa ter pelo menos 3 caracteres. Tente novamente:");
                return;
            }

            // Busca fuzzy via RPC
            const { data: alunos, error: rpcError } = await supabase
                .rpc('buscar_aluno_por_nome', {
                    p_escola_id: escolaId,
                    p_nome_busca: text,
                });

            if (rpcError) {
                console.error(`❌ [INBOUND] [${escolaId.substring(0,8)}] RPC error:`, rpcError.message);
                clearSession(sessionKey);
                await replyFn("Ocorreu um erro ao buscar. Tente novamente mais tarde.");
                return;
            }

            if (!alunos || alunos.length === 0) {
                setSession(sessionKey, session, replyFn);
                await replyFn("❌ Nenhum aluno encontrado com esse nome nesta escola.\n\nVerifique a grafia e tente novamente, ou envie *0* para cancelar.");
                return;
            }

            if (alunos.length === 1) {
                const a = alunos[0];
                setSession(sessionKey, {
                    ...session,
                    stage: 'WAIT_CAD_CONFIRMA_ALUNO',
                    alunoEncontrado: a,
                    alunosLista: null,
                }, replyFn);
                await replyFn(`Encontramos:\n\n🎓 *${a.nome}*\n📋 Turma: *${a.turma_nome}*\n\nÉ esse aluno? Responda *S* (Sim) ou *N* (Não):`);
                return;
            }

            // Múltiplos resultados
            let lista = "Encontramos os seguintes alunos:\n\n";
            alunos.forEach((a, i) => {
                lista += `${i + 1}️⃣ - *${a.nome}* (${a.turma_nome})\n`;
            });
            lista += "\nDigite o *número* do aluno correto, ou *0* para cancelar:";

            setSession(sessionKey, {
                ...session,
                stage: 'WAIT_CAD_CONFIRMA_ALUNO',
                alunoEncontrado: null,
                alunosLista: alunos,
            }, replyFn);
            await replyFn(lista);
            return;
        }

        // ===================================
        // CADASTRO — Confirma aluno
        // ===================================
        if (session.stage === 'WAIT_CAD_CONFIRMA_ALUNO') {
            if (text === '0') {
                clearSession(sessionKey);
                await replyFn("Cadastro cancelado. Se precisar, envie uma nova mensagem. 👋");
                return;
            }

            let alunoSelecionado = null;

            if (session.alunoEncontrado) {
                // Confirmação de resultado único
                if (textLower === 's' || textLower === 'sim') {
                    alunoSelecionado = session.alunoEncontrado;
                } else if (textLower === 'n' || textLower === 'não' || textLower === 'nao') {
                    setSession(sessionKey, {
                        ...session,
                        stage: 'WAIT_CAD_NOME_ALUNO',
                        alunoEncontrado: null,
                    }, replyFn);
                    await replyFn("Ok! Digite o nome completo do aluno novamente:");
                    return;
                } else {
                    setSession(sessionKey, session, replyFn);
                    await replyFn("Responda apenas com *S* (Sim) ou *N* (Não).");
                    return;
                }
            } else if (session.alunosLista) {
                // Seleção de lista
                const idx = parseInt(text, 10);
                if (isNaN(idx) || idx < 1 || idx > session.alunosLista.length) {
                    setSession(sessionKey, session, replyFn);
                    await replyFn(`Digite um número de *1* a *${session.alunosLista.length}*, ou *0* para cancelar.`);
                    return;
                }
                alunoSelecionado = session.alunosLista[idx - 1];
            }

            if (!alunoSelecionado) {
                setSession(sessionKey, session, replyFn);
                await replyFn("Não entendi. Tente novamente.");
                return;
            }

            // Verificar se já existe pré-cadastro pendente
            const { data: existente } = await supabase
                .from('whatsapp_pre_cadastros')
                .select('id')
                .eq('aluno_id', alunoSelecionado.id)
                .eq('telefone_responsavel', session.phoneCom9 || sessionKey)
                .eq('status', 'PENDENTE')
                .maybeSingle();

            if (existente) {
                clearSession(sessionKey);
                await replyFn("📋 Já existe um cadastro pendente de aprovação para este aluno com seu número. Aguarde a confirmação da secretaria.");
                return;
            }

            setSession(sessionKey, {
                ...session,
                stage: 'WAIT_CAD_NOME_RESP',
                alunoSelecionado,
            }, replyFn);
            await replyFn(`✅ Aluno selecionado: *${alunoSelecionado.nome}*\n\nAgora, digite *seu nome completo* (nome do responsável):`);
            return;
        }

        // ===================================
        // CADASTRO — Nome do responsável
        // ===================================
        if (session.stage === 'WAIT_CAD_NOME_RESP') {
            if (text.length < 3) {
                setSession(sessionKey, session, replyFn);
                await replyFn("O nome precisa ter pelo menos 3 caracteres. Tente novamente:");
                return;
            }

            const nomeResp = text;
            const phoneToRegister = session.telefoneRespInformadoPeloEstudante || session.phoneCom9 || sessionKey;
            const phoneDisplay = formatPhoneDisplay(phoneToRegister);

            if (session.isEstudante) {
                setSession(sessionKey, {
                    ...session,
                    stage: 'WAIT_CAD_CONFIRMA_TEL',
                    nomeResponsavel: nomeResp,
                }, replyFn);
                await replyFn(`O celular associado ao seu responsável será:\n📱 *${phoneDisplay}*\n\nEstá correto? Responda *S* (Sim) ou *N* (Não):`);
                return;
            }

            setSession(sessionKey, {
                ...session,
                stage: 'WAIT_CAD_CONFIRMA_TEL',
                nomeResponsavel: nomeResp,
            }, replyFn);
            await replyFn(`Seu número de telefone é:\n📱 *${phoneDisplay}*\n\nEstá correto? Responda *S* (Sim) ou *N* (Não):`);
            return;
        }

        // ===================================
        // CADASTRO — Confirma telefone
        // ===================================
        if (session.stage === 'WAIT_CAD_CONFIRMA_TEL') {
            if (textLower === 'n' || textLower === 'não' || textLower === 'nao') {
                clearSession(sessionKey);
                await replyFn("Para cadastrar com outro número, envie a mensagem a partir do telefone correto ou procure a secretaria da escola.");
                return;
            }
            if (textLower !== 's' && textLower !== 'sim') {
                setSession(sessionKey, session, replyFn);
                await replyFn("Responda apenas com *S* (Sim) ou *N* (Não).");
                return;
            }

            // Exibir resumo
            const aluno = session.alunoSelecionado;
            const phoneToRegister = session.telefoneRespInformadoPeloEstudante || session.phoneCom9 || sessionKey;
            const phoneDisplay = formatPhoneDisplay(phoneToRegister);
            const resumo = `📋 *Resumo do Cadastro:*\n━━━━━━━━━━━━━━━━━━\n👤 Responsável: *${session.nomeResponsavel}*\n🎓 Aluno(a): *${aluno.nome}*\n📚 Turma: *${aluno.turma_nome}*\n📱 Celular do Resp.: *${phoneDisplay}*\n━━━━━━━━━━━━━━━━━━\n\nTodas as informações estão corretas?\nResponda *S* para confirmar ou *N* para cancelar:`;

            setSession(sessionKey, {
                ...session,
                stage: 'WAIT_CAD_RESUMO',
                telefoneCadastroFinal: phoneToRegister
            }, replyFn);
            await replyFn(resumo);
            return;
        }

        // ===================================
        // CADASTRO — Confirmação do resumo
        // ===================================
        if (session.stage === 'WAIT_CAD_RESUMO') {
            if (textLower === 'n' || textLower === 'não' || textLower === 'nao') {
                clearSession(sessionKey);
                await replyFn("Cadastro cancelado. Se precisar, envie uma nova mensagem a qualquer momento. 👋");
                return;
            }
            if (textLower !== 's' && textLower !== 'sim') {
                setSession(sessionKey, session, replyFn);
                await replyFn("Responda apenas com *S* (Sim) ou *N* (Não).");
                return;
            }

            // Gravar pré-cadastro com telefone normalizado (13 dígitos, com 9)
            const resolvedPhone = session.telefoneCadastroFinal || session.phoneCom9 || sessionKey;
            const { error: insertError } = await supabase
                .from('whatsapp_pre_cadastros')
                .insert({
                    escola_id: escolaId,
                    aluno_id: session.alunoSelecionado.id,
                    nome_responsavel: session.nomeResponsavel,
                    telefone_responsavel: resolvedPhone,
                    status: 'PENDENTE',
                });

            clearSession(sessionKey);

            if (insertError) {
                console.error(`❌ [INBOUND] [${escolaId.substring(0,8)}] Erro ao gravar pré-cadastro:`, insertError.message);
                await replyFn("Ocorreu um erro ao registrar seu cadastro. Tente novamente mais tarde ou procure a secretaria.");
                return;
            }

            console.log(`📩 [INBOUND] [${escolaId.substring(0,8)}] Pré-cadastro criado: ${session.nomeResponsavel} → ${session.alunoSelecionado.nome}`);
            await replyFn("✅ *Cadastro enviado com sucesso!*\n\nA secretaria da escola irá analisar e confirmar seu cadastro. Após a aprovação, você poderá utilizar todos os recursos do bot, incluindo justificativas de faltas.\n\n_Você será notificado quando o cadastro for aprovado._ 📋");
            return;
        }

        // ===================================
        // JUSTIFICATIVA — Seleção de aluno
        // ===================================
        if (session.stage === 'WAIT_ALUNO_CHOICE') {
            const idx = parseInt(text, 10);
            if (isNaN(idx) || idx < 1 || idx > session.alunosVinculados.length) {
                setSession(sessionKey, session, replyFn);
                await replyFn(`Digite um número de *1* a *${session.alunosVinculados.length}*:`);
                return;
            }

            const aluno = session.alunosVinculados[idx - 1];
            return await showFaltasDoAluno(escolaId, sessionKey, aluno, session.alunosVinculados, replyFn);
        }

        // ===================================
        // JUSTIFICATIVA — Seleção de datas
        // ===================================
        if (session.stage === 'WAIT_DATA_CHOICE') {
            const faltas = session.faltasDisponiveis;

            if (text === '0') {
                // Todas as datas
                setSession(sessionKey, {
                    ...session,
                    stage: 'WAIT_MOTIVO',
                    datasSelecionadas: faltas.map(f => f.data_chamada),
                }, replyFn);
                await replyFn(`Você selecionou *todas as ${faltas.length} datas*.\n\nDescreva o motivo da(s) falta(s) ou envie a foto do atestado médico:`);
                return;
            }

            // Parse seleção: "1,3" ou "1, 3" ou "1 3" etc
            const indices = text.split(/[\s,;]+/).map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
            const validos = indices.filter(n => n >= 1 && n <= faltas.length);

            if (validos.length === 0) {
                setSession(sessionKey, session, replyFn);
                await replyFn(`Responda com o(s) número(s) das datas (ex: *1,3*) ou *0* para todas:`);
                return;
            }

            const datasSelecionadas = [...new Set(validos)].map(i => faltas[i - 1].data_chamada);

            const datasFormatadas = datasSelecionadas.map(d => formatDateBR(d)).join('\n• ');

            setSession(sessionKey, {
                ...session,
                stage: 'WAIT_MOTIVO',
                datasSelecionadas,
            }, replyFn);
            await replyFn(`Datas selecionadas:\n• ${datasFormatadas}\n\nDescreva o motivo da(s) falta(s) ou envie a foto do atestado médico:`);
            return;
        }

        // ===================================
        // JUSTIFICATIVA — Motivo/Atestado
        // ===================================
        if (session.stage === 'WAIT_MOTIVO') {
            const motivo = text || mediaFallbackText || '';
            if (!motivo) {
                setSession(sessionKey, session, replyFn);
                await replyFn("Por favor, descreva o motivo ou envie uma foto do atestado:");
                return;
            }

            const studentId = session.alunoAtual.id;
            const nomeAluno = session.alunoAtual.nome;
            const datas = session.datasSelecionadas;
            let erroCount = 0;

            for (const dataFalta of datas) {
                // Verificar duplicata
                const { data: existing } = await supabase
                    .from('whatsapp_justificativas')
                    .select('id')
                    .eq('aluno_id', studentId)
                    .eq('data_falta', dataFalta)
                    .in('status', ['PENDENTE', 'APROVADA'])
                    .maybeSingle();

                if (existing) continue; // pula duplicata silenciosamente

                const { error: insertError } = await supabase
                    .from('whatsapp_justificativas')
                    .insert({
                        escola_id: escolaId,
                        aluno_id: studentId,
                        data_falta: dataFalta,
                        telefone_origem: sessionKey,
                        mensagem_pai: motivo.substring(0, 1000),
                        status: 'PENDENTE'
                    });
                
                if (insertError) {
                    console.error(`❌ [INBOUND] [${escolaId.substring(0,8)}] Insert erro:`, insertError.message);
                    erroCount++;
                }
            }

            if (erroCount === datas.length) {
                clearSession(sessionKey);
                await replyFn("Tivemos um problema para registrar sua(s) justificativa(s). Entre em contato com a secretaria.");
                return;
            }

            console.log(`📩 [INBOUND] [${escolaId.substring(0,8)}] Justificativa(s) recebida(s) para ${nomeAluno} — ${datas.length} data(s)`);

            // Perguntar se quer justificar outro aluno
            if (session.alunosVinculados && session.alunosVinculados.length > 1) {
                setSession(sessionKey, {
                    ...session,
                    stage: 'WAIT_OUTRO_ALUNO',
                }, replyFn);
                await replyFn(`✅ *Justificativa(s) registrada(s) com sucesso!*\n\nAluno(a): *${nomeAluno}*\nDatas: ${datas.length} falta(s) justificada(s)\n\nA coordenação irá analisar e retornar em breve.\n\nDeseja justificar falta de *outro aluno*? Responda *S* (Sim) ou *N* (Não):`);
            } else {
                setSession(sessionKey, {
                    ...session,
                    stage: 'WAIT_OUTRO_ALUNO',
                }, replyFn);
                await replyFn(`✅ *Justificativa(s) registrada(s) com sucesso!*\n\nAluno(a): *${nomeAluno}*\nDatas: ${datas.length} falta(s) justificada(s)\n\nA coordenação irá analisar e retornar em breve.\n\n_(Nota: Esta linha do WhatsApp envia apenas notificações escolares automáticas)._`);
                // Se só tem 1 aluno, encerrar automaticamente após mostrar confirmação
                clearSession(sessionKey);
            }
            return;
        }

        // ===================================
        // JUSTIFICATIVA — Outro aluno?
        // ===================================
        if (session.stage === 'WAIT_OUTRO_ALUNO') {
            if (textLower === 's' || textLower === 'sim') {
                // Voltar para seleção de aluno
                return await showAlunoSelection(escolaId, sessionKey, session.alunosVinculados, replyFn);
            }
            if (textLower === 'n' || textLower === 'não' || textLower === 'nao') {
                clearSession(sessionKey);
                await replyFn("Ok! Se precisar, envie uma nova mensagem a qualquer momento. Até logo! 👋");
                return;
            }
            setSession(sessionKey, session, replyFn);
            await replyFn("Responda apenas com *S* (Sim) ou *N* (Não).");
            return;
        }

    } catch (err) {
        console.error("Erro no fluxo do Chatbot:", err);
        clearSession(sessionKey);
    }
}

// =====================
// INÍCIO DO FLUXO DE JUSTIFICATIVA
// =====================
async function startJustificativaFlow(escolaId, sessionKey, phoneCom9, phoneSem9, replyFn) {
    // Buscar alunos vinculados ao telefone
    const { data: students, error: studentError } = await supabase
        .from('alunos')
        .select('id, nome, turma_id, telefone_responsavel, telefone_responsavel_2')
        .eq('escola_id', escolaId)
        .eq('situacao', 'ativo')
        .or(`telefone_responsavel.in.(${phoneCom9},${phoneSem9}),telefone_responsavel_2.in.(${phoneCom9},${phoneSem9})`);

    if (studentError) {
        console.error(`❌ [INBOUND] [${escolaId.substring(0,8)}] Erro ao buscar alunos:`, studentError.message);
        clearSession(sessionKey);
        await replyFn("Ocorreu um erro ao verificar seu cadastro. Tente novamente mais tarde.");
        return;
    }

    // NÚMERO NÃO VINCULADO → oferecer auto-cadastro
    if (!students || students.length === 0) {
        console.log(`📋 [INBOUND] [${escolaId.substring(0,8)}] Telefone não vinculado: ${phoneCom9} — oferecendo cadastro`);
        setSession(sessionKey, {
            stage: 'WAIT_QUER_CADASTRO',
            escolaId,
            phoneCom9,
            phoneSem9,
        }, replyFn);
        await replyFn("📋 Seu número de telefone ainda não está vinculado a nenhum aluno nesta escola.\n\nDeseja realizar o *cadastro de responsável*?\nResponda *S* (Sim) ou *N* (Não):");
        return;
    }

    // Enriquecer com nome da turma
    const turmaIds = [...new Set(students.map(s => s.turma_id).filter(Boolean))];
    let turmaMap = {};
    if (turmaIds.length > 0) {
        const { data: turmas } = await supabase
            .from('turmas')
            .select('id, nome')
            .in('id', turmaIds);
        if (turmas) {
            turmas.forEach(t => { turmaMap[t.id] = t.nome; });
        }
    }
    
    const alunosComTurma = students.map(s => ({
        ...s,
        turma_nome: turmaMap[s.turma_id] || 'Sem turma',
    }));

    if (alunosComTurma.length === 1) {
        // Único aluno → ir direto para faltas
        return await showFaltasDoAluno(escolaId, sessionKey, alunosComTurma[0], alunosComTurma, replyFn);
    }

    // Múltiplos alunos → selecionar
    return await showAlunoSelection(escolaId, sessionKey, alunosComTurma, replyFn);
}

// =====================
// INÍCIO DO FLUXO DE CONSULTA DE FALTAS
// =====================
async function startConsultaFaltasFlow(escolaId, sessionKey, phoneCom9, phoneSem9, replyFn) {
    // Buscar se o telefone é do aluno, ou responsável
    const { data: students, error: studentError } = await supabase
        .from('alunos')
        .select('id, nome, turma_id, telefone_responsavel, telefone_responsavel_2, telefone_aluno')
        .eq('escola_id', escolaId)
        .eq('situacao', 'ativo')
        .or(`telefone_responsavel.in.(${phoneCom9},${phoneSem9}),telefone_responsavel_2.in.(${phoneCom9},${phoneSem9}),telefone_aluno.in.(${phoneCom9},${phoneSem9})`);

    if (studentError) {
        console.error(`❌ [INBOUND] Erro ao buscar faltas (consulta):`, studentError.message);
        clearSession(sessionKey);
        await replyFn("Ocorreu um erro ao verificar seu cadastro. Tente novamente mais tarde.");
        return;
    }

    if (!students || students.length === 0) {
        console.log(`📋 [INBOUND] Telefone não vinculado: ${phoneCom9} — oferecendo cadastro`);
        setSession(sessionKey, { stage: 'WAIT_QUER_CADASTRO', escolaId, phoneCom9, phoneSem9 }, replyFn);
        await replyFn("📋 Seu número de telefone não está vinculado a uma matrícula nesta escola.\n\nDeseja realizar o *cadastro de acesso ao Bot e Portal*?\nResponda *S* (Sim) ou *N* (Não):");
        return;
    }

    // Identificar modo (Responsável vs Estudante sem Responsável)
    // Se ele for APENAS "telefone_aluno" e "telefone_responsavel" for diferente ou nulo, o estudante precisa vincular pai
    let validStudents = [];
    let needsParentRegistration = false;

    for (const st of students) {
        const isParent = (st.telefone_responsavel === phoneCom9 || st.telefone_responsavel === phoneSem9 ||
                          st.telefone_responsavel_2 === phoneCom9 || st.telefone_responsavel_2 === phoneSem9);
        if (isParent) {
            validStudents.push(st);
        } else if (st.telefone_aluno === phoneCom9 || st.telefone_aluno === phoneSem9) {
            needsParentRegistration = true;
        }
    }

    // Se só match como aluno e nunca como pai, exige cadastro do pai
    if (validStudents.length === 0 && needsParentRegistration) {
        setSession(sessionKey, { stage: 'WAIT_CAD_ESTUDANTE_TEL_RESP', isEstudante: true, escolaId, phoneCom9, phoneSem9 }, replyFn);
        await replyFn("👨‍🎓 Olá! Vimos que você está acessando como Estudante.\n\nPara consultar faltas por aqui, as regras de segurança exigem o cadastro de um *Responsável Legal*.\n\nDigite o número de *celular com DDD* do seu responsável (Ex: 85999999999):");
        return;
    }

    // Mostrar os totais de falta sem opção interativa além de "ver"
    let msg = `📊 *Resumo de Faltas (Geral)*\n\n`;
    
    // Obter faltas para todos os validStudents
    const studentIds = validStudents.map(s => s.id);
    const { data: faltas } = await supabase
        .from('presencas')
        .select('aluno_id')
        .in('aluno_id', studentIds)
        .eq('escola_id', escolaId)
        .eq('presente', false);

    validStudents.forEach(st => {
        const absCount = (faltas || []).filter(f => f.aluno_id === st.id).length;
        const totalAulasGeral = absCount * 6; // Pedido: Faltas contabilizadas x 6
        msg += `🎓 Aluno: *${st.nome}*\n`;
        msg += `⚠️ Faltas Registradas: *${absCount}* (inclui justificadas/não justificadas)\n`;
        msg += `❌ Total de Aulas Perdidas (aprox): *${totalAulasGeral}* aulas\n\n`;
    });

    clearSession(sessionKey);
    await replyFn(msg + `_Para detalhamento por matéria, por favor procure a escola ou acesse o Portal do Aluno._`);
}

// =====================
// LISTAR ALUNOS PARA SELEÇÃO
// =====================
async function showAlunoSelection(escolaId, sessionKey, alunos, replyFn) {
    let msg = "Você possui mais de um aluno vinculado:\n\n";
    alunos.forEach((a, i) => {
        msg += `${i + 1}️⃣ - *${a.nome}* (${a.turma_nome})\n`;
    });
    msg += "\nDigite o *número* do aluno que deseja justificar:";

    setSession(sessionKey, {
        stage: 'WAIT_ALUNO_CHOICE',
        escolaId,
        alunosVinculados: alunos,
    }, replyFn);
    await replyFn(msg);
}

// =====================
// LISTAR FALTAS DO ALUNO
// =====================
async function showFaltasDoAluno(escolaId, sessionKey, aluno, todosAlunos, replyFn) {
    const today = new Date();
    const threshold = new Date(today.getTime() - (RECENT_DAYS_THRESHOLD * 24 * 60 * 60 * 1000));
    const thresholdStr = threshold.toISOString().split('T')[0];

    const { data: faltas, error: faltaError } = await supabase
        .from('presencas')
        .select('id, data_chamada')
        .eq('aluno_id', aluno.id)
        .eq('escola_id', escolaId)
        .eq('presente', false)
        .eq('falta_justificada', false)
        .gte('data_chamada', thresholdStr)
        .order('data_chamada', { ascending: false });

    if (faltaError) {
        console.error(`❌ [INBOUND] [${escolaId.substring(0,8)}] Erro ao buscar faltas:`, faltaError.message);
        clearSession(sessionKey);
        await replyFn("Ocorreu um erro ao buscar as faltas. Tente novamente mais tarde.");
        return;
    }

    if (!faltas || faltas.length === 0) {
        // Sem faltas — perguntar se quer justificar outro
        if (todosAlunos && todosAlunos.length > 1) {
            setSession(sessionKey, {
                stage: 'WAIT_OUTRO_ALUNO',
                escolaId,
                alunosVinculados: todosAlunos,
            }, replyFn);
            await replyFn(`✅ O aluno(a) *${aluno.nome}* não possui faltas sem justificativa nos últimos ${RECENT_DAYS_THRESHOLD} dias!\n\nDeseja verificar falta de *outro aluno*? Responda *S* ou *N*:`);
        } else {
            clearSession(sessionKey);
            await replyFn(`✅ O aluno(a) *${aluno.nome}* não possui faltas sem justificativa nos últimos ${RECENT_DAYS_THRESHOLD} dias!\n\nSe precisar de algo, envie uma nova mensagem.`);
        }
        return;
    }

    // Listar as faltas
    let msg = `Aluno(a): *${aluno.nome}*\n\nFaltas sem justificativa nos últimos ${RECENT_DAYS_THRESHOLD} dias:\n\n`;
    faltas.forEach((f, i) => {
        msg += `${i + 1}️⃣ - ${formatDateBR(f.data_chamada)}\n`;
    });
    msg += `\n0️⃣ - Justificar *TODAS* as datas acima\n\nResponda com o(s) número(s) das datas que deseja justificar.\nExemplo: *1,3* ou *0* para todas.`;

    setSession(sessionKey, {
        stage: 'WAIT_DATA_CHOICE',
        escolaId,
        alunoAtual: aluno,
        alunosVinculados: todosAlunos,
        faltasDisponiveis: faltas,
    }, replyFn);
    await replyFn(msg);
}

// =====================
// CANALIZAR MENSAGENS PARA ATENDIMENTO ABERTO
// Se o pai já tem um ticket aberto/em_atendimento, novas mensagens
// são adicionadas ao array de respostas do ticket automaticamente.
// =====================
async function routeToOpenAtendimento(escolaId, sessionKey, phoneCom9, phoneSem9, textContent, mediaFallbackText, replyFn) {
    try {
        const mensagem = (textContent || '').trim() || mediaFallbackText || '';
        if (!mensagem) return false;

        // Buscar atendimento aberto ou em_atendimento para este telefone
        const { data: tickets, error } = await supabase
            .from('whatsapp_atendimentos')
            .select('id, respostas, status')
            .eq('escola_id', escolaId)
            .in('telefone_origem', [sessionKey, phoneCom9, phoneSem9])
            .in('status', ['ABERTO', 'EM_ATENDIMENTO'])
            .order('created_at', { ascending: false })
            .limit(1);

        if (error) {
            console.error(`❌ [INBOUND] [${escolaId.substring(0,8)}] Erro query Supabase:`, error.message);
            return false;
        }
        
        if (!tickets || tickets.length === 0) {
            return false; // Sem ticket aberto genuinamente — seguir fluxo normal ou voltar pro URA
        }

        const ticket = tickets[0];
        
        // Se o usuário digitou 0 ou menu, ele quer sair do atendimento
        const isExit = textContent.trim().match(/^(0|menu)$/i);
        if (isExit) {
            await supabase
                .from('whatsapp_atendimentos')
                .update({
                    status: 'FINALIZADO',
                    updated_at: new Date().toISOString(),
                })
                .eq('id', ticket.id);
            
            if (replyFn) {
                await replyFn("Atendimento finalizado. Retornando ao menu principal...");
            }
            return false; // Retorna false para que o fluxo mostre o menu principal novamente
        }

        let respostas = ticket.respostas;
        if (typeof respostas === 'string') {
            try { respostas = JSON.parse(respostas); } catch(e) { respostas = []; }
        }
        if (!Array.isArray(respostas)) {
            respostas = [];
        }

        respostas.push({
            remetente: 'pai',
            mensagem: mensagem.substring(0, 2000),
            timestamp: new Date().toISOString(),
        });

        const { error: updateError } = await supabase
            .from('whatsapp_atendimentos')
            .update({
                respostas,
                updated_at: new Date().toISOString(),
            })
            .eq('id', ticket.id);
            
        if (updateError) {
             console.error(`❌ [INBOUND] [${escolaId.substring(0,8)}] Erro no update do ticket:`, updateError.message);
             return false;
        }

        if (replyFn && respostas.length === 1) {
            // Se for a primeira mensagem adicionada (após a msg inicial), envia um alerta de confirmação pequeno
            await replyFn("Sua mensagem foi adicionada ao atendimento aberto. Aguarde o retorno da secretaria ou digite *0* para sair.");
        }

        return true; // Mensagem canalizada com sucesso
    } catch (err) {
        console.error(`❌ [INBOUND] [${escolaId.substring(0,8)}] Erro ao canalizar para atendimento:`, err.message);
        return false;
    }
}

module.exports = { setupInboundListener };
