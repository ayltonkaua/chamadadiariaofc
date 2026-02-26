/**
 * Manual Send Routes
 * 
 * POST /sendManual   — Send individual message
 * GET  /status       — Bot connection status (per escola)
 * GET  /generate-qr  — Generate QR code (per escola)
 */

const express = require('express');
const router = express.Router();
const { sendMessage, sendMessageToGroup, getGroups, getStatus, getQR, initWhatsApp, disconnect } = require('../whatsapp');
const { supabase, validateEscola } = require('../supabase');
const { sanitizePhone } = require('../utils/formatMessage');

/**
 * GET /status
 * Returns WhatsApp connection status for the escola
 */
router.get('/status', (req, res) => {
    const escolaId = req.escolaId;
    const status = getStatus(escolaId);
    res.json({ success: true, data: status });
});

/**
 * GET /generate-qr
 * Initializes WhatsApp connection and returns QR code for the escola
 */
router.get('/generate-qr', async (req, res) => {
    const escolaId = req.escolaId;

    try {
        // Validate escola is active
        const validation = await validateEscola(escolaId);
        if (!validation.valid) {
            return res.status(403).json({ success: false, error: validation.error });
        }

        // Check if already connected
        const status = getStatus(escolaId);
        if (status.connected) {
            return res.json({
                success: true,
                data: { connected: true, phone: status.phone, qr: null },
            });
        }

        // Initialize connection (triggers QR generation)
        await initWhatsApp(escolaId);

        // Wait briefly for QR to be generated
        await new Promise(resolve => setTimeout(resolve, 3000));

        const qr = getQR(escolaId);
        const updatedStatus = getStatus(escolaId);

        res.json({
            success: true,
            data: {
                connected: updatedStatus.connected,
                phone: updatedStatus.phone,
                qr: qr, // data:image/png;base64,...
            },
        });
    } catch (error) {
        console.error('QR generation error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /sendManual
 * Send a single message to a phone number
 * Body: { telefone, mensagem }
 */
router.post('/sendManual', async (req, res) => {
    const escolaId = req.escolaId;
    const { telefone, mensagem } = req.body;

    if (!telefone || !mensagem) {
        return res.status(400).json({
            success: false,
            error: 'telefone e mensagem são obrigatórios',
        });
    }

    const sanitized = sanitizePhone(telefone);
    if (!sanitized) {
        return res.status(400).json({
            success: false,
            error: 'Número de telefone inválido',
        });
    }

    try {
        await sendMessage(escolaId, sanitized, mensagem);

        // Log the sent message
        await supabase.from('whatsapp_logs').insert({
            escola_id: escolaId,
            telefone: sanitized,
            mensagem: mensagem,
            tipo: 'manual',
            status: 'enviado',
        });

        res.json({ success: true, message: 'Mensagem enviada com sucesso' });
    } catch (error) {
        // Log failure
        await supabase.from('whatsapp_logs').insert({
            escola_id: escolaId,
            telefone: sanitized,
            mensagem: mensagem,
            tipo: 'manual',
            status: 'falha',
            erro: error.message,
        });

        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /sendToGroup
 * Send a message to all parents in a turma (group)
 * Body: { turma_id, mensagem }
 * Variables: {nome}, {responsavel}, {turma}
 */
router.post('/sendToGroup', async (req, res) => {
    const escolaId = req.escolaId;
    const { turma_id, mensagem } = req.body;

    if (!turma_id || !mensagem) {
        return res.status(400).json({
            success: false,
            error: 'turma_id e mensagem são obrigatórios',
        });
    }

    try {
        const { getStatus: getWAStatus } = require('../whatsapp');
        const status = getWAStatus(escolaId);
        if (!status.connected) {
            return res.status(400).json({ success: false, error: 'WhatsApp não conectado' });
        }

        // Get turma name
        const { data: turma } = await supabase
            .from('turmas')
            .select('nome')
            .eq('id', turma_id)
            .eq('escola_id', escolaId)
            .single();

        if (!turma) {
            return res.status(404).json({ success: false, error: 'Turma não encontrada' });
        }

        // Get all active students in this turma with phone numbers
        const { data: alunos, error } = await supabase
            .from('alunos')
            .select('id, nome, nome_responsavel, telefone_responsavel')
            .eq('escola_id', escolaId)
            .eq('turma_id', turma_id)
            .eq('situacao', 'ativo')
            .not('telefone_responsavel', 'is', null);

        if (error) throw error;
        if (!alunos || alunos.length === 0) {
            return res.json({ success: true, sent: 0, failed: 0, total: 0, message: 'Nenhum aluno com telefone encontrado nesta turma' });
        }

        const { formatMessage, delay } = require('../utils/formatMessage');
        const SEND_DELAY = 4000;
        let sent = 0;
        let failed = 0;

        for (const aluno of alunos) {
            const phone = sanitizePhone(aluno.telefone_responsavel);
            if (!phone) continue;

            const msg = formatMessage(mensagem, {
                nome: aluno.nome,
                responsavel: aluno.nome_responsavel || 'Responsável',
                turma: turma.nome,
                data: new Date().toLocaleDateString('pt-BR'),
            });

            try {
                await sendMessage(escolaId, phone, msg);
                await supabase.from('whatsapp_logs').insert({
                    escola_id: escolaId, aluno_id: aluno.id, telefone: phone,
                    mensagem: msg, tipo: 'manual', status: 'enviado',
                });
                sent++;
            } catch (err) {
                await supabase.from('whatsapp_logs').insert({
                    escola_id: escolaId, aluno_id: aluno.id, telefone: phone,
                    mensagem: msg, tipo: 'manual', status: 'falha', erro: err.message,
                });
                failed++;
            }

            await delay(SEND_DELAY);
        }

        res.json({ success: true, sent, failed, total: alunos.length });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /whatsapp-groups
 * List all WhatsApp groups from the connected account
 */
router.get('/whatsapp-groups', async (req, res) => {
    const escolaId = req.escolaId;

    try {
        const groups = await getGroups(escolaId);
        res.json({ success: true, data: groups });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /sendToWhatsAppGroup
 * Send a message to a WhatsApp group
 * Body: { group_id, mensagem }
 */
router.post('/sendToWhatsAppGroup', async (req, res) => {
    const escolaId = req.escolaId;
    const { group_id, mensagem } = req.body;

    if (!group_id || !mensagem) {
        return res.status(400).json({
            success: false,
            error: 'group_id e mensagem são obrigatórios',
        });
    }

    try {
        await sendMessageToGroup(escolaId, group_id, mensagem);

        // Log the sent message
        await supabase.from('whatsapp_logs').insert({
            escola_id: escolaId,
            telefone: group_id,
            mensagem: mensagem,
            tipo: 'manual',
            status: 'enviado',
        });

        res.json({ success: true, message: 'Mensagem enviada ao grupo' });
    } catch (error) {
        await supabase.from('whatsapp_logs').insert({
            escola_id: escolaId,
            telefone: group_id,
            mensagem: mensagem,
            tipo: 'manual',
            status: 'falha',
            erro: error.message,
        });

        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /disconnect
 * Disconnect WhatsApp session and clear local + cloud session data
 */
router.post('/disconnect', async (req, res) => {
    const escolaId = req.escolaId;

    try {
        await disconnect(escolaId);
        res.json({ success: true, message: 'WhatsApp desconectado com sucesso' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
