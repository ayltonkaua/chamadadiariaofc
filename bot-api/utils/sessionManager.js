const activeConversations = new Map();

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

    // Timeout diferente para atendimento (30 min) vs fluxos normais (3 min)
    const isAtendimento = data && (data.stage === 'IN_ATENDIMENTO' || data.stage === 'WAIT_ATENDIMENTO_MSG');
    const timeoutMs = isAtendimento ? 30 * 60 * 1000 : 3 * 60 * 1000;

    const timer = setTimeout(async () => {
        activeConversations.delete(phone);
        
        if (data && data.stage === 'IN_ATENDIMENTO') {
            // Se o usuário está em atendimento, ele provavelmente está aguardando a resposta da escola.
            // Apenas limpamos da memória para economizar recursos. Não fechamos o ticket.
            console.log(`⏱️ [SESSION] Timeout IN_ATENDIMENTO para ${phone.slice(-8)} — removendo da RAM (ticket permanece aberto)`);
            return;
        }
        
        if (replyFn) {
            try {
                await replyFn("⏱️ Tempo inativo. Sessão encerrada.\n\nSe precisar de mais alguma coisa, envie uma nova mensagem.");
            } catch (err) {
                console.error("Erro ao enviar mensagem de inatividade:", err);
            }
        }
    }, timeoutMs);
    
    activeConversations.set(phone, { ...data, timer });
}

function getSession(phone) {
    return activeConversations.get(phone);
}

function hasSession(phone) {
    return activeConversations.has(phone);
}

module.exports = {
    activeConversations,
    clearSession,
    setSession,
    getSession,
    hasSession
};
