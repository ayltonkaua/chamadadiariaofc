const { startJustificativaFlow, handleWaitAlunoChoice, handleWaitDataChoice, handleWaitMotivo, handleWaitOutroAluno } = require('./flows/justificativaFlow');
const { startConsultaFaltasFlow } = require('./flows/consultaFaltasFlow');
const { handleWaitQuerCadastro, handleWaitCadTipoUsuario, handleWaitCadEstudanteTelResp, handleWaitCadNomeAluno, handleWaitCadConfirmaAluno, handleWaitCadNomeResp, handleWaitCadConfirmaTel, handleWaitCadResumo } = require('./flows/cadastroFlow');
const { handleWaitAtendimentoMsg, handleInAtendimento, routeToOpenAtendimento } = require('./flows/atendimentoFlow');
const { setSession, clearSession } = require('./utils/sessionManager');
const { classifyIntent } = require('./utils/aiClassifier');

const SETOR_MAP = {
    '2': { setor: 'carteirinha', label: 'Carteira de Estudante' },
    '3': { setor: 'boletim', label: 'Histórico/Boletim Escolar' },
    '4': { setor: 'declaracao', label: 'Declaração de Escolaridade' },
    '5': { setor: 'pe_de_meia', label: 'Pé-de-Meia' },
};

// Mapa de intents AI → ação no WAIT_URA_CHOICE
const AI_INTENT_SETOR = {
    carteirinha: { setor: 'carteirinha', label: 'Carteira de Estudante' },
    boletim:     { setor: 'boletim',     label: 'Histórico/Boletim Escolar' },
    declaracao:  { setor: 'declaracao',  label: 'Declaração de Escolaridade' },
    pe_de_meia:  { setor: 'pe_de_meia',  label: 'Pé-de-Meia' },
};

async function handleStateMachine(session, sessionKey, textContent, mediaFallbackText, replyFn) {
    const textLower = (textContent || '').toLowerCase().trim();
    const text = (textContent || '').trim();
    const escolaId = session.escolaId;
    const phoneCom9 = session.phoneCom9;
    const phoneSem9 = session.phoneSem9;

    try {
        switch (session.stage) {
            case 'WAIT_URA_CHOICE': {
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

                // Verificar se o usuário tem ticket aberto
                if (escolaId && phoneCom9) {
                    const absorbed = await routeToOpenAtendimento(
                        escolaId, sessionKey, phoneCom9, phoneSem9, 
                        textContent, mediaFallbackText, replyFn
                    );
                    if (absorbed) {
                        console.log(`🔀 [SM] Mensagem em WAIT_URA_CHOICE redirecionada para ticket aberto`);
                        return;
                    }
                }

                // Não digitou número → tentar IA para classificar texto natural
                if (text.length > 1 && escolaId) {
                    const aiResult = await classifyIntent(text);
                    if (aiResult && aiResult.confianca >= 0.6) {
                        console.log(`🧠 [SM] WAIT_URA_CHOICE reclassificado via IA → ${aiResult.intent}`);
                        
                        if (aiResult.intent === 'justificar_falta') {
                            return await startJustificativaFlow(escolaId, sessionKey, phoneCom9, phoneSem9, replyFn);
                        }
                        if (aiResult.intent === 'consultar_faltas') {
                            return await startConsultaFaltasFlow(escolaId, sessionKey, phoneCom9, phoneSem9, replyFn);
                        }
                        if (AI_INTENT_SETOR[aiResult.intent]) {
                            const { setor, label } = AI_INTENT_SETOR[aiResult.intent];
                            setSession(sessionKey, { 
                                ...session, 
                                stage: 'WAIT_ATENDIMENTO_MSG',
                                setor,
                                setorLabel: label,
                            }, replyFn);
                            await replyFn(`Entendi! Você precisa de ajuda com *${label}*. 😊\n\nPor favor, descreva seu pedido ou envie a foto do documento necessário:`);
                            return;
                        }
                        // saudacao ou desconhecido → cai no fallback abaixo
                    }
                }

                setSession(sessionKey, session, replyFn);
                await replyFn("Não consegui entender. 😅 Por favor, responda com o *número* da opção desejada (1 a 6), ou descreva o que precisa com mais detalhes.");
                return;
            }

            // ATENDIMENTO
            case 'WAIT_ATENDIMENTO_MSG':
                return await handleWaitAtendimentoMsg(session, sessionKey, escolaId, phoneCom9, phoneSem9, text, mediaFallbackText, replyFn);
            
            case 'IN_ATENDIMENTO':
                return await handleInAtendimento(session, sessionKey, escolaId, phoneCom9, phoneSem9, textContent, mediaFallbackText, replyFn);

            // CADASTRO
            case 'WAIT_QUER_CADASTRO':
                return await handleWaitQuerCadastro(session, sessionKey, textLower, replyFn);
            case 'WAIT_CAD_TIPO_USUARIO':
                return await handleWaitCadTipoUsuario(session, sessionKey, text, replyFn);
            case 'WAIT_CAD_ESTUDANTE_TEL_RESP':
                return await handleWaitCadEstudanteTelResp(session, sessionKey, text, replyFn);
            case 'WAIT_CAD_NOME_ALUNO':
                return await handleWaitCadNomeAluno(session, sessionKey, text, escolaId, replyFn);
            case 'WAIT_CAD_CONFIRMA_ALUNO':
                return await handleWaitCadConfirmaAluno(session, sessionKey, text, textLower, escolaId, replyFn);
            case 'WAIT_CAD_NOME_RESP':
                return await handleWaitCadNomeResp(session, sessionKey, text, replyFn);
            case 'WAIT_CAD_CONFIRMA_TEL':
                return await handleWaitCadConfirmaTel(session, sessionKey, textLower, replyFn);
            case 'WAIT_CAD_RESUMO':
                return await handleWaitCadResumo(session, sessionKey, textLower, escolaId, replyFn);

            // JUSTIFICATIVAS
            case 'WAIT_ALUNO_CHOICE':
                return await handleWaitAlunoChoice(session, sessionKey, text, escolaId, replyFn);
            case 'WAIT_DATA_CHOICE':
                return await handleWaitDataChoice(session, sessionKey, text, replyFn);
            case 'WAIT_MOTIVO':
                return await handleWaitMotivo(session, sessionKey, text, mediaFallbackText, escolaId, replyFn);
            case 'WAIT_OUTRO_ALUNO':
                return await handleWaitOutroAluno(session, sessionKey, textLower, escolaId, replyFn);
            
            default:
                console.warn(`Stage desconhecido: ${session.stage}`);
                clearSession(sessionKey);
                return;
        }
    } catch (err) {
        console.error("Erro no fluxo do Chatbot (State Machine):", err);
        clearSession(sessionKey);
    }
}

module.exports = {
    handleStateMachine
};
