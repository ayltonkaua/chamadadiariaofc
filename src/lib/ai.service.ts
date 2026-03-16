/**
 * AI Service — Evasão Escolar
 * 
 * Módulo com:
 * 1. Cálculo LOCAL de score de risco (sem API, sem limite)
 * 2. Análise por IA via Edge Function (Groq → Gemini fallback)
 * 3. Controle de uso diário por usuário
 */

import { supabase } from '@/integrations/supabase/client';

// ============================================
// TYPES
// ============================================

export interface RegistroBuscaAtiva {
    dataContato: string;
    formaContato: string;
    justificativaFaltas: string | null;
    monitorResponsavel: string | null;
}

export interface DadosAluno {
    id: string;
    nome: string;
    turma_nome: string;
    frequencia: number;           // 0-100
    total_chamadas: number;
    total_presencas: number;
    faltas: number;
    trabalha: boolean;
    recebe_pe_de_meia: boolean;
    recebe_bolsa_familia: boolean;
    mora_com_familia: boolean;
    usa_transporte: boolean;
    tem_passe_livre: boolean;
    distancia_km: number | null;
    data_nascimento: string | null;
    endereco: string | null;
    registrosBuscaAtiva?: RegistroBuscaAtiva[];
}

export interface FatorRisco {
    fator: string;
    peso: number;
    descricao: string;
    icone: string;
}

export interface ResultadoAnalise {
    score: number;
    nivel: 'verde' | 'amarelo' | 'vermelho';
    fatores: FatorRisco[];
    recomendacaoIA?: string;
    modeloUtilizado?: 'groq' | 'gemini' | 'local';
}

// ============================================
// CONSTANTES
// ============================================

const LIMITE_DIARIO: Record<string, number> = {
    admin: 30,
    staff: 30,
    diretor: 30,
    coordenador: 30,
    secretario: 30,
    super_admin: 30,
    professor: 0,
    aluno: 0,
    indefinido: 0,
};

// ============================================
// 1. CÁLCULO LOCAL DO SCORE DE RISCO
// ============================================

export function calcularScoreRisco(aluno: DadosAluno): ResultadoAnalise {
    const fatores: FatorRisco[] = [];
    let score = 0;

    // Frequência (maior peso)
    if (aluno.frequencia < 70) {
        score += 35;
        fatores.push({
            fator: 'Frequência crítica',
            peso: 35,
            descricao: `Frequência de ${aluno.frequencia}% (abaixo de 70%)`,
            icone: 'AlertTriangle',
        });
    } else if (aluno.frequencia < 85) {
        score += 15;
        fatores.push({
            fator: 'Frequência baixa',
            peso: 15,
            descricao: `Frequência de ${aluno.frequencia}% (entre 70-84%)`,
            icone: 'AlertTriangle',
        });
    }

    // Alto número de faltas proporcionais
    if (aluno.total_chamadas > 0) {
        const taxaFalta = (aluno.faltas / aluno.total_chamadas) * 100;
        if (taxaFalta > 40) {
            score += 10;
            fatores.push({
                fator: 'Taxa de faltas elevada',
                peso: 10,
                descricao: `${aluno.faltas} faltas em ${aluno.total_chamadas} chamadas (${Math.round(taxaFalta)}%)`,
                icone: 'XCircle',
            });
        }
    }

    // Trabalha
    if (aluno.trabalha) {
        score += 15;
        fatores.push({
            fator: 'Exerce atividade remunerada',
            peso: 15,
            descricao: 'Aluno que trabalha tem maior risco de abandonar os estudos',
            icone: 'Briefcase',
        });
    }

    // Não mora com a família
    if (!aluno.mora_com_familia) {
        score += 12;
        fatores.push({
            fator: 'Não mora com a família',
            peso: 12,
            descricao: 'Aluno sem suporte familiar tem maior vulnerabilidade',
            icone: 'Home',
        });
    }

    // Sem benefícios sociais (nem Bolsa Família nem Pé-de-Meia)
    if (!aluno.recebe_bolsa_familia && !aluno.recebe_pe_de_meia) {
        score += 8;
        fatores.push({
            fator: 'Sem benefícios sociais',
            peso: 8,
            descricao: 'Não recebe Bolsa Família nem Pé-de-Meia',
            icone: 'HandCoins',
        });
    }

    // Distância grande da escola
    if (aluno.distancia_km !== null && aluno.distancia_km > 10) {
        score += 10;
        fatores.push({
            fator: 'Mora longe da escola',
            peso: 10,
            descricao: `${aluno.distancia_km} km de distância da escola`,
            icone: 'MapPin',
        });
    } else if (aluno.distancia_km !== null && aluno.distancia_km > 5) {
        score += 5;
        fatores.push({
            fator: 'Distância moderada',
            peso: 5,
            descricao: `${aluno.distancia_km} km de distância da escola`,
            icone: 'MapPin',
        });
    }

    // Não usa transporte escolar E mora longe
    if (!aluno.usa_transporte && aluno.distancia_km !== null && aluno.distancia_km > 3) {
        score += 5;
        fatores.push({
            fator: 'Sem transporte escolar',
            peso: 5,
            descricao: 'Mora a mais de 3km e não usa transporte escolar',
            icone: 'Bus',
        });
    }

    // Clamp score to 100
    score = Math.min(100, score);

    // Determine nivel
    let nivel: 'verde' | 'amarelo' | 'vermelho' = 'verde';
    if (score >= 60) nivel = 'vermelho';
    else if (score >= 30) nivel = 'amarelo';

    // Sort fatores by peso descending
    fatores.sort((a, b) => b.peso - a.peso);

    return { score, nivel, fatores };
}

