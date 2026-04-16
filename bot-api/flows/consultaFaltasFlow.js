const { supabase } = require('../supabase');
const { setSession, clearSession } = require('../utils/sessionManager');

async function startConsultaFaltasFlow(escolaId, sessionKey, phoneCom9, phoneSem9, replyFn) {
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

    if (validStudents.length === 0 && needsParentRegistration) {
        setSession(sessionKey, { stage: 'WAIT_CAD_ESTUDANTE_TEL_RESP', isEstudante: true, escolaId, phoneCom9, phoneSem9 }, replyFn);
        await replyFn("👨‍🎓 Olá! Vimos que você está acessando como Estudante.\n\nPara consultar faltas por aqui, as regras de segurança exigem o cadastro de um *Responsável Legal*.\n\nDigite o número de *celular com DDD* do seu responsável (Ex: 85999999999):");
        return;
    }

    let msg = `📊 *Resumo de Faltas (Geral)*\n\n`;
    
    const studentIds = validStudents.map(s => s.id);
    const { data: faltas } = await supabase
        .from('presencas')
        .select('aluno_id')
        .in('aluno_id', studentIds)
        .eq('escola_id', escolaId)
        .eq('presente', false);

    validStudents.forEach(st => {
        const absCount = (faltas || []).filter(f => f.aluno_id === st.id).length;
        const totalAulasGeral = absCount * 6;
        msg += `🎓 Aluno: *${st.nome}*\n`;
        msg += `⚠️ Faltas Registradas: *${absCount}* (inclui justificadas/não justificadas)\n`;
        msg += `❌ Total de Aulas Perdidas (aprox): *${totalAulasGeral}* aulas\n\n`;
    });

    clearSession(sessionKey);
    await replyFn(msg + `_Para detalhamento por matéria, por favor procure a escola ou acesse o Portal do Aluno._`);
}

module.exports = {
    startConsultaFaltasFlow
};
