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
    // 🔥 GARANTE que o .env da função está carregado
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return new Response(
        JSON.stringify({
          error:
            "SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não foram carregados. Verifique o .env!",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { email, password, alunoId, nome } = await req.json();

    // Criar usuário no Auth
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

    // Atualizar a tabela de alunos
    const { error: updateError } = await supabaseAdmin
      .from("alunos")
      .update({
        user_id: userId,
        email,
      })
      .eq("id", alunoId);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ success: true, userId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
