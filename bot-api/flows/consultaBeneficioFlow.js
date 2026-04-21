const { supabase } = require('../supabase');
const { setSession, clearSession } = require('../utils/sessionManager');
const { formatDateBR } = require('../utils/dateFormatter');

/**
 * Consulta de Benefícios Flow (Meu Tênis, etc)
 * 
 * Etapas:
 * 1. Busca alunos vinculados ao telefone
 * 2. Busca registros na tabela `programas_registros` para a matrícula do aluno
 * 3. Se achar, exibe os dados mascarados
 * 4. Pede o CPF para desmascarar (segurança LGPD)
 * 5. Se o CPF bater, exibe dados completos
 */

// ═════════════════════════════════════════════
// Helpers de Mascaramento
// ═════════════════════════════════════════════

function maskCPF(cpf) {
    if (!cpf) return 'Não informado';
    const clean = String(cpf).replace(/\D/g, '');
    if (clean.length !== 11) return String(cpf);
    return `***.${clean.substring(3, 6)}.***-${clean.substring(9)}`;
}

function maskConta(conta) {
    if (!conta) return 'Não informada';
    const strConta = String(conta);
    if (strConta.length <= 4) return '***' + strConta;
    return '***' + strConta.slice(-4);
}

function maskAgencia(agencia) {
    if (!agencia) return 'Não informada';
    const strAg = String(agencia);
    if (strAg.length <= 2) return strAg + '**';
    return strAg.substring(0, 2) + '**';
}

function formatCurrency(value) {
    if (!value || isNaN(Number(value))) return 'R$ 0,00';
    return `R$ ${parseFloat(value).toFixed(2).replace('.', ',')}`;
}

// ═════════════════════════════════════════════
// Flow Principal
// ═════════════════════════════════════════════

async function startConsultaBeneficioFlow(escolaId, sessionKey, phoneCom9, phoneSem9, replyFn) {
    try {
        // 1. Buscar alunos vinculados
        const { data: students } = await supabase
            .from('alunos')
            .select('id, nome, matricula')
            .eq('escola_id', escolaId)
            .eq('situacao', 'ativo')
            .or(`telefone_responsavel.in.(${phoneCom9},${phoneSem9}),telefone_responsavel_2.in.(${phoneCom9},${phoneSem9})`);

        if (!students || students.length === 0) {
            await replyFn("❌ Você não possui alunos vinculados ao seu número de telefone.\n\nPor favor, envie '*oi*' para realizar o cadastro e tentar novamente.");
            clearSession(sessionKey);
            return;
        }

        // 2. Buscar registros nos programas sociais
        const matriculas = students.map(s => s.matricula).filter(Boolean);
        if (matriculas.length === 0) {
            await replyFn("❌ Aluno(s) sem matrícula registrada.\n\nProcure a secretaria para regularizar o cadastro.");
            clearSession(sessionKey);
            return;
        }

        const { data: rawRegistros, error } = await supabase
            .from('programas_registros')
            .select(`
                id, dados_pagamento, matricula_beneficiario,
                programas_sociais (nome, ativo)
            `)
            .in('matricula_beneficiario', matriculas);

        if (error) {
            console.error(`❌ [CONSULTA-BENEFICIO] Erro ao buscar registros:`, error.message);
            await replyFn("Ocorreu um erro ao consultar os benefícios. Tente novamente mais tarde.");
            clearSession(sessionKey);
            return;
        }

        const registros = (rawRegistros || []).filter(r => r.programas_sociais && r.programas_sociais.ativo);

        if (!registros || registros.length === 0) {
            await replyFn(`📋 *Consulta de Benefícios*\n\nNenhum benefício ou pagamento foi encontrado para a(s) matrícula(s) vinculada(s) ao seu número.\n\nSe tiver dúvidas, procure a secretaria da escola.`);
            clearSession(sessionKey);
            return;
        }

        // 3. Formatar saída (Mascarada)
        let msg = `📋 *Consulta de Benefícios* — *Dados Parciais*\n\n`;
        
        // Mapear registros para os alunos correspondentes para controle na sessão
        const validRegistros = [];

        for (const reg of registros) {
            const student = students.find(s => s.matricula === reg.matricula_beneficiario);
            const dados = reg.dados_pagamento || {};
            
            validRegistros.push({
                ...reg,
                alunoNome: student?.nome || 'Desconhecido',
            });

            msg += `👤 *Aluno(a):* ${student?.nome || 'Desconhecido'}\n`;
            msg += `💰 *Benefício:* ${reg.programas_sociais.nome}\n`;
            msg += `📅 *Pagamento:* ${dados.data_pagamento ? formatDateBR(dados.data_pagamento) : 'Data não informada'}\n`;
            msg += `💵 *Valor:* ${formatCurrency(dados.valor)}\n`;
            msg += `🔒 *Responsável (CPF):* ${maskCPF(dados.cpf_responsavel)}\n`;
            msg += `🏦 *Conta:* Ag: ${maskAgencia(dados.agencia)} | Cc: ${maskConta(dados.conta)}\n`;
            msg += `\n──────────────\n\n`;
        }

        msg += `🔒 _Para sua segurança, alguns dados estão ocultos._\n\n`;
        msg += `Para acessar os **dados completos**, digite o **CPF do responsável legal**:\n_(Use apenas números ou no formato 123.456.789-00)_`;

        // Coloca o fluxo em modo de escuta para o CPF
        setSession(sessionKey, {
            stage: 'WAIT_BENEFICIO_CPF',
            escolaId,
            registros: validRegistros
        }, replyFn);

        await replyFn(msg);

    } catch (err) {
        console.error(`❌ [CONSULTA-BENEFICIO] Erro:`, err.message);
        await replyFn('Ocorreu um erro ao verificar. Tente novamente mais tarde.');
        clearSession(sessionKey);
    }
}

