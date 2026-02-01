// Edge Function: arquivar-ano-letivo
// Arquiva dados COMPLETOS de presença no Firebase e limpa do Supabase

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Firebase Admin SDK via REST API
const FIREBASE_PROJECT_ID = Deno.env.get("FIREBASE_PROJECT_ID")!;
const FIREBASE_PRIVATE_KEY = Deno.env.get("FIREBASE_PRIVATE_KEY")!.replace(/\\n/g, '\n');
const FIREBASE_CLIENT_EMAIL = Deno.env.get("FIREBASE_CLIENT_EMAIL")!;

// Types
interface ArchiveRequest {
    action?: 'read' | 'archive';
    ano_letivo_id: string;
    escola_id: string;
    confirmar_exclusao?: boolean;
}

interface AlunoCompleto {
    aluno_id: string;
    nome: string;
    matricula: string;
    turma_id: string;
    turma_nome: string;
    situacao: string;
    presentes: number;
    faltas: number;
    atestados: number;
    frequencia: number;
    total_dias_letivos: number;
}

interface TurmaCompleta {
    id: string;
    nome: string;
    turno: string;
    total_alunos: number;
    alunos: AlunoCompleto[];
    total_dias_chamada: number;
}

// Gerar JWT para autenticar no Firebase
async function getFirebaseAccessToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: "RS256", typ: "JWT" };
    const payload = {
        iss: FIREBASE_CLIENT_EMAIL,
        sub: FIREBASE_CLIENT_EMAIL,
        aud: "https://firestore.googleapis.com/",
        iat: now,
        exp: now + 3600,
    };

    const encoder = new TextEncoder();
    const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const unsignedToken = `${headerB64}.${payloadB64}`;

    const pemContents = FIREBASE_PRIVATE_KEY
        .replace('-----BEGIN PRIVATE KEY-----', '')
        .replace('-----END PRIVATE KEY-----', '')
        .replace(/\s/g, '');

    const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

    const cryptoKey = await crypto.subtle.importKey(
        "pkcs8", binaryKey,
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false, ["sign"]
    );

    const signature = await crypto.subtle.sign(
        "RSASSA-PKCS1-v1_5", cryptoKey, encoder.encode(unsignedToken)
    );

    const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
        .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

    return `${unsignedToken}.${signatureB64}`;
}

// Escrever documento no Firestore
async function writeToFirestore(path: string, data: Record<string, unknown>): Promise<void> {
    const token = await getFirebaseAccessToken();
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${path}`;
    const firestoreData = convertToFirestoreFormat(data);

    const response = await fetch(url, {
        method: "PATCH",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ fields: firestoreData }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Firestore error: ${error}`);
    }
}

// Ler documento do Firestore
async function readFromFirestore(path: string): Promise<Record<string, unknown> | null> {
    const token = await getFirebaseAccessToken();
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${path}`;

    const response = await fetch(url, {
        method: "GET",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" }
    });

    if (response.status === 404) return null;
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Firestore read error: ${error}`);
    }

    const json = await response.json();
    return convertFromFirestoreFormat(json.fields);
}

// Converter objeto JS para formato Firestore
function convertToFirestoreFormat(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
        if (value === null || value === undefined) result[key] = { nullValue: null };
        else if (typeof value === "string") result[key] = { stringValue: value };
        else if (typeof value === "number") result[key] = Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
        else if (typeof value === "boolean") result[key] = { booleanValue: value };
        else if (value instanceof Date) result[key] = { timestampValue: value.toISOString() };
        else if (Array.isArray(value)) result[key] = { arrayValue: { values: value.map(v => convertToFirestoreFormat({ v }).v) } };
        else if (typeof value === "object") result[key] = { mapValue: { fields: convertToFirestoreFormat(value as Record<string, unknown>) } };
    }
    return result;
}

// Converter formato Firestore para JS
function convertFromFirestoreFormat(fields: Record<string, any>): Record<string, unknown> {
    if (!fields) return {};
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
        if (value.stringValue !== undefined) result[key] = value.stringValue;
        else if (value.integerValue !== undefined) result[key] = parseInt(value.integerValue);
        else if (value.doubleValue !== undefined) result[key] = value.doubleValue;
        else if (value.booleanValue !== undefined) result[key] = value.booleanValue;
        else if (value.timestampValue !== undefined) result[key] = value.timestampValue;
        else if (value.nullValue !== undefined) result[key] = null;
        else if (value.arrayValue !== undefined) {
            result[key] = (value.arrayValue.values || []).map((v: any) => {
                if (v.mapValue) return convertFromFirestoreFormat(v.mapValue.fields);
                if (v.stringValue !== undefined) return v.stringValue;
                if (v.integerValue !== undefined) return parseInt(v.integerValue);
                return v;
            });
        }
        else if (value.mapValue !== undefined) {
            result[key] = convertFromFirestoreFormat(value.mapValue.fields);
        }
    }
    return result;
}

