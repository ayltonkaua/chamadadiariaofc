import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ============================
    // 1. CARREGAR SECRETS CORRETOS
    // ============================
    const SUPABASE_URL = Deno.env.get("PROJECT_URL");
    const SERVICE_ROLE = Deno.env.get("SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return new Response(
        JSON.stringify({
          error:
            "PROJECT_URL ou SERVICE_ROLE_KEY não encontrados no secrets. Verifique a configuração!",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // ============================
    // 2. AUTENTICAÇÃO DO CRIADOR
    // ============================
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const token = authHeader.replace("Bearer ", "");

    const {
      data: { user: creatorUser },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !creatorUser) {
      return new Response(
        JSON.stringify({ error: "Usuário criador não autenticado" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const creatorUserId = creatorUser.id;

    // ============================
    // 3. BUSCAR ESCOLA DO CRIADOR
    // ============================
    const { data: roleRow, error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .select("escola_id")
      .eq("user_id", creatorUserId)
      .limit(1)
      .single();

    if (roleErr || !roleRow) {
      return new Response(
        JSON.stringify({
          error: "Usuário criador não possui escola vinculada",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const escola_id = roleRow.escola_id;

    // ============================
    // 4. CRIAR USUÁRIO ALUNO
    // ============================
    const { email, password, alunoId, nome } = await req.json();

    const { data, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          username: nome,
          role: "aluno",
        },
      });

    if (createError) throw createError;

    const userId = data.user.id;

    // ============================
    // 5. ATUALIZAR TABELA ALUNOS
    // ============================
    const { error: updateError } = await supabaseAdmin
      .from("alunos")
      .update({
        user_id: userId,
        email,
        escola_id: escola_id,
      })
      .eq("id", alunoId);

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ success: true, userId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
