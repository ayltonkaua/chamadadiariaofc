const { supabase } = require('../supabase');
const { setSession, clearSession } = require('../utils/sessionManager');
const { generateSmartAulaResponse } = require('../utils/aiClassifier');

/**
 * Consulta "Hoje tem aula?" Flow
 * 
 * 1. Verifica flag tem_aula_hoje no config da escola
 * 2. Busca alunos vinculados ao telefone
 * 3. Verifica se o pai está no grupo da turma
 * 4. Se não está → envia link de convite
 */

async function startConsultaAulaFlow(escolaId, sessionKey, phoneCom9, phoneSem9, sock, replyFn, userText = '') {
    try {
        // 1. Buscar config da escola
        const { data: config } = await supabase
            .from('whatsapp_bot_config')
            .select('tem_aula_hoje, motivo_sem_aula, grupos_favoritos')
            .eq('escola_id', escolaId)
            .maybeSingle();

        const temAula = config?.tem_aula_hoje !== false; // default true
        const motivoSemAula = config?.motivo_sem_aula || 'Sem aula hoje.';
        const gruposFavoritos = config?.grupos_favoritos || [];

        // 2. Buscar alunos vinculados
        const { data: students } = await supabase
            .from('alunos')
            .select('id, nome, turma_id')
            .eq('escola_id', escolaId)
            .eq('situacao', 'ativo')
            .or(`telefone_responsavel.in.(${phoneCom9},${phoneSem9}),telefone_responsavel_2.in.(${phoneCom9},${phoneSem9})`);

        let respostaBase = temAula
            ? '✅ *Sim, hoje tem aula normalmente!* 📚'
            : `❌ *Hoje NÃO tem aula.*\n📋 Motivo: ${motivoSemAula}`;

        if (userText && userText.trim().length > 2) {
            const smartResponse = await generateSmartAulaResponse(userText, temAula, motivoSemAula);
            if (smartResponse) respostaBase = smartResponse;
        }

        if (!students || students.length === 0) {
            // Telefone não cadastrado
            await replyFn(`${respostaBase}\n\n_Obs: Seu número não está vinculado a nenhum aluno. Envie "oi" para se cadastrar._`);
            clearSession(sessionKey);
            return;
        }

        // 3. Buscar turmas dos alunos
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

        // 4. Resposta base sobre aula
        let msg = `${respostaBase}\n\n`;

        // 5. Verificar participação nos grupos
        let allGroups = null;
        try {
            allGroups = await sock.groupFetchAllParticipating();
        } catch (e) {
            console.warn(`⚠️ [CONSULTA-AULA] Erro ao buscar grupos:`, e.message);
        }

        if (allGroups && gruposFavoritos.length > 0) {
            // Mapear turma → grupo favorito (fuzzy match por nome)
            const alunosInfo = [];
            
            for (const student of students) {
                const turmaNome = turmaMap[student.turma_id] || '';
                
                // Tentar achar grupo favorito que corresponde à turma
                const grupoMatch = findGroupForTurma(turmaNome, gruposFavoritos);
                
                let isInGroup = false;
                let groupJid = null;
                let groupName = null;

                if (grupoMatch) {
                    groupJid = grupoMatch.id;
                    groupName = grupoMatch.name;
                    
                    // Checar se o telefone do pai está no grupo
                    const groupData = allGroups[groupJid];
                    if (groupData?.participants) {
                        isInGroup = groupData.participants.some(p => {
                            const pPhone = (p.id || '').split('@')[0].replace(/\D/g, '');
                            return pPhone === phoneCom9 || pPhone === phoneSem9;
                        });
                    }
                }

                alunosInfo.push({
                    nome: student.nome,
                    turma: turmaNome,
                    isInGroup,
                    groupJid,
                    groupName,
                });
            }

            // Montar resposta por aluno
            let needsGroupLink = false;
            const groupsToInvite = [];

            for (const info of alunosInfo) {
                if (info.isInGroup) {
                    msg += `👤 *${info.nome}* (${info.turma})\n📱 Você está no grupo: _${info.groupName}_\n✅ Avisos serão enviados lá!\n\n`;
                } else if (info.groupJid) {
                    msg += `👤 *${info.nome}* (${info.turma})\n⚠️ Você *NÃO* está no grupo da turma!\n`;
                    needsGroupLink = true;
                    if (!groupsToInvite.find(g => g.jid === info.groupJid)) {
                        groupsToInvite.push({ jid: info.groupJid, name: info.groupName, turma: info.turma });
                    }
                } else {
                    msg += `👤 *${info.nome}* (${info.turma})\nℹ️ Grupo da turma não configurado.\n\n`;
                }
            }

            // Gerar e enviar links de convite
            if (needsGroupLink && groupsToInvite.length > 0) {
                msg += `\n📲 *Entre no(s) grupo(s) da turma:*\n\n`;
                for (const group of groupsToInvite) {
                    try {
                        const code = await sock.groupInviteCode(group.jid);
                        const link = `https://chat.whatsapp.com/${code}`;
                        msg += `📱 *${group.name}*\n${link}\n\n`;
                    } catch (e) {
                        console.warn(`⚠️ [CONSULTA-AULA] Não consegui gerar link para ${group.name}:`, e.message);
                        msg += `📱 *${group.name}*\n_Solicite o link na secretaria._\n\n`;
                    }
                }
            }
        } else {
            // Sem dados de grupos — resposta simples
            const alunoNomes = students.map(s => s.nome).join(', ');
            msg += `Aluno(s): ${alunoNomes}\n\n`;
            msg += temAula
                ? '_Quando não houver aula, a escola envia aviso nos grupos de turma._'
                : '_Fique atento(a) aos avisos nos grupos de turma._';
        }

        await replyFn(msg.trim());
        clearSession(sessionKey);

    } catch (err) {
        console.error(`❌ [CONSULTA-AULA] Erro:`, err.message);
        await replyFn('Ocorreu um erro ao verificar. Tente novamente mais tarde.');
        clearSession(sessionKey);
    }
}

/**
 * Fuzzy match: encontra o grupo favorito que melhor corresponde ao nome da turma.
 * Ex: turma "1ºA MANHÃ" → grupo "1ºA - Manhã" → match!
 */
function findGroupForTurma(turmaNome, gruposFavoritos) {
    if (!turmaNome || !gruposFavoritos || gruposFavoritos.length === 0) return null;
    
    const normalize = (str) => str.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');
    
    const turmaNorm = normalize(turmaNome);
    
    // Match exato ou parcial
    let bestMatch = null;
    let bestScore = 0;

    for (const grupo of gruposFavoritos) {
        const grupoNorm = normalize(grupo.name || '');
        
        // Exact substring match
        if (grupoNorm.includes(turmaNorm) || turmaNorm.includes(grupoNorm)) {
            return grupo;
        }

        // Partial match — check how many characters match
        let score = 0;
        for (let i = 0; i < Math.min(turmaNorm.length, grupoNorm.length); i++) {
            if (turmaNorm[i] === grupoNorm[i]) score++;
        }
        const matchPercent = score / Math.max(turmaNorm.length, grupoNorm.length);
        if (matchPercent > bestScore && matchPercent > 0.6) {
            bestScore = matchPercent;
            bestMatch = grupo;
        }
    }

    return bestMatch;
}

module.exports = {
    startConsultaAulaFlow,
};
