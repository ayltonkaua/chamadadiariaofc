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
    // Timeout de 3 minutos
    const timer = setTimeout(async () => {
        activeConversations.delete(phone);
        
        if (data && data.stage === 'IN_ATENDIMENTO') {
            // Se o usuário está em atendimento, ele provavelmente está aguardando a resposta da escola.
            // Apenas limpamos da memória para economizar recursos. Não fechamos o ticket.
            return;
        }
        
        if (replyFn) {
            try {
                await replyFn("⏱️ Tempo inativo. Sessão encerrada.\n\nSe precisar de mais alguma coisa, envie uma nova mensagem.");
            } catch (err) {
                console.error("Erro ao enviar mensagem de inatividade:", err);
            }
        }
    }, 3 * 60 * 1000);
    
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
