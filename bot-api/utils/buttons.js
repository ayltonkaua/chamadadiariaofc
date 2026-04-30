/**
 * ══════════════════════════════════════════════════════════════════════
 * WhatsApp Interactive Buttons Helper
 * ══════════════════════════════════════════════════════════════════════
 * 
 * ⚠️ AVISO IMPORTANTE:
 * Este módulo utiliza o pacote @ryuu-reinzz/button-helper que depende
 * de engenharia reversa do protocolo WhatsApp Web. Isso significa que:
 * 
 *   1. Pode PARAR DE FUNCIONAR a qualquer momento com atualizações do
 *      WhatsApp, sem aviso prévio.
 *   2. NÃO é suportado oficialmente pela Meta/WhatsApp.
 *   3. A renderização dos botões pode variar entre dispositivos
 *      (Android vs iOS vs WhatsApp Web).
 *   4. Use com moderação para evitar bloqueios de conta.
 * 
 * O módulo NÃO substitui o @whiskeysockets/baileys principal.
 * Ele apenas adiciona funcionalidade de botões interativos por cima.
 * ══════════════════════════════════════════════════════════════════════
 */

const { sendButtons, sendInteractiveMessage } = require('@ryuu-reinzz/button-helper');

/**
 * Envia uma mensagem com botões de resposta rápida (Quick Reply).
 * Máximo de 3 botões.
 * 
 * @param {object} sock - Socket Baileys (makeWASocket)
 * @param {string} jid  - JID do destinatário (ex: '5581999999999@s.whatsapp.net')
 * @param {object} options
 * @param {string} options.text    - Texto principal da mensagem (body)
 * @param {string} [options.title] - Título/header opcional
 * @param {string} [options.footer] - Rodapé opcional
 * @param {Array<{id: string, text: string}>} options.buttons - Array de botões (máx 3)
 *   Cada botão: { id: 'identificador_unico', text: 'Texto visível' }
 * 
 * @example
 * await sendQuickReplyButtons(sock, jid, {
 *     title: 'Confirmação',
 *     text: 'Deseja confirmar a justificativa?',
 *     footer: 'Toque em um botão abaixo',
 *     buttons: [
 *         { id: 'btn_sim', text: '✅ Sim' },
 *         { id: 'btn_nao', text: '❌ Não' },
 *         { id: 'btn_voltar', text: '↩️ Voltar' },
 *     ]
 * });
 */
async function sendQuickReplyButtons(sock, jid, options) {
    const { text, title, footer, buttons } = options;

    if (!buttons || buttons.length === 0) {
        throw new Error('[buttons.js] É necessário pelo menos 1 botão.');
    }
    if (buttons.length > 3) {
        throw new Error('[buttons.js] Máximo de 3 botões de resposta rápida.');
    }

    await sendButtons(sock, jid, {
        title: title || '',
        text: text,
        footer: footer || '',
        buttons: buttons.map(btn => ({
            id: btn.id,
            text: btn.text,
        })),
    });
}

/**
 * Envia uma lista interativa (menu com seções e opções).
 * Ideal para menus com muitas opções organizadas em categorias.
 * 
 * @param {object} sock - Socket Baileys (makeWASocket)
 * @param {string} jid  - JID do destinatário
 * @param {object} options
 * @param {string} options.text         - Texto principal da mensagem (body)
 * @param {string} [options.title]      - Título/header opcional
 * @param {string} [options.footer]     - Rodapé opcional
 * @param {string} options.buttonText   - Texto do botão que abre a lista (ex: 'Ver opções')
 * @param {Array<{title: string, rows: Array<{id: string, title: string, description?: string}>}>} options.sections
 *   Cada seção: { title: 'Nome da seção', rows: [...] }
 *   Cada row:   { id: 'id_unico', title: 'Título', description: 'Descrição opcional' }
 * 
 * @example
 * await sendListMessage(sock, jid, {
 *     title: '📋 Menu Principal',
 *     text: 'Selecione uma opção abaixo:',
 *     footer: 'Chamada Diária Bot',
 *     buttonText: '📋 Ver Menu',
 *     sections: [
 *         {
 *             title: '📝 Frequência',
 *             rows: [
 *                 { id: 'list_justificar', title: 'Justificar Falta', description: 'Enviar atestado médico' },
 *                 { id: 'list_consultar',  title: 'Consultar Faltas', description: 'Ver faltas do aluno' },
 *             ]
 *         },
 *         {
 *             title: '📚 Informações',
 *             rows: [
 *                 { id: 'list_aula',     title: 'Hoje tem aula?',     description: 'Verificar calendário escolar' },
 *                 { id: 'list_boletim',  title: 'Boletim Escolar',    description: 'Solicitar boletim' },
 *                 { id: 'list_carteira', title: 'Carteira de Estudante', description: 'Solicitar carteirinha' },
 *             ]
 *         }
 *     ]
 * });
 */
