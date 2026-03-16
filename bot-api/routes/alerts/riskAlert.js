/**
 * POST /sendRiskAlert
 * Send alerts to students with high absence rate (>30%).
 *
 * N+1 fix: uses a single batch query to compute absence rates
 * instead of 2 queries per student.
 */

const express = require('express');
const router = express.Router();
const {
    requireConnected, getTemplates, getActiveStudentsWithPhone,
    sendAndLog, formatMessage, sanitizePhone, delay, getTodayBR,
    supabase, log, SEND_DELAY_MS,
} = require('./helpers');

router.post('/sendRiskAlert', async (req, res) => {
    const escolaId = req.escolaId;
    const { template } = req.body;

    try {
        if (!requireConnected(escolaId, res)) return;

        const templates = await getTemplates(escolaId);
        const messageTemplate = template || templates.template_risco;

        // 1. Get all active students with phone
        const alunos = await getActiveStudentsWithPhone(escolaId, 'matricula');
        if (alunos.length === 0) {
            return res.json({ success: true, sent: 0, message: 'Nenhum aluno encontrado' });
        }

        const alunoIds = alunos.map(a => a.id);

        // 2. Batch: total presencas per student
        const { data: totalRows, error: e1 } = await supabase
            .from('presencas')
            .select('aluno_id')
            .eq('escola_id', escolaId)
            .in('aluno_id', alunoIds);

        if (e1) throw e1;

        // 3. Batch: total unjustified absences per student
        const { data: faltaRows, error: e2 } = await supabase
            .from('presencas')
            .select('aluno_id')
            .eq('escola_id', escolaId)
            .in('aluno_id', alunoIds)
            .eq('presente', false)
            .eq('falta_justificada', false);

        if (e2) throw e2;

        // Aggregate counts
        const totalMap = {};
        for (const r of (totalRows || [])) {
            totalMap[r.aluno_id] = (totalMap[r.aluno_id] || 0) + 1;
        }
        const faltaMap = {};
        for (const r of (faltaRows || [])) {
            faltaMap[r.aluno_id] = (faltaMap[r.aluno_id] || 0) + 1;
        }

        let sent = 0;
        let failed = 0;
        const todayBRStr = getTodayBR();
        const [yy, mm, dd] = todayBRStr.split('-');
        const today = `${dd}/${mm}/${yy}`;

        for (const aluno of alunos) {
            const totalAulas = totalMap[aluno.id] || 0;
            const totalFaltas = faltaMap[aluno.id] || 0;
            const rate = totalAulas > 0 ? (totalFaltas / totalAulas) * 100 : 0;

            if (rate <= 30 || totalFaltas === 0) continue;

            const phone = sanitizePhone(aluno.telefone_responsavel);
            if (!phone) continue;

            const message = formatMessage(messageTemplate, {
                nome: aluno.nome,
                faltas: totalFaltas,
                responsavel: aluno.nome_responsavel || 'Responsável',
                data: today,
            });

            const result = await sendAndLog(escolaId, aluno.id, phone, message, 'risco');
            if (result.ok) sent++; else failed++;

            await delay(SEND_DELAY_MS);
        }

        log('INFO', escolaId, 'sendRiskAlert', `${sent} enviados, ${failed} falhas`);
        res.json({ success: true, sent, failed, total: alunos.length });
    } catch (error) {
        log('ERROR', escolaId, 'sendRiskAlert', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
