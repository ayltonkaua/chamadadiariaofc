/**
 * POST /sendMonthlySummary
 * Send monthly absence summary to all students' responsáveis.
 *
 * N+1 fix: single batch query for all absences in the month,
 * then aggregate counts in JS.
 */

const express = require('express');
const router = express.Router();
const {
    requireConnected, getTemplates, getActiveStudentsWithPhone,
    sendAndLog, formatMessage, sanitizePhone, delay, getTodayBR,
    supabase, log, SEND_DELAY_MS,
} = require('./helpers');

router.post('/sendMonthlySummary', async (req, res) => {
    const escolaId = req.escolaId;
    const { template } = req.body;

    try {
        if (!requireConnected(escolaId, res)) return;

        const templates = await getTemplates(escolaId);
        const messageTemplate = template || templates.template_mensal;

        // Month boundaries in Brazil Timezone
        const todayBRStr = getTodayBR();
        const [yy, mm, dd] = todayBRStr.split('-');

        const firstDay = `${yy}-${mm}-01`;

        // JS Date(year, monthIndex, 0) gives the last day of the previous month.
        // Since mm is '01'-'12', parseInt(mm) acts as the NEXT month index (0-11).
        const lastDayObj = new Date(parseInt(yy, 10), parseInt(mm, 10), 0);
        const lastDay = `${yy}-${mm}-${String(lastDayObj.getDate()).padStart(2, '0')}`;

        const today = `${dd}/${mm}/${yy}`; // For message formatting

        // 1. Get all active students with phone
        const alunos = await getActiveStudentsWithPhone(escolaId);
        if (alunos.length === 0) {
            return res.json({ success: true, sent: 0, message: 'Nenhum aluno encontrado' });
        }

        const alunoIds = alunos.map(a => a.id);

        // 2. Batch: all unjustified absences this month for these students
        const { data: faltaRows, error: fErr } = await supabase
            .from('presencas')
            .select('aluno_id')
            .eq('escola_id', escolaId)
            .in('aluno_id', alunoIds)
            .eq('presente', false)
            .gte('data_chamada', firstDay)
            .lte('data_chamada', lastDay);

        if (fErr) throw fErr;

        // Aggregate
        const faltaMap = {};
        for (const r of (faltaRows || [])) {
            faltaMap[r.aluno_id] = (faltaMap[r.aluno_id] || 0) + 1;
        }

        // 3. Send to those with absences
        let sent = 0;
        let failed = 0;

        for (const aluno of alunos) {
            const faltasMes = faltaMap[aluno.id] || 0;
            if (faltasMes === 0) continue;

            const phone = sanitizePhone(aluno.telefone_responsavel);
            if (!phone) continue;

            const message = formatMessage(messageTemplate, {
                nome: aluno.nome,
                faltas: faltasMes,
                responsavel: aluno.nome_responsavel || 'Responsável',
                data: today,
            });

            const result = await sendAndLog(escolaId, aluno.id, phone, message, 'mensal');
            if (result.ok) sent++; else failed++;

            await delay(SEND_DELAY_MS);
        }

        log('INFO', escolaId, 'sendMonthlySummary', `${sent} enviados, ${failed} falhas`);
        res.json({ success: true, sent, failed, total: alunos.length });
    } catch (error) {
        log('ERROR', escolaId, 'sendMonthlySummary', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