async function sendListMessage(sock, jid, options) {
    const { text, title, footer, buttonText, sections } = options;

    if (!sections || sections.length === 0) {
        throw new Error('[buttons.js] É necessário pelo menos 1 seção na lista.');
    }
    if (!buttonText) {
        throw new Error('[buttons.js] buttonText é obrigatório para lista interativa.');
    }

    await sendInteractiveMessage(sock, jid, {
        header: title ? { title } : undefined,
        body: { text },
        footer: footer ? { text: footer } : undefined,
        interactiveButtons: [
            {
                name: 'single_select',
                buttonParamsJson: JSON.stringify({
                    title: buttonText,
                    sections: sections.map(section => ({
                        title: section.title,
                        rows: section.rows.map(row => ({
                            id: row.id,
                            title: row.title,
                            description: row.description || '',
                        })),
                    })),
                }),
            },
        ],
    });
}

/**
 * Extrai a resposta interativa de uma mensagem recebida.
 * Use dentro do sock.ev.on('messages.upsert', ...) para detectar
 * quando o usuário clicou em um botão ou selecionou uma opção da lista.
 * 
 * @param {object} msg - Objeto da mensagem recebida (m.messages[0])
 * @returns {object|null} Retorna um objeto com os dados da resposta ou null se não for interativa
 *   - { type: 'button', selectedId: string, displayText: string }
 *   - { type: 'list',   selectedId: string, displayText: string }
 *   - null (se não for resposta interativa)
 * 
 * @example
 * sock.ev.on('messages.upsert', async (m) => {
 *     const msg = m.messages[0];
 *     if (!msg?.message) return;
 * 
 *     const interactiveResponse = extractInteractiveResponse(msg);
 *     if (interactiveResponse) {
 *         console.log(`Tipo: ${interactiveResponse.type}`);
 *         console.log(`ID selecionado: ${interactiveResponse.selectedId}`);
 *         console.log(`Texto: ${interactiveResponse.displayText}`);
 *         
 *         switch (interactiveResponse.selectedId) {
 *             case 'btn_sim':
 *                 await sock.sendMessage(jid, { text: 'Você clicou em Sim!' });
 *                 break;
 *             case 'list_justificar':
 *                 // iniciar fluxo de justificativa
 *                 break;
 *         }
 *     }
 * });
 */
function extractInteractiveResponse(msg) {
    if (!msg || !msg.message) return null;

    // ── Resposta de botão de resposta rápida ──
    if (msg.message.buttonsResponseMessage) {
        const resp = msg.message.buttonsResponseMessage;
        return {
            type: 'button',
            selectedId: resp.selectedButtonId || '',
            displayText: resp.selectedDisplayText || '',
        };
    }

    // ── Resposta de lista interativa (single_select) ──
    if (msg.message.listResponseMessage) {
        const resp = msg.message.listResponseMessage;
        return {
            type: 'list',
            selectedId: resp.singleSelectReply?.selectedRowId || '',
            displayText: resp.title || '',
        };
    }

    // ── Resposta via templateButtonReplyMessage (alguns dispositivos) ──
    if (msg.message.templateButtonReplyMessage) {
        const resp = msg.message.templateButtonReplyMessage;
        return {
            type: 'button',
            selectedId: resp.selectedId || '',
            displayText: resp.selectedDisplayText || '',
        };
    }

    // ── Resposta via interactiveResponseMessage (formato novo WhatsApp) ──
    if (msg.message.interactiveResponseMessage) {
        try {
            const body = msg.message.interactiveResponseMessage.nativeFlowResponseMessage;
            if (body?.paramsJson) {
                const params = JSON.parse(body.paramsJson);
                return {
                    type: 'interactive',
                    selectedId: params.id || '',
                    displayText: params.title || params.display_text || '',
                };
            }
        } catch (e) {
            // JSON parse falhou, ignorar
        }
    }

    return null;
}

