const { supabase } = require('../supabase');
const { setSession, clearSession } = require('../utils/sessionManager');

async function routeToOpenAtendimento(escolaId, sessionKey, phoneCom9, phoneSem9, textContent, mediaFallbackText, replyFn) {
    try {
        const mensagem = (textContent || '').trim() || mediaFallbackText || '';
        if (!mensagem) return false;

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
            return false;
        }

        const ticket = tickets[0];
        
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
            return false; // return false para voltar ao menu
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
             console.error(`❌ [INBOUND] [${escolaId.substring(0,8)}] Erro update do ticket:`, updateError.message);
             return false;
        }

        if (replyFn && respostas.length === 1) {
            try {
                await replyFn("Sua mensagem foi adicionada ao atendimento aberto. Aguarde o retorno da secretaria ou digite *0* para sair.");
            } catch (replyErr) {
                console.error("Erro ao enviar aviso de canalização silenciosa:", replyErr.message);
            }
        }

        return true;
    } catch (err) {
        console.error(`❌ [INBOUND] [${escolaId.substring(0,8)}] Erro canalizar atendimento:`, err.message);
        return false;
    }
}

async function handleWaitAtendimentoMsg(session, sessionKey, escolaId, phoneCom9, phoneSem9, text, mediaFallbackText, replyFn) {
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

    setSession(sessionKey, { 
        stage: 'IN_ATENDIMENTO', 
        escolaId, 
        phoneCom9, 
        phoneSem9 
    }, replyFn);

    if (insertError) {
        console.error(`❌ [INBOUND] [${escolaId.substring(0,8)}] Erro criar atendimento:`, insertError.message);
        await replyFn("Desculpe, ocorreu um erro ao registrar sua solicitação. Tente novamente mais tarde ou procure a secretaria presencialmente.");
        return;
    }

    console.log(`📩 [INBOUND] [${escolaId.substring(0,8)}] Atendimento criado: ${session.setorLabel} | Tel: ${sessionKey}`);
    await replyFn(`✅ *Solicitação registrada com sucesso!*\n\nSua solicitação de *${session.setorLabel}* foi encaminhada para a secretaria da escola. Enquanto o atendimento estiver aberto, todas as suas mensagens nesta conversa serão encaminhadas para a secretaria.\n\n_Protocolo registrado automaticamente._`);
}

async function handleInAtendimento(session, sessionKey, escolaId, phoneCom9, phoneSem9, textContent, mediaFallbackText, replyFn) {
    const hasOpenTicket = await routeToOpenAtendimento(escolaId, sessionKey, phoneCom9, phoneSem9, textContent, mediaFallbackText, replyFn);
    
    if (!hasOpenTicket) {
        clearSession(sessionKey);
    } else if (textContent.trim().match(/^(0|menu)$/i)) {
        clearSession(sessionKey);
    } else {
        setSession(sessionKey, session, null);
    }
}

module.exports = {
    routeToOpenAtendimento,
    handleWaitAtendimentoMsg,
    handleInAtendimento
};
