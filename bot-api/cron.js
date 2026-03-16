/**
 * Cron Jobs — Multi-Tenant
 * 
 * Daily 18:00  → Send alerts for 2+ consecutive absences + at-risk students
 * Monthly 25th → Send monthly absence summary
 * 
 * Each active escola gets its own cron execution with 20s delay between sends.
 */

const cron = require('node-cron');
const { getActiveEscolas, sendMessage } = require('./whatsapp');
const { supabase } = require('./supabase');
const { formatMessage, sanitizePhone, delay } = require('./utils/formatMessage');

const CRON_SEND_DELAY_MS = 20000; // 20 seconds between sends in cron

/**
 * Get templates for an escola
 */
async function getTemplates(escolaId) {
    const { data } = await supabase
        .from('whatsapp_bot_config')
        .select('*')
        .eq('escola_id', escolaId)
        .eq('ativo', true)
        .single();

    if (!data) return null;

    return data;
}

/**
 * Process consecutive absence alerts for a single escola
 */
async function processConsecutiveAlerts(escolaId) {
    console.log(`⏰ [CRON] [${escolaId.substring(0, 8)}] Processing consecutive alerts...`);

    const config = await getTemplates(escolaId);
    if (!config || !config.auto_consecutiva) {
        return;
    }

    const { data: alunos } = await supabase
        .from('alunos')
        .select('id, nome, nome_responsavel, telefone_responsavel')
        .eq('escola_id', escolaId)
        .eq('situacao', 'ativo')
        .not('telefone_responsavel', 'is', null);

    if (!alunos || alunos.length === 0) return;

    const today = new Date().toLocaleDateString('pt-BR');
    let sent = 0;

    for (const aluno of alunos) {
        const { data: presencas } = await supabase
            .from('presencas')
            .select('presente, falta_justificada')
            .eq('aluno_id', aluno.id)
            .eq('escola_id', escolaId)
            .order('data_chamada', { ascending: false })
            .limit(5);

        if (!presencas || presencas.length < 2) continue;

        let consecutivas = 0;
        for (const p of presencas) {
            if (!p.presente && !p.falta_justificada) consecutivas++;
            else break;
        }

        if (consecutivas < 2) continue;

        const phone = sanitizePhone(aluno.telefone_responsavel);
        if (!phone) continue;

        const message = formatMessage(config.template_consecutiva, {
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
        }

        await delay(CRON_SEND_DELAY_MS);
    }

    console.log(`✅ [CRON] [${escolaId.substring(0, 8)}] Consecutive alerts: ${sent} sent`);
}

/**
 * Process risk alerts for a single escola
 */
async function processRiskAlerts(escolaId) {
    console.log(`⏰ [CRON] [${escolaId.substring(0, 8)}] Processing risk alerts...`);

    const config = await getTemplates(escolaId);
    if (!config || !config.auto_consecutiva) return;

    const { data: alunos } = await supabase
        .from('alunos')
        .select('id, nome, nome_responsavel, telefone_responsavel')
        .eq('escola_id', escolaId)
        .eq('situacao', 'ativo')
        .not('telefone_responsavel', 'is', null);

    if (!alunos || alunos.length === 0) return;

    const today = new Date().toLocaleDateString('pt-BR');
    let sent = 0;

    for (const aluno of alunos) {
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
        if (rate <= 30 || totalFaltas === 0) continue;

        const phone = sanitizePhone(aluno.telefone_responsavel);
        if (!phone) continue;

        const message = formatMessage(config.template_risco, {
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
        }

        await delay(CRON_SEND_DELAY_MS);
    }

    console.log(`✅ [CRON] [${escolaId.substring(0, 8)}] Risk alerts: ${sent} sent`);
}

/**
 * Process monthly summary for a single escola
 */
async function processMonthlySummary(escolaId) {
    console.log(`📊 [CRON] [${escolaId.substring(0, 8)}] Processing monthly summary...`);

    const config = await getTemplates(escolaId);
    if (!config || !config.auto_mensal) return;

    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    const today = now.toLocaleDateString('pt-BR');

    const { data: alunos } = await supabase
        .from('alunos')
        .select('id, nome, nome_responsavel, telefone_responsavel')
        .eq('escola_id', escolaId)
        .eq('situacao', 'ativo')
        .not('telefone_responsavel', 'is', null);

    if (!alunos || alunos.length === 0) return;

    let sent = 0;

    for (const aluno of alunos) {
        const { count: faltasMes } = await supabase
            .from('presencas')
            .select('id', { count: 'exact', head: true })
            .eq('aluno_id', aluno.id)
            .eq('escola_id', escolaId)
            .eq('presente', false)
            .gte('data_chamada', firstDay)
            .lte('data_chamada', lastDay);

        if (!faltasMes || faltasMes === 0) continue;

        const phone = sanitizePhone(aluno.telefone_responsavel);
        if (!phone) continue;

        const message = formatMessage(config.template_mensal, {
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
        }

        await delay(CRON_SEND_DELAY_MS);
    }

    console.log(`✅ [CRON] [${escolaId.substring(0, 8)}] Monthly summary: ${sent} sent`);
}

/**
 * Process daily absences for a single escola
 */
async function processDailyAbsences(escolaId, cronTimePrefix) {
    const config = await getTemplates(escolaId);
    if (!config || !config.auto_falta_diaria || !config.horario_falta_diaria) return;

    // Check if the current cron is running exactly at the configured time
    if (!config.horario_falta_diaria.startsWith(cronTimePrefix)) return;

    console.log(`⏰ [CRON] [${escolaId.substring(0, 8)}] Processing daily absences at ${cronTimePrefix}...`);

    const { data: alunos } = await supabase
        .from('alunos')
        .select('id, nome, nome_responsavel, telefone_responsavel')
        .eq('escola_id', escolaId)
        .eq('situacao', 'ativo')
        .not('telefone_responsavel', 'is', null);

    if (!alunos || alunos.length === 0) return;

    const now = new Date();
    const todayLocal = now.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); // "YYYY-MM-DD"
    const todayBR = now.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    let sent = 0;

    for (const aluno of alunos) {
        const { data: presenca } = await supabase
            .from('presencas')
            .select('presente, falta_justificada')
            .eq('aluno_id', aluno.id)
            .eq('escola_id', escolaId)
            .eq('data_chamada', todayLocal)
            .maybeSingle();

        if (!presenca || presenca.presente || presenca.falta_justificada) continue;

        const phone = sanitizePhone(aluno.telefone_responsavel);
        if (!phone) continue;

        const template = config.template_falta_diaria || 'Olá! Sentimos a falta do {nome} hoje ({data}).';
        const message = formatMessage(template, {
            nome: aluno.nome,
            data: todayBR,
            responsavel: aluno.nome_responsavel || 'Responsável',
        });

        try {
            await sendMessage(escolaId, phone, message);
            await supabase.from('whatsapp_logs').insert({
                escola_id: escolaId, aluno_id: aluno.id, telefone: phone,
                mensagem: message, tipo: 'falta_diaria', status: 'enviado',
            });
            sent++;
        } catch (err) {
            await supabase.from('whatsapp_logs').insert({
                escola_id: escolaId, aluno_id: aluno.id, telefone: phone,
                mensagem: message, tipo: 'falta_diaria', status: 'falha', erro: err.message,
            });
        }

        await delay(CRON_SEND_DELAY_MS);
    }

    console.log(`✅ [CRON] [${escolaId.substring(0, 8)}] Daily absences: ${sent} sent`);
}

/**
 * Initialize all cron jobs
 */
function initCronJobs() {
    // Daily Jobs for standard time triggers (12:30, 18:00, 22:30)
    const schedules = [
        { cron: '30 12 * * *', timePrefix: '12:30' },
        { cron: '0 18 * * *', timePrefix: '18:00' },
        { cron: '30 22 * * *', timePrefix: '22:30' }
    ];

    schedules.forEach(schedule => {
        cron.schedule(schedule.cron, async () => {
            console.log(`[CRON] ${schedule.timePrefix} — Starting alerts...`);
            const escolas = getActiveEscolas();
            if (escolas.length === 0) return;

            for (const { escolaId } of escolas) {
                try {
                    await processDailyAbsences(escolaId, schedule.timePrefix);

                    // For 18:00, also process Risk and Consecutive if auto_consecutiva is ON
                    if (schedule.timePrefix === '18:00') {
                        await processConsecutiveAlerts(escolaId);
                        await processRiskAlerts(escolaId);
                    }
                } catch (err) {
                    console.error(`[CRON] [${escolaId.substring(0, 8)}] Error at ${schedule.timePrefix}:`, err.message);
                }
            }
        }, { timezone: 'America/Sao_Paulo' });
    });

    // Daily at 21:00 — Escalation for 3+ consecutive absences without contact
    cron.schedule('0 21 * * *', async () => {
        console.log('[CRON] Daily 21:00 — Starting escalation check for all active escolas...');

        const escolas = getActiveEscolas();
        if (escolas.length === 0) {
            console.log('[CRON] No active escola connections — skipping');
            return;
        }

        for (const { escolaId } of escolas) {
            try {
                await processEscalation(escolaId);
            } catch (err) {
                console.error(`[CRON] [${escolaId.substring(0, 8)}] Escalation error:`, err.message);
            }
        }

        console.log('[CRON] Escalation check completed');
    }, { timezone: 'America/Sao_Paulo' });

    // Monthly on 25th at 10:00 — Monthly summary
    cron.schedule('0 10 25 * *', async () => {
        console.log('[CRON] Monthly 25th — Starting summary for all active escolas...');

        const escolas = getActiveEscolas();
        if (escolas.length === 0) {
            console.log('[CRON] No active escola connections — skipping');
            return;
        }

        for (const { escolaId } of escolas) {
            try {
                await processMonthlySummary(escolaId);
            } catch (err) {
                console.error(`[CRON] [${escolaId.substring(0, 8)}] Error:`, err.message);
            }
        }

        console.log('[CRON] Monthly summary completed');
    }, { timezone: 'America/Sao_Paulo' });

    console.log('Cron jobs initialized:');
    console.log('   Daily 18:00 — Consecutive + Risk alerts');
    console.log('   Daily 21:00 — Escalation (3+ faltas sem resposta)');
    console.log('   Monthly 25th 10:00 — Monthly summary');
}

/**
 * Process escalation for 3+ consecutive absences without Busca Ativa contact
 */
async function processEscalation(escolaId) {
    console.log(`[CRON] [${escolaId.substring(0, 8)}] Processing escalation...`);

    const config = await getTemplates(escolaId);
    if (!config) {
        console.log(`[CRON] [${escolaId.substring(0, 8)}] No active config — skipping`);
        return;
    }

    const templateEscalacao = config.template_escalacao ||
        'Prezado(a) {responsavel}, o(a) aluno(a) *{nome}* acumula *{faltas} faltas consecutivas* sem justificativa. É fundamental que nos informe o motivo para que possamos acionar a Busca Ativa e garantir a permanência escolar. Entre em contato com urgência.';

    const { data: alunos } = await supabase
        .from('alunos')
        .select('id, nome, nome_responsavel, telefone_responsavel')
        .eq('escola_id', escolaId)
        .eq('situacao', 'ativo')
        .not('telefone_responsavel', 'is', null);

    if (!alunos || alunos.length === 0) return;

    const today = new Date().toLocaleDateString('pt-BR');
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    let sent = 0;

    for (const aluno of alunos) {
        const { data: presencas } = await supabase
            .from('presencas')
            .select('presente, falta_justificada')
            .eq('aluno_id', aluno.id)
            .eq('escola_id', escolaId)
            .order('data_chamada', { ascending: false })
            .limit(10);

        if (!presencas || presencas.length < 3) continue;

        let consecutivas = 0;
        for (const p of presencas) {
            if (!p.presente && !p.falta_justificada) consecutivas++;
            else break;
        }

        if (consecutivas < 3) continue;

        // Skip if Busca Ativa contacted in last 7 days
        const { data: buscaAtiva } = await supabase
            .from('registros_contato_busca_ativa')
            .select('id')
            .eq('aluno_id', aluno.id)
            .gte('created_at', sevenDaysAgo)
            .limit(1);

        if (buscaAtiva && buscaAtiva.length > 0) continue;

        // Skip if escalation sent in last 3 days
        const { data: recentEsc } = await supabase
            .from('whatsapp_logs')
            .select('id')
            .eq('aluno_id', aluno.id)
            .eq('tipo', 'escalacao')
            .eq('status', 'enviado')
            .gte('created_at', threeDaysAgo)
            .limit(1);

        if (recentEsc && recentEsc.length > 0) continue;

        const phone = sanitizePhone(aluno.telefone_responsavel);
        if (!phone) continue;

        const message = formatMessage(templateEscalacao, {
            nome: aluno.nome,
            faltas: consecutivas,
            responsavel: aluno.nome_responsavel || 'Responsável',
            data: today,
        });

        try {
            await sendMessage(escolaId, phone, message);
            await supabase.from('whatsapp_logs').insert({
                escola_id: escolaId, aluno_id: aluno.id, telefone: phone,
                mensagem: message, tipo: 'escalacao', status: 'enviado',
            });
            sent++;
        } catch (err) {
            await supabase.from('whatsapp_logs').insert({
                escola_id: escolaId, aluno_id: aluno.id, telefone: phone,
                mensagem: message, tipo: 'escalacao', status: 'falha', erro: err.message,
            });
        }

        await delay(CRON_SEND_DELAY_MS);
    }

    console.log(`[CRON] [${escolaId.substring(0, 8)}] Escalation: ${sent} sent`);
}

module.exports = { initCronJobs };

