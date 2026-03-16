/**
 * POST /sendDailyAbsencesToGroup
 * Send a summary of today's absentees to the Busca Ativa WhatsApp group.
 *
 * N+1 fix: batch query presencas for all absent students instead of
 * one query per student. Compute consecutive absences in JS.
 */

const express = require('express');
const router = express.Router();
const { sendMessageToGroup } = require('../../whatsapp');
const {
    requireConnected, getTemplates, countConsecutiveAbsences,
    validateDate, validateGroupId, getTodayBR,
    supabase, log,
} = require('./helpers');

router.post('/sendDailyAbsencesToGroup', async (req, res) => {
    const escolaId = req.escolaId;

    // Validate date
    const rawDate = req.body.data || getTodayBR();
    const targetDate = validateDate(rawDate);
    if (!targetDate) {
        return res.status(400).json({
            success: false,
            error: `Data inválida: "${rawDate}". Use o formato YYYY-MM-DD.`,
        });
    }

    const todayBR = new Date(targetDate + 'T12:00:00').toLocaleDateString('pt-BR');

    try {
        if (!requireConnected(escolaId, res)) return;

        const templates = await getTemplates(escolaId);

        // Validate group id
        let groupId = validateGroupId(req.body.group_id) || templates.grupo_busca_ativa_id;
        if (!groupId) {
            return res.status(400).json({
                success: false,
                error: 'Nenhum grupo de Busca Ativa configurado. Configure o grupo na aba Alertas.',
            });
        }
        // Ensure group JID has the correct WhatsApp suffix for Baileys
        if (!groupId.endsWith('@g.us')) {
            // Remove lingering non-JID characters or whitespace, just in case
            groupId = groupId.trim() + '@g.us';
        }

        // 1. Find absent students
        const { data: presencasFaltosas, error } = await supabase
            .from('presencas')
            .select('aluno_id')
            .eq('escola_id', escolaId)
            .eq('data_chamada', targetDate)
            .eq('presente', false)
            .eq('falta_justificada', false);

        if (error) throw error;
        if (!presencasFaltosas || presencasFaltosas.length === 0) {
            return res.json({
                success: true,
                sent: 0,
                totalFaltosos: 0,
                criticos: 0,
                message: 'Nenhum aluno faltou hoje'
            });
        }

        const alunoIds = [...new Set(presencasFaltosas.map(p => p.aluno_id))];

        // 2. Get student names + turmas
        const { data: alunos } = await supabase
            .from('alunos')
            .select('id, nome, turma_id, telefone_responsavel')
            .in('id', alunoIds)
            .eq('situacao', 'ativo')
            .order('nome');

        if (!alunos || alunos.length === 0) {
            return res.json({
                success: true,
                sent: 0,
                totalFaltosos: 0,
                criticos: 0,
                message: 'Nenhum aluno ativo encontrado'
            });
        }

        // 3. Get turma names (batch)
        const turmaIds = [...new Set(alunos.map(a => a.turma_id).filter(Boolean))];
        const { data: turmas } = await supabase
            .from('turmas')
            .select('id, nome')
            .in('id', turmaIds);

        const turmaMap = {};
        (turmas || []).forEach(t => { turmaMap[t.id] = t.nome; });

        // 4. Batch: recent presencas for all absent students (N+1 fix)
        const activeAlunoIds = alunos.map(a => a.id);
        const { data: allPresencas } = await supabase
            .from('presencas')
            .select('aluno_id, presente, falta_justificada')
            .eq('escola_id', escolaId)
            .in('aluno_id', activeAlunoIds)
            .order('data_chamada', { ascending: false });

        // Group by aluno_id (keep first 10)
        const presencasByAluno = {};
        for (const p of (allPresencas || [])) {
            if (!presencasByAluno[p.aluno_id]) presencasByAluno[p.aluno_id] = [];
            if (presencasByAluno[p.aluno_id].length < 10) {
                presencasByAluno[p.aluno_id].push(p);
            }
        }

        // 5. Build details
        const alunosComDetalhes = alunos.map(aluno => {
            const presencas = presencasByAluno[aluno.id] || [];
            const consecutivas = countConsecutiveAbsences(presencas);
            return {
                nome: aluno.nome,
                turma: turmaMap[aluno.turma_id] || 'Sem turma',
                consecutivas,
                temTelefone: !!aluno.telefone_responsavel,
            };
        });

        // 6. Build group message
        let message = `*ALERTA DE FALTAS — ${todayBR}*\n\n`;
        message += `Total de alunos faltosos: *${alunosComDetalhes.length}*\n\n`;

        // Group by turma
        const porTurma = {};
        for (const a of alunosComDetalhes) {
            if (!porTurma[a.turma]) porTurma[a.turma] = [];
            porTurma[a.turma].push(a);
        }

        for (const [turma, lista] of Object.entries(porTurma)) {
            message += `*${turma}* (${lista.length}):\n`;
            for (const a of lista) {
                let line = `  - ${a.nome}`;
                if (a.consecutivas >= 3) {
                    line += ` _(${a.consecutivas} faltas seguidas)_`;
                }
                if (!a.temTelefone) {
                    line += ` _(sem telefone)_`;
                }
                message += line + '\n';
            }
            message += '\n';
        }

        // Highlight critical cases
        const criticos = alunosComDetalhes.filter(a => a.consecutivas >= 3);
        if (criticos.length > 0) {
            message += `*ATENÇÃO — ${criticos.length} aluno(s) com 3+ faltas consecutivas:*\n`;
            for (const a of criticos) {
                message += `  - *${a.nome}* (${a.turma}) — ${a.consecutivas} faltas seguidas\n`;
            }
            message += '\nMonitores, favor entrar em contato com os responsáveis destes alunos.\n';
        }

        // 7. Send to group
        await sendMessageToGroup(escolaId, groupId, message);

        // Log
        await supabase.from('whatsapp_logs').insert({
            escola_id: escolaId,
            telefone: groupId,
            mensagem: message,
            tipo: 'busca_ativa_grupo',
            status: 'enviado',
        });

        log('INFO', escolaId, 'sendDailyAbsencesToGroup', `${alunosComDetalhes.length} faltosos, ${criticos.length} críticos`);
        res.json({
            success: true,
            sent: 1,
            totalFaltosos: alunosComDetalhes.length,
            criticos: criticos.length,
            message: `Resumo enviado ao grupo com ${alunosComDetalhes.length} faltosos`,
        });
    } catch (error) {
        log('ERROR', escolaId, 'sendDailyAbsencesToGroup', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
