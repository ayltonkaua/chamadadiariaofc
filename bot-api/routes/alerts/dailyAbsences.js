/**
 * POST /sendDailyAbsences  — send alerts to today's absentees (queue + progress)
 * GET  /absence-progress   — poll progress
 *
 * Fixes: accentuated variable names, input validation, uses helpers.
 * Already used batch queries — no N+1 issue.
 */

const express = require('express');
const router = express.Router();
const {
    requireConnected, getTemplates, sendAndLog,
    formatMessage, sanitizePhone, delay, validateDate,
    supabase, log, SEND_DELAY_MS, getTodayBR,
} = require('./helpers');

// In-memory progress tracking (per escola)
const absenceProgress = {};

// -----------------------------------------------------------------------
// POST /sendDailyAbsences
// -----------------------------------------------------------------------

router.post('/sendDailyAbsences', async (req, res) => {
    const escolaId = req.escolaId;

    // Validate date input
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

        // Check if already running
        if (absenceProgress[escolaId]?.active) {
            return res.status(409).json({
                success: false,
                error: 'Já existe um envio em andamento. Aguarde finalizar.',
            });
        }

        const templates = await getTemplates(escolaId);

        // 1. Find students absent on target date (unjustified)
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
                success: true, sent: 0, failed: 0, total: 0,
                message: 'Nenhum aluno faltou hoje (ou todas as faltas estão justificadas)',
            });
        }

        // Deduplicate
        const alunoIds = [...new Set(presencasFaltosas.map(p => p.aluno_id))];

        // 2. Get student details
        const { data: alunos } = await supabase
            .from('alunos')
            .select('id, nome, nome_responsavel, telefone_responsavel, telefone_responsavel_2, turma_id')
            .in('id', alunoIds)
            .eq('situacao', 'ativo')
            .not('telefone_responsavel', 'is', null);

        if (!alunos || alunos.length === 0) {
            return res.json({
                success: true, sent: 0, failed: 0, total: 0,
                message: 'Alunos faltosos não possuem telefone de responsável cadastrado',
            });
        }

        // 3. Anti-spam: check who already received falta_diaria today
        const { data: jaEnviados } = await supabase
            .from('whatsapp_logs')
            .select('aluno_id')
            .eq('escola_id', escolaId)
            .eq('tipo', 'falta_diaria')
            .eq('status', 'enviado')
            .gte('created_at', targetDate + 'T00:00:00')
            .lte('created_at', targetDate + 'T23:59:59');

        const idsJaEnviados = new Set((jaEnviados || []).map(l => l.aluno_id));
        const alunosFiltrados = alunos.filter(a => !idsJaEnviados.has(a.id));

        if (alunosFiltrados.length === 0) {
            return res.json({
                success: true, sent: 0, failed: 0, total: 0,
                message: 'Todos os faltosos já foram notificados hoje',
            });
        }

        // 4. Initialize progress
        absenceProgress[escolaId] = {
            active: true,
            label: `Faltosos ${todayBR}`,
            total: alunosFiltrados.length,
            sent: 0,
            failed: 0,
            currentName: '',
            currentPhone: '',
            startedAt: Date.now(),
            delayMs: SEND_DELAY_MS,
        };

        // Respond immediately — process in background
        res.json({
            success: true,
            message: `Iniciando envio para ${alunosFiltrados.length} faltosos`,
            total: alunosFiltrados.length,
        });

        // 5. Background queue
        let sent = 0;
        let failed = 0;

        for (const aluno of alunosFiltrados) {
            const phone = sanitizePhone(aluno.telefone_responsavel);
            if (!phone) continue;

            absenceProgress[escolaId].currentName = aluno.nome;
            absenceProgress[escolaId].currentPhone = phone;

            const message = formatMessage(templates.template_falta_diaria, {
                nome: aluno.nome,
                faltas: 1,
                responsavel: aluno.nome_responsavel || 'Responsável',
                data: todayBR,
            });

            const result = await sendAndLog(escolaId, aluno.id, phone, message, 'falta_diaria');
            if (result.ok) sent++; else failed++;

            absenceProgress[escolaId].sent = sent;
            absenceProgress[escolaId].failed = failed;

            await delay(SEND_DELAY_MS);
        }

        // Done
        absenceProgress[escolaId].active = false;
        absenceProgress[escolaId].currentName = '';
        absenceProgress[escolaId].currentPhone = '';
        log('INFO', escolaId, 'sendDailyAbsences', `${sent} enviados, ${failed} falhas`);
        setTimeout(() => { delete absenceProgress[escolaId]; }, 30000);
    } catch (error) {
        log('ERROR', escolaId, 'sendDailyAbsences', error.message);
        if (absenceProgress[escolaId]) absenceProgress[escolaId].active = false;
        if (!res.headersSent) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
});

// -----------------------------------------------------------------------
// GET /absence-progress
// -----------------------------------------------------------------------

router.get('/absence-progress', (req, res) => {
    const escolaId = req.escolaId;
    const progress = absenceProgress[escolaId];

    if (!progress) {
        return res.json({ success: true, data: null });
    }

    const elapsed = Date.now() - progress.startedAt;
    const processed = progress.sent + progress.failed;
    const remaining = progress.total - processed;
    const estimatedRemaining = remaining * progress.delayMs;

    res.json({
        success: true,
        data: {
            active: progress.active,
            label: progress.label,
            total: progress.total,
            sent: progress.sent,
            failed: progress.failed,
            processed,
            remaining,
            currentName: progress.currentName,
            currentPhone: progress.currentPhone,
            elapsedMs: elapsed,
            estimatedRemainingMs: estimatedRemaining,
            percentComplete: progress.total > 0
                ? Math.round((processed / progress.total) * 100)
                : 0,
        },
    });
});

module.exports = router;
