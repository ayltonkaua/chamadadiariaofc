/**
 * Edge Function: analyze-evasao
 *
 * Proxy server-side para chamadas de IA (Groq / Gemini).
 * Resolve problemas de CORS que impedem chamadas diretas do navegador.
 *
 * Uso: supabase.functions.invoke('analyze-evasao', { body: { prompt } })
 *
 * Secrets necessários (configurar via Supabase Dashboard > Edge Functions > Secrets):
 *   - GROQ_API_KEY
 *   - GEMINI_API_KEY
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
};

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

// ── Groq ──────────────────────────────────────────────
async function chamarGroq(prompt: string): Promise<{ texto: string | null; modelo: string }> {
    const apiKey = Deno.env.get("GROQ_API_KEY");
    if (!apiKey) {
        console.warn("[AI] GROQ_API_KEY não configurada nos secrets");
        return { texto: null, modelo: "groq" };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
        const res = await fetch(GROQ_API_URL, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: "Você é um especialista em gestão educacional brasileira." },
                    { role: "user", content: prompt },
                ],
                temperature: 0.4,
                max_tokens: 600,
            }),
            signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!res.ok) {
            const body = await res.text().catch(() => "");
            console.error(`[AI] Groq HTTP ${res.status}: ${body}`);
            return { texto: null, modelo: "groq" };
        }

        const data = await res.json();
        const texto = data.choices?.[0]?.message?.content || null;
        if (!texto) {
            console.error("[AI] Groq retornou json sem texto:", JSON.stringify(data));
        }
        return { texto, modelo: "groq" };
    } catch (err) {
        console.error("[AI] Groq erro catch:", err);
        return { texto: null, modelo: "groq" };
    }
}

// ── Gemini ─────────────────────────────────────────────
async function chamarGemini(prompt: string): Promise<{ texto: string | null; modelo: string }> {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
        console.warn("[AI] GEMINI_API_KEY não configurada nos secrets");
        return { texto: null, modelo: "gemini" };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
        const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.4,
                    maxOutputTokens: 600,
                },
            }),
            signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!res.ok) {
            const body = await res.text().catch(() => "");
            console.error(`[AI] Gemini HTTP ${res.status}: ${body}`);
            return { texto: null, modelo: "gemini" };
        }

        const data = await res.json();
        const texto = data.candidates?.[0]?.content?.parts?.[0]?.text || null;
        if (!texto) {
            console.error("[AI] Gemini retornou json sem texto:", JSON.stringify(data));
        }
        return { texto, modelo: "gemini" };
    } catch (err) {
        console.error("[AI] Gemini erro catch:", err);
        return { texto: null, modelo: "gemini" };
    }
}

// ── Handler ────────────────────────────────────────────
serve(async (req) => {
    // CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { prompt } = await req.json();

        if (!prompt || typeof prompt !== "string") {
            return new Response(
                JSON.stringify({ error: "Campo 'prompt' é obrigatório" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Tenta Groq primeiro (mais rápido), depois Gemini como fallback
        let resultado = await chamarGroq(prompt);

        if (!resultado.texto) {
            resultado = await chamarGemini(prompt);
        }

        if (!resultado.texto) {
            return new Response(
                JSON.stringify({
                    texto: null,
                    modelo: "local",
                    error: "Nenhum provedor de IA respondeu",
                }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        return new Response(
            JSON.stringify({
                texto: resultado.texto,
                modelo: resultado.modelo,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("[analyze-evasao] Erro:", error);
        return new Response(
            JSON.stringify({ error: (error as Error).message || "Erro interno" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
