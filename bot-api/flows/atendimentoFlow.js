const { supabase } = require('../supabase');
const { setSession, clearSession } = require('../utils/sessionManager');

/**
 * Verifica se há ticket aberto para este telefone e canaliza a mensagem.
 * Retorna true se a mensagem foi absorvida por um ticket, false caso contrário.
 */
async function routeToOpenAtendimento(escolaId, sessionKey, phoneCom9, phoneSem9, textContent, mediaFallbackText, replyFn) {
    try {
        const mensagem = (textContent || '').trim() || mediaFallbackText || '';
        if (!mensagem) return false;

        console.log(`🔍 [ATENDIMENTO] [${escolaId.substring(0,8)}] Buscando ticket aberto para phones: [${sessionKey}, ${phoneCom9}, ${phoneSem9}]`);

        const { data: tickets, error } = await supabase
            .from('whatsapp_atendimentos')
            .select('id, respostas, status')
            .eq('escola_id', escolaId)
            .in('telefone_origem', [sessionKey, phoneCom9, phoneSem9])
            .in('status', ['ABERTO', 'EM_ATENDIMENTO'])
            .order('created_at', { ascending: false })
            .limit(1);

        if (error) {
            console.error(`❌ [ATENDIMENTO] [${escolaId.substring(0,8)}] Erro query Supabase:`, error.message);
            return false;
        }
        
        if (!tickets || tickets.length === 0) {
            console.log(`ℹ️ [ATENDIMENTO] [${escolaId.substring(0,8)}] Nenhum ticket aberto encontrado`);
            return false;
        }

        const ticket = tickets[0];
        console.log(`✅ [ATENDIMENTO] [${escolaId.substring(0,8)}] Ticket encontrado: ${ticket.id} (status: ${ticket.status})`);
        
        // Verificar se o usuário quer sair do atendimento
        const isExit = (textContent || '').trim().match(/^(0|menu)$/i);
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
            console.log(`🔚 [ATENDIMENTO] [${escolaId.substring(0,8)}] Ticket finalizado pelo usuário`);
            return false; // return false para voltar ao menu
        }

        // Montar a nova resposta do pai/responsável
        const novaResposta = {
            remetente: 'pai',
            mensagem: mensagem.substring(0, 2000),
            timestamp: new Date().toISOString(),
        };

        // Ler respostas atuais do ticket, adicionar a nova, e salvar
        let respostas = ticket.respostas;
        if (typeof respostas === 'string') {
            try { respostas = JSON.parse(respostas); } catch(e) { respostas = []; }
        }
        if (!Array.isArray(respostas)) {
            respostas = [];
        }

        respostas.push(novaResposta);

        const { error: updateError } = await supabase
            .from('whatsapp_atendimentos')
            .update({
                respostas,
                updated_at: new Date().toISOString(),
            })
            .eq('id', ticket.id);
            
        if (updateError) {
             console.error(`❌ [ATENDIMENTO] [${escolaId.substring(0,8)}] Erro update do ticket:`, updateError.message);
             // IMPORTANTE: Mesmo com erro no update, AINDA retornamos true
             // para que a mensagem NÃO caia no menu URA.
             // É melhor perder uma mensagem do que mandar "Não entendi" ao usuário.
             return true;
        }

        console.log(`📝 [ATENDIMENTO] [${escolaId.substring(0,8)}] Mensagem adicionada ao ticket (total respostas: ${respostas.length})`);

        // Só enviar aviso de "canalização" na primeira resposta do pai no thread
        if (replyFn && respostas.length === 1) {
            try {
                await replyFn("Sua mensagem foi adicionada ao atendimento aberto. Aguarde o retorno da secretaria ou digite *0* para sair.");
            } catch (replyErr) {
                console.error("Erro ao enviar aviso de canalização:", replyErr.message);
            }
        }

        // Restaurar session IN_ATENDIMENTO na RAM (crucial para mensagens seguintes)
        setSession(sessionKey, { 
            stage: 'IN_ATENDIMENTO', 
            escolaId, 
            phoneCom9, 
            phoneSem9 
        }, null);

        return true;
    } catch (err) {
        console.error(`❌ [ATENDIMENTO] [${escolaId.substring(0,8)}] Erro canalizar atendimento:`, err.message);
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

    if (insertError) {
        console.error(`❌ [ATENDIMENTO] [${escolaId.substring(0,8)}] Erro criar atendimento:`, insertError.message);
        await replyFn("Desculpe, ocorreu um erro ao registrar sua solicitação. Tente novamente mais tarde ou procure a secretaria presencialmente.");
        clearSession(sessionKey);
        return;
    }

    // Setar session APÓS confirmar que o insert deu certo
    setSession(sessionKey, { 
        stage: 'IN_ATENDIMENTO', 
        escolaId, 
        phoneCom9, 
        phoneSem9 
    }, null); // null = sem mensagem de timeout (atendimento fica vivo no BD)

    console.log(`📩 [ATENDIMENTO] [${escolaId.substring(0,8)}] Atendimento criado: ${session.setorLabel} | Tel: ${sessionKey}`);
    await replyFn(`✅ *Solicitação registrada com sucesso!*\n\nSua solicitação de *${session.setorLabel}* foi encaminhada para a secretaria da escola. Enquanto o atendimento estiver aberto, todas as suas mensagens nesta conversa serão encaminhadas para a secretaria.\n\n_Protocolo registrado automaticamente._`);
}

async function handleInAtendimento(session, sessionKey, escolaId, phoneCom9, phoneSem9, textContent, mediaFallbackText, replyFn) {
    const hasOpenTicket = await routeToOpenAtendimento(escolaId, sessionKey, phoneCom9, phoneSem9, textContent, mediaFallbackText, replyFn);
    
    if (!hasOpenTicket) {
        // Ticket não existe mais (foi finalizado pela secretaria ou houve erro grave)
        clearSession(sessionKey);
    }
    // Se hasOpenTicket = true, routeToOpenAtendimento já fez setSession internamente
}

module.exports = {
    routeToOpenAtendimento,
    handleWaitAtendimentoMsg,
    handleInAtendimento
};
