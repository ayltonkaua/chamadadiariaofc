/**
 * Edge Function: create-staff-user
 *
 * Creates a staff user account (professor, coordenador, secretario, diretor)
 * with a temporary password. The user must change their password on first login.
 *
 * Called by school admins/directors from GerenciarAcessoPage.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_ROLES = ["professor", "coordenador", "secretario", "diretor", "admin"];
const CREATOR_ROLES = ["admin", "diretor"]; // Only these can create staff

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        // 1. Load secrets
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("PROJECT_URL");
        const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY");

        if (!SUPABASE_URL || !SERVICE_ROLE) {
            return new Response(
                JSON.stringify({ error: "Variáveis de ambiente não configuradas" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

        // 2. Authenticate the creator
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: "Token de autenticação ausente" }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const token = authHeader.replace("Bearer ", "");
        const { data: { user: creatorUser }, error: userError } =
            await supabaseAdmin.auth.getUser(token);

        if (userError || !creatorUser) {
            return new Response(
                JSON.stringify({ error: "Usuário não autenticado" }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 3. Verify creator has permission (admin or diretor)
        const { data: creatorRole, error: roleErr } = await supabaseAdmin
            .from("user_roles")
            .select("role, escola_id")
            .eq("user_id", creatorUser.id)
            .limit(1)
            .single();

        if (roleErr || !creatorRole) {
            return new Response(
                JSON.stringify({ error: "Usuário não possui perfil de escola" }),
                { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        if (!CREATOR_ROLES.includes(creatorRole.role)) {
            return new Response(
                JSON.stringify({ error: "Apenas Admin ou Diretor podem criar contas de equipe" }),
                { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const escola_id = creatorRole.escola_id;

        // 4. Parse request body
        const { email, password, nome, role } = await req.json();

        // Validate inputs
        if (!email || !password || !nome || !role) {
            return new Response(
                JSON.stringify({ error: "Campos obrigatórios: email, password, nome, role" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        if (!ALLOWED_ROLES.includes(role)) {
            return new Response(
                JSON.stringify({ error: `Role inválido. Permitidos: ${ALLOWED_ROLES.join(", ")}` }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        if (password.length < 6) {
            return new Response(
                JSON.stringify({ error: "Senha deve ter no mínimo 6 caracteres" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 5. Check if email already exists in this school
        const { data: existingRole } = await supabaseAdmin
            .from("user_roles")
            .select("user_id")
            .eq("escola_id", escola_id)
            .limit(100);

        // Check auth users for existing email
        // We'll try to create and catch duplicate

        // 6. Create user account
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email: email.trim().toLowerCase(),
            password,
            email_confirm: true, // Skip email confirmation
            user_metadata: {
                username: nome.trim(),
                role: role,
                must_change_password: true, // Flag for forced password change
                escola_id: escola_id,
            },
        });

        if (createError) {
            // Handle duplicate email
            if (createError.message?.includes("already been registered") ||
                createError.message?.includes("duplicate")) {
                return new Response(
                    JSON.stringify({ error: "Este email já está cadastrado no sistema" }),
                    { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }
            throw createError;
        }

        const userId = newUser.user.id;

        // 7. Create user_roles entry
        const { error: roleInsertError } = await supabaseAdmin
            .from("user_roles")
            .insert({
                user_id: userId,
                escola_id: escola_id,
                role: role,
            });

        if (roleInsertError) {
            // Rollback: delete the created user
            await supabaseAdmin.auth.admin.deleteUser(userId);
            throw roleInsertError;
        }

        // 8. Update convites_acesso if there was a pending invite
        await supabaseAdmin
            .from("convites_acesso")
            .update({ status: "aceito" } as any)
            .eq("email", email.trim().toLowerCase())
            .eq("escola_id", escola_id);

        // 9. Return success
        return new Response(
            JSON.stringify({
                success: true,
                userId,
                message: `Conta criada para ${nome} (${role})`,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("Error creating staff user:", error);
        return new Response(
            JSON.stringify({ error: (error as Error).message || "Erro interno" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