// ============================================
// 2. CONTROLE DE LIMITE DIÁRIO
// ============================================

export async function verificarLimiteDiario(userId: string, userType: string): Promise<{ permitido: boolean; restante: number; limite: number }> {
    const limite = LIMITE_DIARIO[userType] ?? 0;

    if (limite === 0) {
        return { permitido: false, restante: 0, limite: 0 };
    }

    const hoje = new Date().toISOString().split('T')[0];

    const { data } = await (supabase as any)
        .from('uso_ia_diario')
        .select('contagem')
        .eq('user_id', userId)
        .eq('data', hoje)
        .maybeSingle();

    const usado = data?.contagem ?? 0;
    const restante = Math.max(0, limite - usado);

    return { permitido: restante > 0, restante, limite };
}

async function incrementarUsoIA(userId: string, escolaId: string): Promise<void> {
    const hoje = new Date().toISOString().split('T')[0];

    const { data: existing } = await (supabase as any)
        .from('uso_ia_diario')
        .select('id, contagem')
        .eq('user_id', userId)
        .eq('data', hoje)
        .maybeSingle();

    if (existing) {
        await (supabase as any)
            .from('uso_ia_diario')
            .update({ contagem: existing.contagem + 1 })
            .eq('id', existing.id);
    } else {
        await (supabase as any)
            .from('uso_ia_diario')
            .insert({ user_id: userId, escola_id: escolaId, data: hoje, contagem: 1 });
    }
}

// ============================================
// 3. ANÁLISE COM IA (via Supabase Edge Function)
// ============================================
// As APIs de IA (Groq/Gemini) não suportam chamadas
// diretas do navegador (CORS). Por isso, a chamada
// é feita via Edge Function server-side.