/**
 * Envia o Menu URA como lista interativa.
 * Usa IDs numéricos ("1"-"8") compatíveis com o state machine existente.
 * Fallback: se sock/jid não estiverem disponíveis, retorna false (caller envia texto).
 * 
 * @param {Function} replyFn - Função de resposta com .sock e .jid anexados
 * @param {string} bodyText - Texto do corpo da mensagem (saudação ou fallback)
 * @returns {boolean} true se enviou via botão, false se precisa de fallback texto
 */
async function sendMenuURA(replyFn, bodyText) {
    if (!replyFn.sock || !replyFn.jid) return false;

    try {
        await sendListMessage(replyFn.sock, replyFn.jid, {
            title: '📋 Assistente Escolar',
            text: bodyText,
            footer: 'Chamada Diária Bot',
            buttonText: '📋 Ver Opções',
            sections: [
                {
                    title: '📝 Frequência',
                    rows: [
                        { id: '1', title: '📎 Justificar Falta', description: 'Enviar atestado ou justificativa' },
                        { id: '6', title: '📊 Consultar Faltas', description: 'Ver faltas acumuladas do aluno' },
                        { id: '7', title: '📚 Hoje tem aula?', description: 'Verificar calendário escolar' },
                    ]
                },
                {
                    title: '📄 Documentos',
                    rows: [
                        { id: '2', title: '🪪 Carteira de Estudante', description: 'Solicitar carteirinha' },
                        { id: '3', title: '📄 Histórico/Boletim', description: 'Solicitar boletim escolar' },
                        { id: '4', title: '📝 Declaração', description: 'Declaração de escolaridade' },
                    ]
                },
                {
                    title: '💰 Benefícios',
                    rows: [
                        { id: '8', title: '👟 Consultar Meu Tênis', description: 'Status do benefício' },
                        { id: '5', title: '💰 Pé-de-Meia', description: 'Informações sobre o programa' },
                    ]
                }
            ]
        });
        console.log(`🔘 [BUTTONS] Menu URA interativo enviado para ${replyFn.jid.substring(0, 12)}...`);
        return true;
    } catch (err) {
        console.error('[BUTTONS] Falha ao enviar menu interativo, usando fallback texto:', err.message);
        return false;
    }
}

/**
 * Envia botões Sim/Não como quick reply.
 * IDs "s" e "n" compatíveis com os handlers existentes do state machine.
 * 
 * @param {Function} replyFn - Função de resposta com .sock e .jid anexados
 * @param {string} bodyText - Texto da pergunta
 * @returns {boolean} true se enviou via botão, false se precisa de fallback texto
 */
async function sendSimNaoButtons(replyFn, bodyText) {
    if (!replyFn.sock || !replyFn.jid) return false;

    try {
        await sendQuickReplyButtons(replyFn.sock, replyFn.jid, {
            text: bodyText,
            footer: 'Toque em um botão',
            buttons: [
                { id: 's', text: '✅ Sim' },
                { id: 'n', text: '❌ Não' },
            ]
        });
        return true;
    } catch (err) {
        console.error('[BUTTONS] Falha Sim/Não buttons:', err.message);
        return false;
    }
}

module.exports = {
    sendQuickReplyButtons,
    sendListMessage,
    extractInteractiveResponse,
    sendMenuURA,
    sendSimNaoButtons,
};
