/**
 * Alert Routes
 * 
 * POST /sendRiskAlert         — Send alert to at-risk students
 * POST /sendConsecutiveAlert   — Send alert for 2+ consecutive absences
 * POST /sendMonthlySummary     — Send monthly absence summary
 */

const express = require('express');
const router = express.Router();
const { sendMessage, getStatus } = require('../whatsapp');
const { supabase } = require('../supabase');
const { formatMessage, sanitizePhone, delay } = require('../utils/formatMessage');

const SEND_DELAY_MS = 4000; // 4 seconds between sends

/**
 * Get saved templates for an escola (or use defaults)
 */
async function getTemplates(escolaId) {
    const { data } = await supabase
        .from('whatsapp_bot_config')
        .select('*')
        .eq('escola_id', escolaId)
        .single();

    return {
        template_risco: data?.template_risco || 'Olá {responsavel}, o(a) aluno(a) {nome} está em situação de risco com {faltas} faltas. Entre em contato com a escola. Data: {data}',
        template_consecutiva: data?.template_consecutiva || 'Olá {responsavel}, o(a) aluno(a) {nome} possui {faltas} faltas consecutivas. Data: {data}',
        template_mensal: data?.template_mensal || 'Olá {responsavel}, resumo mensal de {nome}: {faltas} faltas no mês. Data: {data}',
    };
}

/**
 * POST /sendRiskAlert
 * Send alerts to students with high absence rate (>30%)
 */
