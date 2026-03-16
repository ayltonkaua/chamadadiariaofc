/**
 * POST /sendEscalation
 * Send urgent message to parents of students with 3+ consecutive absences
 * who have NOT been contacted via Busca Ativa recently.
 *
 * Anti-spam: won't re-send if escalation was sent in the last 3 days.
 *
 * N+1 fix: batch query presencas, busca_ativa, and whatsapp_logs
 * for all students at once, then filter in JS.
 */

const express = require('express');
const router = express.Router();
const {
    requireConnected, getTemplates, getActiveStudentsWithPhone,
    countConsecutiveAbsences, sendAndLog,
    formatMessage, sanitizePhone, delay, getTodayBR,
    supabase, log, SEND_DELAY_MS,
} = require('./helpers');

router.post('/sendEscalation', async (req, res) => {
    const escolaId = req.escolaId;

    try {
        if (!requireConnected(escolaId, res)) return;

        const templates = await getTemplates(escolaId);

        // 1. Get all active students with phone
        const alunos = await getActiveStudentsWithPhone(escolaId);
        if (alunos.length === 0) {
            return res.json({
                success: true, sent: 0, failed: 0, total: 0,
                message: 'Nenhum aluno encontrado',
            });
        }

        const alunoIds = alunos.map(a => a.id);
        const todayBRStr = getTodayBR();
        const [yy, mm, dd] = todayBRStr.split('-');
        const today = `${dd}/${mm}/${yy}`;
        const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

        // 2. Batch: last 10 presencas for ALL students (sorted desc by date)
        const { data: allPresencas, error: pErr } = await supabase
            .from('presencas')
            .select('aluno_id, presente, falta_justificada, data_chamada')
            .eq('escola_id', escolaId)
            .in('aluno_id', alunoIds)
            .order('data_chamada', { ascending: false });

        if (pErr) throw pErr;

        // Group by aluno_id (keep only first 10 per student)
        const presencasByAluno = {};
        for (const p of (allPresencas || [])) {
            if (!presencasByAluno[p.aluno_id]) presencasByAluno[p.aluno_id] = [];
            if (presencasByAluno[p.aluno_id].length < 10) {
                presencasByAluno[p.aluno_id].push(p);
            }
        }

        // 3. Batch: recent Busca Ativa contacts (last 7 days)
        const { data: buscaAtivaRows } = await supabase
            .from('registros_contato_busca_ativa')
            .select('aluno_id')
            .in('aluno_id', alunoIds)
            .gte('created_at', sevenDaysAgo);

        const buscaAtivaSet = new Set((buscaAtivaRows || []).map(r => r.aluno_id));

        // 4. Batch: recent escalation logs (last 3 days)
        const { data: recentEscalations } = await supabase
            .from('whatsapp_logs')
            .select('aluno_id')
            .in('aluno_id', alunoIds)
            .eq('tipo', 'escalacao')
            .eq('status', 'enviado')
            .gte('created_at', threeDaysAgo);

        const recentEscalationSet = new Set((recentEscalations || []).map(r => r.aluno_id));

        // 5. Filter and send
        let sent = 0;
        let failed = 0;
        let skipped = 0;

        for (const aluno of alunos) {
            const presencas = presencasByAluno[aluno.id];
            if (!presencas || presencas.length < 3) continue;

            const consecutivas = countConsecutiveAbsences(presencas);
            if (consecutivas < 3) continue;

            // Skip if Busca Ativa already contacted
            if (buscaAtivaSet.has(aluno.id)) {
                skipped++;
                continue;
            }

            // Anti-spam: skip if escalation sent in last 3 days
            if (recentEscalationSet.has(aluno.id)) {
                skipped++;
                continue;
            }

            const phone = sanitizePhone(aluno.telefone_responsavel);
            if (!phone) continue;

            const message = formatMessage(templates.template_escalacao, {
                nome: aluno.nome,
                faltas: consecutivas,
                responsavel: aluno.nome_responsavel || 'Responsável',
                data: today,
            });

            const result = await sendAndLog(escolaId, aluno.id, phone, message, 'escalacao');
            if (result.ok) sent++; else failed++;

            await delay(SEND_DELAY_MS);
        }

        log('INFO', escolaId, 'sendEscalation', `${sent} enviados, ${failed} falhas, ${skipped} ignorados`);
        res.json({ success: true, sent, failed, skipped, total: alunos.length });
    } catch (error) {
        log('ERROR', escolaId, 'sendEscalation', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