function buildPrompt(aluno: DadosAluno, scoreResult: ResultadoAnalise): string {
    const fatoresTexto = scoreResult.fatores.map(f => `- ${f.fator}: ${f.descricao}`).join('\n');

    // Montar seção de Busca Ativa
    let buscaAtivaTexto = '';
    if (aluno.registrosBuscaAtiva && aluno.registrosBuscaAtiva.length > 0) {
        const registros = aluno.registrosBuscaAtiva.map((r, i) => {
            let linha = `${i + 1}. **${r.dataContato}** via ${r.formaContato}`;
            if (r.monitorResponsavel) linha += ` (monitor: ${r.monitorResponsavel})`;
            if (r.justificativaFaltas) linha += `\n   Justificativa: "${r.justificativaFaltas}"`;
            return linha;
        }).join('\n');
        buscaAtivaTexto = `\n## Registros de Busca Ativa (${aluno.registrosBuscaAtiva.length} contatos realizados)\n${registros}`;
    } else {
        buscaAtivaTexto = '\n## Registros de Busca Ativa\nNenhuma busca ativa foi registrada para este aluno.';
    }

    return `Você é um especialista em gestão educacional e combate à evasão escolar no Brasil.

Analise os dados deste aluno e forneça recomendações práticas e acionáveis para a equipe escolar.

## Dados do Aluno
- **Nome:** ${aluno.nome}
- **Turma:** ${aluno.turma_nome}
- **Frequência:** ${aluno.frequencia}% (${aluno.faltas} faltas em ${aluno.total_chamadas} chamadas)
- **Trabalha:** ${aluno.trabalha ? 'Sim' : 'Não'}
- **Mora com a família:** ${aluno.mora_com_familia ? 'Sim' : 'Não'}
- **Recebe Bolsa Família:** ${aluno.recebe_bolsa_familia ? 'Sim' : 'Não'}
- **Recebe Pé-de-Meia:** ${aluno.recebe_pe_de_meia ? 'Sim' : 'Não'}
- **Usa transporte escolar:** ${aluno.usa_transporte ? 'Sim' : 'Não'}
- **Distância da escola:** ${aluno.distancia_km !== null ? `${aluno.distancia_km} km` : 'Não calculada'}
- **Score de risco:** ${scoreResult.score}/100 (${scoreResult.nivel})

## Fatores de Risco Identificados
${fatoresTexto || 'Nenhum fator de risco significativo.'}
${buscaAtivaTexto}

## Instruções
Responda em português brasileiro, de forma objetiva e prática. Use no máximo 250 palavras. Estruture assim:

**Diagnóstico:** (1-2 frases sobre o risco do aluno, levando em conta as informações da busca ativa se disponíveis)

**Ações Recomendadas:**
1. (ação específica e prática, considerando o que já foi feito na busca ativa)
2. (ação específica e prática)
3. (ação específica e prática)

**Encaminhamentos:** (CRAS, Conselho Tutelar, programa social, etc — se aplicável)`;
}

export async function analisarComIA(
    aluno: DadosAluno,
    scoreResult: ResultadoAnalise,
    userId: string,
    escolaId: string,
): Promise<ResultadoAnalise> {
    const prompt = buildPrompt(aluno, scoreResult);

    try {
        const { data, error } = await supabase.functions.invoke('analyze-evasao', {
            body: { prompt },
        });

        if (error) {
            console.error('[AI] Edge Function erro:', error);
            return {
                ...scoreResult,
                recomendacaoIA: '⚠️ Erro ao chamar o serviço de IA. Verifique se a Edge Function está publicada.',
                modeloUtilizado: 'local',
            };
        }

        const texto = data?.texto || null;
        const modelo = (data?.modelo as 'groq' | 'gemini') || 'local';

        if (!texto) {
            return {
                ...scoreResult,
                recomendacaoIA: '⚠️ Não foi possível gerar a análise por IA neste momento. Verifique as chaves de API nos Secrets do Supabase.',
                modeloUtilizado: 'local',
            };
        }

        // Save to database
        await (supabase as any)
            .from('analises_evasao')
            .insert({
                aluno_id: aluno.id,
                escola_id: escolaId,
                score_risco: scoreResult.score,
                nivel: scoreResult.nivel,
                fatores_risco: scoreResult.fatores,
                recomendacao_ia: texto,
                modelo_utilizado: modelo,
                analisado_por: userId,
            });

        // Increment daily usage
        await incrementarUsoIA(userId, escolaId);

        return {
            ...scoreResult,
            recomendacaoIA: texto,
            modeloUtilizado: modelo,
        };
    } catch (err) {
        console.error('[AI] Erro inesperado:', err);
        return {
            ...scoreResult,
            recomendacaoIA: '⚠️ Erro inesperado ao gerar análise. Tente novamente.',
            modeloUtilizado: 'local',
        };
    }
}

// ============================================
// 4. BUSCAR ÚLTIMA ANÁLISE SALVA
// ============================================

export async function buscarUltimaAnalise(alunoId: string): Promise<{
    recomendacao_ia: string;
    modelo_utilizado: string;
    score_risco: number;
    nivel: string;
    fatores_risco: FatorRisco[];
    created_at: string;
} | null> {
    const { data } = await (supabase as any)
        .from('analises_evasao')
        .select('*')
        .eq('aluno_id', alunoId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    return data || null;
}
