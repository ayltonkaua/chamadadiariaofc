/**
 * Supabase Admin Client
 * 
 * Uses the SERVICE_ROLE key to bypass RLS.
 * Only used server-side in the bot-api.
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ SUPABASE_URL and SUPABASE_SERVICE_KEY are required');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

/**
 * Validate that an escola exists and is active
 */
async function validateEscola(escolaId) {
    if (!escolaId || typeof escolaId !== 'string' || escolaId.length < 10) {
        return { valid: false, error: 'escola_id inválido' };
    }

    const { data, error } = await supabase
        .from('escola_configuracao')
        .select('id, nome, status')
        .eq('id', escolaId)
        .single();

    if (error || !data) {
        return { valid: false, error: 'Escola não encontrada' };
    }

    if (data.status !== 'aprovada') {
        return { valid: false, error: `Escola com status "${data.status}" — conexão bloqueada` };
    }

    return { valid: true, escola: data };
}

module.exports = { supabase, validateEscola };
