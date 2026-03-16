/**
 * Manual Send Routes
 * 
 * POST /sendManual   — Send individual message
 * GET  /status       — Bot connection status (per escola)
 * GET  /generate-qr  — Generate QR code (per escola)
 * POST /bulk-import-phones — Bulk import phone numbers from Excel data
 * POST /add-to-group — Add participants to a WhatsApp group
 * GET  /group-candidates/:group_id — List students with phones for group addition
 */

const express = require('express');
const router = express.Router();
const { sendMessage, sendMessageToGroup, getGroups, getStatus, getQR, initWhatsApp, disconnect, addParticipantsToGroup } = require('../whatsapp');
const { supabase, validateEscola } = require('../supabase');
const { sanitizePhone, formatMessage, delay } = require('../utils/formatMessage');

// In-memory progress tracking for group sends
const sendProgress = {};

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
        const status = getStatus(escolaId);
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
            .select('id, nome, nome_responsavel, telefone_responsavel, telefone_responsavel_2')
            .eq('escola_id', escolaId)
            .eq('turma_id', turma_id)
            .eq('situacao', 'ativo')
            .not('telefone_responsavel', 'is', null);

        if (error) throw error;
        if (!alunos || alunos.length === 0) {
            return res.json({ success: true, sent: 0, failed: 0, total: 0, message: 'Nenhum aluno com telefone encontrado nesta turma' });
        }

        // Count total messages to send (including second phones)
        let totalMessages = 0;
        for (const aluno of alunos) {
            if (aluno.telefone_responsavel) totalMessages++;
            if (aluno.telefone_responsavel_2) totalMessages++;
        }

        const SEND_DELAY = 20000;
        // Start background async process
        (async () => {
            let sent = 0;
            let failed = 0;

            for (const aluno of alunos) {
                // Send to both phone numbers if available
                const phones = [aluno.telefone_responsavel, aluno.telefone_responsavel_2].filter(Boolean);

                for (const rawPhone of phones) {
                    const phone = sanitizePhone(rawPhone);
                    if (!phone) continue;

                    // Update progress
                    sendProgress[escolaId].currentPhone = phone;
                    sendProgress[escolaId].currentName = aluno.nome;

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

                    // Update progress counters
                    sendProgress[escolaId].sent = sent;
                    sendProgress[escolaId].failed = failed;

                    await delay(SEND_DELAY);
                }
            }

            // Mark as complete
            sendProgress[escolaId].active = false;
            sendProgress[escolaId].currentPhone = '';
            sendProgress[escolaId].currentName = '';

            // Clean up progress after 30s
            setTimeout(() => { delete sendProgress[escolaId]; }, 30000);
        })();

        res.json({ success: true, sent: 0, failed: 0, total: totalMessages, message: 'Disparo assíncrono iniciado' });
    } catch (error) {
        if (sendProgress[escolaId]) {
            sendProgress[escolaId].active = false;
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /send-progress
 * Poll current send-to-group progress
 */
router.get('/send-progress', (req, res) => {
    const escolaId = req.escolaId;
    const progress = sendProgress[escolaId];

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
            turma: progress.turma,
            total: progress.total,
            sent: progress.sent,
            failed: progress.failed,
            processed,
            remaining,
            currentPhone: progress.currentPhone,
            currentName: progress.currentName,
            elapsedMs: elapsed,
            estimatedRemainingMs: estimatedRemaining,
            percentComplete: progress.total > 0 ? Math.round((processed / progress.total) * 100) : 0,
        },
    });
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

// =====================
// NEW ROUTES
// =====================

/**
 * POST /bulk-import-phones
 * Batch update phone numbers from Excel/CSV data
 * Body: { data: [{ matricula, telefone, telefone_2? }] }
 * 
 * Matches students by matricula + escola_id and updates their phone numbers.
 * Numbers are sanitized with sanitizePhone() before saving (keeps 9 digits).
 */
router.post('/bulk-import-phones', async (req, res) => {
    const escolaId = req.escolaId;
    const { data } = req.body;

    if (!data || !Array.isArray(data) || data.length === 0) {
        return res.status(400).json({
            success: false,
            error: 'Campo "data" é obrigatório e deve ser um array com [{matricula, telefone}]',
        });
    }

    if (data.length > 500) {
        return res.status(400).json({
            success: false,
            error: 'Máximo de 500 registros por vez',
        });
    }

    const results = {
        total: data.length,
        updated: 0,
        not_found: 0,
        invalid_phone: 0,
        errors: [],
    };

    for (const row of data) {
        const { matricula, telefone, telefone_2 } = row;

        if (!matricula) {
            results.errors.push({ matricula: '(vazio)', error: 'Matrícula não informada' });
            continue;
        }

        // Sanitize phone 1
        const phone1 = telefone ? sanitizePhone(telefone) : null;
        if (telefone && !phone1) {
            results.invalid_phone++;
            results.errors.push({ matricula, error: `Telefone 1 inválido: ${telefone}` });
            continue;
        }

        // Sanitize phone 2 (optional)
        const phone2 = telefone_2 ? sanitizePhone(telefone_2) : null;
        if (telefone_2 && !phone2) {
            results.errors.push({ matricula, error: `Telefone 2 inválido: ${telefone_2}` });
        }

        // Build update payload
        const updatePayload = {};
        if (phone1) updatePayload.telefone_responsavel = phone1;
        if (phone2) updatePayload.telefone_responsavel_2 = phone2;

        if (Object.keys(updatePayload).length === 0) {
            results.errors.push({ matricula, error: 'Nenhum telefone válido informado' });
            continue;
        }

        // Find and update student by matricula + escola_id
        const { data: student, error: findError } = await supabase
            .from('alunos')
            .select('id')
            .eq('matricula', String(matricula).trim())
            .eq('escola_id', escolaId)
            .maybeSingle();

        if (findError) {
            results.errors.push({ matricula, error: findError.message });
            continue;
        }

        if (!student) {
            results.not_found++;
            results.errors.push({ matricula, error: 'Aluno não encontrado com esta matrícula' });
            continue;
        }

        const { error: updateError } = await supabase
            .from('alunos')
            .update(updatePayload)
            .eq('id', student.id);

        if (updateError) {
            results.errors.push({ matricula, error: updateError.message });
        } else {
            results.updated++;
        }
    }

    console.log(`📥 [${escolaId.substring(0, 8)}] Bulk import: ${results.updated}/${results.total} updated`);

    res.json({
        success: true,
        data: results,
    });
});

/**
 * POST /add-to-group
 * Add participants to a WhatsApp group
 * Body: { group_id, telefones: string[] }
 * Max 5 numbers per request
 */
router.post('/add-to-group', async (req, res) => {
    const escolaId = req.escolaId;
    const { group_id, telefones } = req.body;

    if (!group_id || !telefones || !Array.isArray(telefones)) {
        return res.status(400).json({
            success: false,
            error: 'group_id e telefones (array) são obrigatórios',
        });
    }

    if (telefones.length === 0) {
        return res.status(400).json({
            success: false,
            error: 'Informe pelo menos um número',
        });
    }

    if (telefones.length > 5) {
        return res.status(400).json({
            success: false,
            error: 'Máximo de 5 números por vez para evitar bloqueio do WhatsApp',
        });
    }

    try {
        // Sanitize all phone numbers
        const sanitizedPhones = telefones.map(t => sanitizePhone(t)).filter(Boolean);

        if (sanitizedPhones.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Nenhum número válido informado',
            });
        }

        const results = await addParticipantsToGroup(escolaId, group_id, sanitizedPhones);

        const added = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;

        res.json({
            success: true,
            data: {
                added,
                failed,
                total: results.length,
                details: results,
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /group-candidates/:group_id
 * List students with phone numbers that can be added to a WhatsApp group
 * Returns students with their phones for selection in the UI
 */
router.get('/group-candidates/:group_id', async (req, res) => {
    const escolaId = req.escolaId;

    try {
        // Get all active students with phone numbers
        const { data: alunos, error } = await supabase
            .from('alunos')
            .select('id, nome, matricula, telefone_responsavel, telefone_responsavel_2, turma_id')
            .eq('escola_id', escolaId)
            .eq('situacao', 'ativo')
            .or('telefone_responsavel.not.is.null,telefone_responsavel_2.not.is.null')
            .order('nome');

        if (error) throw error;

        // Get turma names
        const turmaIds = [...new Set(alunos.map(a => a.turma_id))];
        const { data: turmas } = await supabase
            .from('turmas')
            .select('id, nome')
            .in('id', turmaIds);

        const turmaMap = {};
        (turmas || []).forEach(t => { turmaMap[t.id] = t.nome; });

        const candidates = alunos.map(a => ({
            id: a.id,
            nome: a.nome,
            matricula: a.matricula,
            turma: turmaMap[a.turma_id] || 'Sem turma',
            telefone_responsavel: a.telefone_responsavel,
            telefone_responsavel_2: a.telefone_responsavel_2,
        }));

        res.json({ success: true, data: candidates });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