async function handleWaitBeneficioCpf(session, sessionKey, text, replyFn) {
    const inputClean = text.replace(/\D/g, '');

    if (inputClean.length !== 11) {
        await replyFn('❌ *CPF inválido.*\n\nO CPF deve conter 11 números.\nPor favor, digite o CPF novamente ou envie *"cancelar"* para sair.');
        setSession(sessionKey, session, replyFn); // Manter o stage
        return;
    }

    const { registros } = session;
    let authSuccess = false;
    let msg = `🔓 *Consulta de Benefícios* — *Dados Completos*\n\n`;

    for (const reg of registros) {
        const dados = reg.dados_pagamento || {};
        const storedCpfClean = String(dados.cpf_responsavel || '').replace(/\D/g, '');

        if (inputClean === storedCpfClean) {
            authSuccess = true;
            msg += `╭━━━━━━━━━━━━━━━━━━━\n`;
            msg += `┃ 🎟️ *COMPROVANTE DE BENEFÍCIO*\n`;
            msg += `╰━━━━━━━━━━━━━━━━━━━\n\n`;
            msg += `👤 *Beneficiário:* ${reg.alunoNome}\n`;
            msg += `📦 *Programa:* ${reg.programas_sociais.nome}\n`;
            msg += `📅 *Data do Crédito:* ${dados.data_pagamento ? formatDateBR(dados.data_pagamento) : 'Pendente/Não informada'}\n`;
            msg += `💵 *Valor Recebido:* ${formatCurrency(dados.valor)}\n\n`;
            msg += `*🏦 DADOS BANCÁRIOS*\n`;
            msg += `├ *Banco:* ${dados.banco || 'N/A'}\n`;
            msg += `├ *Agência:* ${dados.agencia || 'N/A'}\n`;
            msg += `├ *Conta:* ${dados.conta || 'N/A'}\n`;
            msg += `╰ *Titular:* ${dados.nome_responsavel || 'N/A'} (CPF: ${dados.cpf_responsavel})\n`;
            msg += `\n─────────────────────\n\n`;
        }
    }

    if (authSuccess) {
        msg += `⚠️ Se algum dado estiver incorreto (ex: conta diferente), ou você não o reconheça,\nbasta me responder com _"não conheço essa conta"_ ou _"corrigir dados"_ que abrirei um chamado pra você na secretaria.`;
        await replyFn(msg);
        clearSession(sessionKey); // Fluxo finalizado com sucesso
    } else {
        await replyFn('❌ *CPF não corresponde* a nenhum dos responsáveis registrados para estes benefícios.\n\nTente novamente com o CPF correto ou envie *"cancelar"* para sair do fluxo de consulta.');
        setSession(sessionKey, session, replyFn); // Pode tentar dnv
    }
}

module.exports = {
    startConsultaBeneficioFlow,
    handleWaitBeneficioCpf
};
