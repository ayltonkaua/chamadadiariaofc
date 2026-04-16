const { supabase } = require('../supabase');
const { setSession, clearSession } = require('../utils/sessionManager');
const { formatPhoneDisplay } = require('../utils/phoneNormalizer');

async function handleWaitQuerCadastro(session, sessionKey, textLower, replyFn) {
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
}

async function handleWaitCadTipoUsuario(session, sessionKey, text, replyFn) {
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

async function handleWaitCadEstudanteTelResp(session, sessionKey, text, replyFn) {
    let cleanTel = text.replace(/\D/g, '');
    if (cleanTel.length < 10) {
        setSession(sessionKey, session, replyFn);
        await replyFn("⚠️ Telefone inválido. Por favor, digite o celular do responsável COM DDD (ex: 85999999999):");
        return;
    }
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
}

async function handleWaitCadNomeAluno(session, sessionKey, text, escolaId, replyFn) {
    if (text.length < 3) {
        setSession(sessionKey, session, replyFn);
        await replyFn("O nome precisa ter pelo menos 3 caracteres. Tente novamente:");
        return;
    }

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
}

async function handleWaitCadConfirmaAluno(session, sessionKey, text, textLower, escolaId, replyFn) {
    if (text === '0') {
        clearSession(sessionKey);
        await replyFn("Cadastro cancelado. Se precisar, envie uma nova mensagem. 👋");
        return;
    }

    let alunoSelecionado = null;

    if (session.alunoEncontrado) {
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
}

async function handleWaitCadNomeResp(session, sessionKey, text, replyFn) {
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
}

async function handleWaitCadConfirmaTel(session, sessionKey, textLower, replyFn) {
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
}

async function handleWaitCadResumo(session, sessionKey, textLower, escolaId, replyFn) {
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
        console.error(`❌ [INBOUND] [${escolaId.substring(0,8)}] Erro gravando pré-cadastro:`, insertError.message);
        await replyFn("Ocorreu um erro ao registrar seu cadastro. Tente novamente mais tarde ou procure a secretaria.");
        return;
    }

    console.log(`📩 [INBOUND] [${escolaId.substring(0,8)}] Pré-cadastro criado: ${session.nomeResponsavel} → ${session.alunoSelecionado.nome}`);
    await replyFn("✅ *Cadastro enviado com sucesso!*\n\nA secretaria da escola irá analisar e confirmar seu cadastro. Após a aprovação, você poderá utilizar todos os recursos do bot, incluindo justificativas de faltas.\n\n_Você será notificado quando o cadastro for aprovado._ 📋");
}

module.exports = {
    handleWaitQuerCadastro,
    handleWaitCadTipoUsuario,
    handleWaitCadEstudanteTelResp,
    handleWaitCadNomeAluno,
    handleWaitCadConfirmaAluno,
    handleWaitCadNomeResp,
    handleWaitCadConfirmaTel,
    handleWaitCadResumo
};