serve(async (req) => {
    // CORS
    if (req.method === "OPTIONS") {
        return new Response(null, {
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
            },
        });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const authHeader = req.headers.get("Authorization")!;

        const supabaseUser = createClient(supabaseUrl, supabaseServiceKey, {
            global: { headers: { Authorization: authHeader } }
        });
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

        const reqBody = await req.json();
        const { action = 'archive', ano_letivo_id, escola_id } = reqBody;

        // 1. Validar autenticação
        const { data: { user } } = await supabaseUser.auth.getUser();
        if (!user) throw new Error("Não autenticado");

        // 2. Validar permissão
        const { data: userRole } = await supabaseAdmin
            .from("user_roles").select("role")
            .eq("user_id", user.id).eq("escola_id", escola_id).single();
        if (!userRole) throw new Error("Acesso negado à escola");

        // ---- READ ACTION ----
        if (action === 'read') {
            const path = `archives/${escola_id}/${ano_letivo_id}/data`;
            const data = await readFromFirestore(path);
            if (!data) throw new Error("Arquivo não encontrado.");
            return new Response(JSON.stringify({ success: true, data }), {
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
            });
        }

        // ---- ARCHIVE ACTION ----
        const { confirmar_exclusao } = reqBody as ArchiveRequest;
        if (!["admin", "diretor", "super_admin"].includes(userRole.role)) {
            throw new Error("Permissão negada. Apenas Diretor pode arquivar.");
        }

        // 3. Buscar ano letivo
        const { data: anoLetivo, error: anoError } = await supabaseAdmin
            .from("anos_letivos").select("*").eq("id", ano_letivo_id).single();
        if (anoError || !anoLetivo) throw new Error("Ano letivo não encontrado");

        // 4. Buscar TODAS as turmas do ano
        const { data: turmas } = await supabaseAdmin
            .from("turmas")
            .select("id, nome, turno")
            .eq("ano_letivo_id", ano_letivo_id);

        if (!turmas || turmas.length === 0) {
            throw new Error("Nenhuma turma encontrada para este ano letivo");
        }

        const turmaIds = turmas.map(t => t.id);

        // 5. Buscar TODOS os alunos de TODAS as turmas (independente de ter presença)
        const { data: todosAlunos } = await supabaseAdmin
            .from("alunos")
            .select("id, nome, matricula, turma_id, situacao")
            .in("turma_id", turmaIds);

        // 6. Buscar TODAS as presenças das turmas
        const { data: presencas } = await supabaseAdmin
            .from("presencas")
            .select("aluno_id, turma_id, data_chamada, presente, falta_justificada")
            .in("turma_id", turmaIds);

        // 7. Calcular dias únicos de chamada por turma
        const diasPorTurma: Record<string, Set<string>> = {};
        for (const p of presencas || []) {
            if (!diasPorTurma[p.turma_id]) diasPorTurma[p.turma_id] = new Set();
            diasPorTurma[p.turma_id].add(p.data_chamada);
        }

        // 8. Agrupar estatísticas por aluno
        const alunosStats: Record<string, AlunoCompleto> = {};
        for (const aluno of todosAlunos || []) {
            const turma = turmas.find(t => t.id === aluno.turma_id);
            alunosStats[aluno.id] = {
                aluno_id: aluno.id,
                nome: aluno.nome,
                matricula: aluno.matricula || "",
                turma_id: aluno.turma_id,
                turma_nome: turma?.nome || "Sem turma",
                situacao: aluno.situacao || "ativo",
                presentes: 0,
                faltas: 0,
                atestados: 0,
                frequencia: 0,
                total_dias_letivos: diasPorTurma[aluno.turma_id]?.size || 0
            };
        }

        // 9. Contabilizar presenças
        let totalPresentes = 0, totalFaltas = 0, totalAtestados = 0;
        for (const p of presencas || []) {
            const stats = alunosStats[p.aluno_id];
            if (!stats) continue; // Presença órfã (aluno deletado)

            if (p.presente) { stats.presentes++; totalPresentes++; }
            else if (p.falta_justificada) { stats.atestados++; totalAtestados++; }
            else { stats.faltas++; totalFaltas++; }
        }

        // 10. Calcular frequência de cada aluno
        for (const stats of Object.values(alunosStats)) {
            const total = stats.presentes + stats.faltas + stats.atestados;
            stats.frequencia = total > 0
                ? Math.round((stats.presentes + stats.atestados) * 1000 / total) / 10
                : 0;
        }

        // 11. Montar turmas completas com seus alunos
        const turmasCompletas: TurmaCompleta[] = turmas.map(t => {
            const alunosDaTurma = Object.values(alunosStats).filter(a => a.turma_id === t.id);
            return {
                id: t.id,
                nome: t.nome,
                turno: t.turno || "integral",
                total_alunos: alunosDaTurma.length,
                alunos: alunosDaTurma.sort((a, b) => a.nome.localeCompare(b.nome)),
                total_dias_chamada: diasPorTurma[t.id]?.size || 0
            };
        });

        // 12. Buscar atestados
        const alunoIds = Object.keys(alunosStats);
        const { data: atestados } = alunoIds.length > 0
            ? await supabaseAdmin.from("atestados")
                .select("id, aluno_id, data_inicio, data_fim, status, motivo")
                .in("aluno_id", alunoIds)
            : { data: [] };

        // 13. Buscar escola
        const { data: escola } = await supabaseAdmin
            .from("escola_configuracao").select("nome").eq("id", escola_id).single();

        // 14. Calcular metadata
        const totalAlunos = Object.keys(alunosStats).length;
        const totalRegistros = totalPresentes + totalFaltas + totalAtestados;
        const frequenciaGeral = totalRegistros > 0
            ? Math.round((totalPresentes + totalAtestados) * 1000 / totalRegistros) / 10
            : 0;

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 365); // 1 ano de retenção

        // 15. Montar archive data COMPLETO
        const archiveData = {
            version: "2.0", // Nova versão com dados completos
            metadata: {
                escola_id,
                escola_nome: escola?.nome || "Escola",
                ano: anoLetivo.ano,
                nome: anoLetivo.nome,
                periodo: { inicio: anoLetivo.data_inicio, fim: anoLetivo.data_fim },
                archived_at: new Date().toISOString(),
                expires_at: expiresAt.toISOString(),
                stats: {
                    total_turmas: turmas.length,
                    total_alunos: totalAlunos,
                    total_presencas: totalPresentes,
                    total_faltas: totalFaltas,
                    total_atestados: totalAtestados,
                    frequencia_geral: frequenciaGeral,
                },
            },
            turmas: turmasCompletas,
            alunos_ranking: Object.values(alunosStats)
                .filter(a => a.faltas > 0)
                .sort((a, b) => b.faltas - a.faltas)
                .slice(0, 50), // Top 50 mais faltosos
            atestados: atestados?.map(a => ({
                id: a.id,
                aluno_id: a.aluno_id,
                aluno_nome: alunosStats[a.aluno_id]?.nome || "Desconhecido",
                data_inicio: a.data_inicio,
                data_fim: a.data_fim,
                status: a.status,
                motivo: a.motivo
            })) || [],
        };

        // 16. Write to Firebase
        const basePath = `archives/${escola_id}/${ano_letivo_id}`;
        await writeToFirestore(`${basePath}/data`, archiveData);

        // 17. Delete from Supabase (se confirmado)
        let deletedPresencas = 0;
        let deletedAlunos = 0;
        let deletedTurmas = 0;

        if (confirmar_exclusao) {
            // Deletar em ordem correta (dependências primeiro)
            const { count: countPresencas } = await supabaseAdmin
                .from("presencas").delete({ count: "exact" }).in("turma_id", turmaIds);
            deletedPresencas = countPresencas || 0;

            await supabaseAdmin.from("observacoes_alunos").delete().in("turma_id", turmaIds);

            // Deletar alunos das turmas
            const { count: countAlunos } = await supabaseAdmin
                .from("alunos").delete({ count: "exact" }).in("turma_id", turmaIds);
            deletedAlunos = countAlunos || 0;

            // Deletar turmas do ano
            const { count: countTurmas } = await supabaseAdmin
                .from("turmas").delete({ count: "exact" }).eq("ano_letivo_id", ano_letivo_id);
            deletedTurmas = countTurmas || 0;

            // Atualizar status do ano
            await supabaseAdmin.from("anos_letivos")
                .update({ status: "arquivado" }).eq("id", ano_letivo_id);
        }

        // 18. Audit log
        await supabaseAdmin.from("audit_logs").insert({
            action: "ARQUIVAR_ANO_LETIVO",
            user_email: user.email,
            details: `Ano ${anoLetivo.nome} arquivado. ` +
                `Turmas: ${turmas.length}, Alunos: ${totalAlunos}, Presenças: ${totalRegistros}. ` +
                `Deletados: ${deletedPresencas} presenças, ${deletedAlunos} alunos, ${deletedTurmas} turmas.`,
            type: "success",
        });

        return new Response(
            JSON.stringify({
                success: true,
                message: confirmar_exclusao
                    ? `Arquivado com sucesso! ${deletedTurmas} turmas, ${deletedAlunos} alunos e ${deletedPresencas} presenças removidos.`
                    : "Dados preparados para arquivamento. Chame novamente com confirmar_exclusao=true para finalizar.",
                archive_path: basePath,
                stats: archiveData.metadata.stats,
                deleted: { turmas: deletedTurmas, alunos: deletedAlunos, presencas: deletedPresencas }
            }),
            { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
        );

    } catch (error) {
        console.error("Erro:", error);
        return new Response(
            JSON.stringify({ success: false, error: (error as Error).message }),
            { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
        );
    }
});
