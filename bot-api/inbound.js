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
    // Timeout de 5 minutos
    const timer = setTimeout(async () => {
        try {
            await replyFn("⏱️ Tempo limite esgotado. Esta sessão foi encerrada. Se precisar, envie uma nova mensagem.");
        } catch(e) {}
        activeConversations.delete(phone);
    }, 5 * 60 * 1000);
    
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
function setupInboundListener(sock, escolaId) {
    sock.ev.on('messages.upsert', async (m) => {
        try {
            console.log(`\n\n=== 📥 NOVA MENSAGEM RECEBIDA [${escolaId.substring(0,8)}] ===`);

            if (m.type !== 'notify') return;

            const msg = m.messages[0];
            if (!msg || !msg.message) return;
            if (msg.key.fromMe) return;
            if (msg.key.remoteJid.endsWith('@g.us')) return;

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
            const match = text.match(/^\[?0*([1-5])\]?[\.\-\)]*$/);
            const choice = match ? match[1] : null;

            if (choice === '1') {
                return await startJustificativaFlow(escolaId, sessionKey, phoneCom9, phoneSem9, replyFn);
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
            await replyFn("Não entendi. Por favor, responda apenas com o *número* da opção desejada (1 a 5).");
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

        // ===================================
        // CADASTRO — Quer se cadastrar?
        // ===================================
        if (session.stage === 'WAIT_QUER_CADASTRO') {
            if (textLower === 's' || textLower === 'sim') {
                setSession(sessionKey, {
                    ...session,
                    stage: 'WAIT_CAD_NOME_ALUNO',
                }, replyFn);
                await replyFn("📝 *Vamos iniciar seu cadastro!*\n\nDigite o *nome completo do aluno(a)*:");
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
                .eq('telefone_responsavel', sessionKey)
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
            const phoneDisplay = formatPhoneDisplay(sessionKey);

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
            const phoneDisplay = formatPhoneDisplay(sessionKey);
            const resumo = `📋 *Resumo do Cadastro:*\n━━━━━━━━━━━━━━━━━━\n👤 Responsável: *${session.nomeResponsavel}*\n🎓 Aluno(a): *${aluno.nome}*\n📚 Turma: *${aluno.turma_nome}*\n📱 Telefone: *${phoneDisplay}*\n━━━━━━━━━━━━━━━━━━\n\nTodas as informações estão corretas?\nResponda *S* para confirmar ou *N* para cancelar:`;

            setSession(sessionKey, {
                ...session,
                stage: 'WAIT_CAD_RESUMO',
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

            // Gravar pré-cadastro
            const { error: insertError } = await supabase
                .from('whatsapp_pre_cadastros')
                .insert({
                    escola_id: escolaId,
                    aluno_id: session.alunoSelecionado.id,
                    nome_responsavel: session.nomeResponsavel,
                    telefone_responsavel: sessionKey,
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

module.exports = { setupInboundListener };