router.post('/sendRiskAlert', async (req, res) => {
    const escolaId = req.escolaId;
    const { template } = req.body; // Optional custom template

    try {
        const status = getStatus(escolaId);
        if (!status.connected) {
            return res.status(400).json({ success: false, error: 'WhatsApp não conectado' });
        }

        const templates = await getTemplates(escolaId);
        const messageTemplate = template || templates.template_risco;

        // Find at-risk students: those with > 30% absences
        const { data: alunos, error } = await supabase
            .from('alunos')
            .select('id, nome, nome_responsavel, telefone_responsavel, matricula')
            .eq('escola_id', escolaId)
            .eq('situacao', 'ativo')
            .not('telefone_responsavel', 'is', null);

        if (error) throw error;
        if (!alunos || alunos.length === 0) {
            return res.json({ success: true, sent: 0, message: 'Nenhum aluno encontrado' });
        }

        let sent = 0;
        let failed = 0;
        const today = new Date().toLocaleDateString('pt-BR');

        for (const aluno of alunos) {
            // Count total and absences
            const { count: totalAulas } = await supabase
                .from('presencas')
                .select('id', { count: 'exact', head: true })
                .eq('aluno_id', aluno.id)
                .eq('escola_id', escolaId);

            const { count: totalFaltas } = await supabase
                .from('presencas')
                .select('id', { count: 'exact', head: true })
                .eq('aluno_id', aluno.id)
                .eq('escola_id', escolaId)
                .eq('presente', false)
                .eq('falta_justificada', false);

            const rate = totalAulas > 0 ? (totalFaltas / totalAulas) * 100 : 0;

            // Only send if absence rate > 30%
            if (rate <= 30 || totalFaltas === 0) continue;

            const phone = sanitizePhone(aluno.telefone_responsavel);
            if (!phone) continue;

            const message = formatMessage(messageTemplate, {
                nome: aluno.nome,
                faltas: totalFaltas,
                responsavel: aluno.nome_responsavel || 'Responsável',
                data: today,
            });

            try {
                await sendMessage(escolaId, phone, message);
                await supabase.from('whatsapp_logs').insert({
                    escola_id: escolaId, aluno_id: aluno.id, telefone: phone,
                    mensagem: message, tipo: 'risco', status: 'enviado',
                });
                sent++;
            } catch (err) {
                await supabase.from('whatsapp_logs').insert({
                    escola_id: escolaId, aluno_id: aluno.id, telefone: phone,
                    mensagem: message, tipo: 'risco', status: 'falha', erro: err.message,
                });
                failed++;
            }

            await delay(SEND_DELAY_MS);
        }

        res.json({ success: true, sent, failed, total: alunos.length });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /sendConsecutiveAlert
 * Send alerts to students with 2+ consecutive absences
 */
router.post('/sendConsecutiveAlert', async (req, res) => {
    const escolaId = req.escolaId;
    const { template } = req.body;

    try {
        const status = getStatus(escolaId);
        if (!status.connected) {
            return res.status(400).json({ success: false, error: 'WhatsApp não conectado' });
        }

        const templates = await getTemplates(escolaId);
        const messageTemplate = template || templates.template_consecutiva;

        // Find students with 2+ consecutive recent absences
        // Strategy: get last 5 attendance records per student, check for 2+ consecutive faltas
        const { data: alunos, error } = await supabase
            .from('alunos')
            .select('id, nome, nome_responsavel, telefone_responsavel')
            .eq('escola_id', escolaId)
            .eq('situacao', 'ativo')
            .not('telefone_responsavel', 'is', null);

        if (error) throw error;
        if (!alunos || alunos.length === 0) {
            return res.json({ success: true, sent: 0, message: 'Nenhum aluno encontrado' });
        }

        let sent = 0;
        let failed = 0;
        const today = new Date().toLocaleDateString('pt-BR');

        for (const aluno of alunos) {
            // Get last 5 attendance records ordered by date desc
            const { data: presencas } = await supabase
                .from('presencas')
                .select('presente, data_chamada, falta_justificada')
                .eq('aluno_id', aluno.id)
                .eq('escola_id', escolaId)
                .order('data_chamada', { ascending: false })
                .limit(5);

            if (!presencas || presencas.length < 2) continue;

            // Count consecutive absences from the most recent
            let consecutivas = 0;
            for (const p of presencas) {
                if (!p.presente && !p.falta_justificada) {
                    consecutivas++;
                } else {
                    break;
                }
            }

            if (consecutivas < 2) continue;

            const phone = sanitizePhone(aluno.telefone_responsavel);
            if (!phone) continue;

            const message = formatMessage(messageTemplate, {
                nome: aluno.nome,
                faltas: consecutivas,
                responsavel: aluno.nome_responsavel || 'Responsável',
                data: today,
            });

            try {
                await sendMessage(escolaId, phone, message);
                await supabase.from('whatsapp_logs').insert({
                    escola_id: escolaId, aluno_id: aluno.id, telefone: phone,
                    mensagem: message, tipo: 'consecutiva', status: 'enviado',
                });
                sent++;
            } catch (err) {
                await supabase.from('whatsapp_logs').insert({
                    escola_id: escolaId, aluno_id: aluno.id, telefone: phone,
                    mensagem: message, tipo: 'consecutiva', status: 'falha', erro: err.message,
                });
                failed++;
            }

            await delay(SEND_DELAY_MS);
        }

        res.json({ success: true, sent, failed, total: alunos.length });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /sendMonthlySummary
 * Send monthly absence summary to all students' responsáveis
 */
router.post('/sendMonthlySummary', async (req, res) => {
    const escolaId = req.escolaId;
    const { template } = req.body;

    try {
        const status = getStatus(escolaId);
        if (!status.connected) {
            return res.status(400).json({ success: false, error: 'WhatsApp não conectado' });
        }

        const templates = await getTemplates(escolaId);
        const messageTemplate = template || templates.template_mensal;

        // Get current month boundaries
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        const today = now.toLocaleDateString('pt-BR');

        const { data: alunos, error } = await supabase
            .from('alunos')
            .select('id, nome, nome_responsavel, telefone_responsavel')
            .eq('escola_id', escolaId)
            .eq('situacao', 'ativo')
            .not('telefone_responsavel', 'is', null);

        if (error) throw error;
        if (!alunos || alunos.length === 0) {
            return res.json({ success: true, sent: 0, message: 'Nenhum aluno encontrado' });
        }

        let sent = 0;
        let failed = 0;

        for (const aluno of alunos) {
            // Count absences this month
            const { count: faltasMes } = await supabase
                .from('presencas')
                .select('id', { count: 'exact', head: true })
                .eq('aluno_id', aluno.id)
                .eq('escola_id', escolaId)
                .eq('presente', false)
                .gte('data_chamada', firstDay)
                .lte('data_chamada', lastDay);

            // Only send if there are absences
            if (!faltasMes || faltasMes === 0) continue;

            const phone = sanitizePhone(aluno.telefone_responsavel);
            if (!phone) continue;

            const message = formatMessage(messageTemplate, {
                nome: aluno.nome,
                faltas: faltasMes,
                responsavel: aluno.nome_responsavel || 'Responsável',
                data: today,
            });

            try {
                await sendMessage(escolaId, phone, message);
                await supabase.from('whatsapp_logs').insert({
                    escola_id: escolaId, aluno_id: aluno.id, telefone: phone,
                    mensagem: message, tipo: 'mensal', status: 'enviado',
                });
                sent++;
            } catch (err) {
                await supabase.from('whatsapp_logs').insert({
                    escola_id: escolaId, aluno_id: aluno.id, telefone: phone,
                    mensagem: message, tipo: 'mensal', status: 'falha', erro: err.message,
                });
                failed++;
            }

            await delay(SEND_DELAY_MS);
        }

        res.json({ success: true, sent, failed, total: alunos.length });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
