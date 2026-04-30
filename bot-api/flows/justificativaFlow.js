const { supabase } = require('../supabase');
const { setSession, clearSession } = require('../utils/sessionManager');
const { formatDateBR } = require('../utils/dateFormatter');
const { sendListMessage, sendSimNaoButtons } = require('../utils/buttons');

const RECENT_DAYS_THRESHOLD = 30;

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

    // Tentar enviar como lista interativa (IDs numéricos = compatível com handler)
    if (replyFn.sock && replyFn.jid && alunos.length <= 10) {
        try {
            await sendListMessage(replyFn.sock, replyFn.jid, {
                title: '🎓 Selecionar Aluno',
                text: 'Você possui mais de um aluno vinculado. Selecione abaixo:',
                footer: 'Justificativa de Falta',
                buttonText: '🎓 Selecionar Aluno',
                sections: [{
                    title: 'Alunos Vinculados',
                    rows: alunos.map((a, i) => ({
                        id: String(i + 1),
                        title: a.nome,
                        description: `Turma: ${a.turma_nome}`,
                    })),
                }],
            });
            return;
        } catch (err) {
            console.error('[BUTTONS] Falha lista alunos:', err.message);
        }
    }
    await replyFn(msg);
}

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
        if (todosAlunos && todosAlunos.length > 1) {
            setSession(sessionKey, {
                stage: 'WAIT_OUTRO_ALUNO',
                escolaId,
                alunosVinculados: todosAlunos,
            }, replyFn);
            const semFaltaMsg = `✅ O aluno(a) *${aluno.nome}* não possui faltas sem justificativa nos últimos ${RECENT_DAYS_THRESHOLD} dias!\n\nDeseja verificar falta de *outro aluno*?`;
            const btnSent = await sendSimNaoButtons(replyFn, semFaltaMsg);
            if (!btnSent) await replyFn(semFaltaMsg + ' Responda *S* ou *N*:');
        } else {
            clearSession(sessionKey);
            await replyFn(`✅ O aluno(a) *${aluno.nome}* não possui faltas sem justificativa nos últimos ${RECENT_DAYS_THRESHOLD} dias!\n\nSe precisar de algo, envie uma nova mensagem.`);
        }
        return;
    }

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

    // Tentar enviar como lista interativa
    if (replyFn.sock && replyFn.jid && faltas.length <= 10) {
        try {
            const rows = faltas.map((f, i) => ({
                id: String(i + 1),
                title: formatDateBR(f.data_chamada),
                description: `Falta #${i + 1}`,
            }));
            rows.push({ id: '0', title: '📌 Justificar TODAS', description: `Todas as ${faltas.length} datas acima` });

            await sendListMessage(replyFn.sock, replyFn.jid, {
                title: '📅 Selecionar Datas',
                text: `Aluno(a): *${aluno.nome}*\n\nFaltas sem justificativa nos últimos ${RECENT_DAYS_THRESHOLD} dias. Selecione a data para justificar:`,
                footer: 'Ou digite várias: 1,3 ou 0 para todas',
                buttonText: '📅 Ver Datas',
                sections: [{ title: 'Datas com Falta', rows }],
            });
            return;
        } catch (err) {
            console.error('[BUTTONS] Falha lista datas:', err.message);
        }
    }
    await replyFn(msg);
}

async function startJustificativaFlow(escolaId, sessionKey, phoneCom9, phoneSem9, replyFn) {
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
        return await showFaltasDoAluno(escolaId, sessionKey, alunosComTurma[0], alunosComTurma, replyFn);
    }

    return await showAlunoSelection(escolaId, sessionKey, alunosComTurma, replyFn);
}

async function handleWaitAlunoChoice(session, sessionKey, text, escolaId, replyFn) {
    const idx = parseInt(text, 10);
    if (isNaN(idx) || idx < 1 || idx > session.alunosVinculados.length) {
        setSession(sessionKey, session, replyFn);
        await replyFn(`Digite um número de *1* a *${session.alunosVinculados.length}*:`);
        return;
    }

    const aluno = session.alunosVinculados[idx - 1];
    return await showFaltasDoAluno(escolaId, sessionKey, aluno, session.alunosVinculados, replyFn);
}

async function handleWaitDataChoice(session, sessionKey, text, replyFn) {
    const faltas = session.faltasDisponiveis;

    if (text === '0') {
        setSession(sessionKey, {
            ...session,
            stage: 'WAIT_MOTIVO',
            datasSelecionadas: faltas.map(f => f.data_chamada),
        }, replyFn);
        await replyFn(`Você selecionou *todas as ${faltas.length} datas*.\n\nDescreva o motivo da(s) falta(s) ou envie a foto do atestado médico:`);
        return;
    }

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
}

async function handleWaitMotivo(session, sessionKey, text, mediaFallbackText, escolaId, replyFn) {
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
        const { data: existing } = await supabase
            .from('whatsapp_justificativas')
            .select('id')
            .eq('aluno_id', studentId)
            .eq('data_falta', dataFalta)
            .in('status', ['PENDENTE', 'APROVADA'])
            .maybeSingle();

        if (existing) continue; 

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

    if (erroCount === datas.length && datas.length > 0) {
        clearSession(sessionKey);
        await replyFn("Tivemos um problema para registrar sua(s) justificativa(s). Entre em contato com a secretaria.");
        return;
    }

    console.log(`📩 [INBOUND] [${escolaId.substring(0,8)}] Justificativa(s) recebida(s) para ${nomeAluno} — ${datas.length} data(s)`);

    if (session.alunosVinculados && session.alunosVinculados.length > 1) {
        setSession(sessionKey, {
            ...session,
            stage: 'WAIT_OUTRO_ALUNO',
        }, replyFn);
        const outroMsg = `✅ *Justificativa(s) registrada(s) com sucesso!*\n\nAluno(a): *${nomeAluno}*\nDatas: ${datas.length} falta(s) justificada(s)\n\nA coordenação irá analisar e retornar em breve.\n\nDeseja justificar falta de *outro aluno*?`;
        const btnSent = await sendSimNaoButtons(replyFn, outroMsg);
        if (!btnSent) await replyFn(outroMsg + ' Responda *S* (Sim) ou *N* (Não):');
    } else {
        setSession(sessionKey, {
            ...session,
            stage: 'WAIT_OUTRO_ALUNO',
        }, replyFn);
        await replyFn(`✅ *Justificativa(s) registrada(s) com sucesso!*\n\nAluno(a): *${nomeAluno}*\nDatas: ${datas.length} falta(s) justificada(s)\n\nA coordenação irá analisar e retornar em breve.\n\n_(Nota: Esta linha do WhatsApp envia apenas notificações escolares automáticas)._`);
        clearSession(sessionKey);
    }
}

async function handleWaitOutroAluno(session, sessionKey, textLower, escolaId, replyFn) {
    if (textLower === 's' || textLower === 'sim') {
        return await showAlunoSelection(escolaId, sessionKey, session.alunosVinculados, replyFn);
    }
    if (textLower === 'n' || textLower === 'não' || textLower === 'nao') {
        clearSession(sessionKey);
        await replyFn("Ok! Se precisar, envie uma nova mensagem a qualquer momento. Até logo! 👋");
        return;
    }
    setSession(sessionKey, session, replyFn);
    await replyFn("Responda apenas com *S* (Sim) ou *N* (Não).");
}

module.exports = {
    startJustificativaFlow,
    handleWaitAlunoChoice,
    handleWaitDataChoice,
    handleWaitMotivo,
    handleWaitOutroAluno
};
