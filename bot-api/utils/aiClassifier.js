/**
 * AI Intent Classifier — Gemini Flash / Groq Fallback
 * 
 * Classifica a intenção do usuário usando IA para substituir o menu URA rígido.
 * Usado APENAS na primeira mensagem (sem session ativa, sem ticket aberto).
 * 
 * Intents possíveis:
 *   - justificar_falta
 *   - consultar_faltas
 *   - consultar_aula       ← NOVO
 *   - avisar_ausencia       ← NOVO
 *   - consultar_beneficio   ← NOVO
 *   - corrigir_beneficio    ← NOVO
 *   - carteirinha
 *   - boletim
 *   - declaracao
 *   - pe_de_meia
 *   - saudacao
 *   - desconhecido
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

// ═══════════════════════════════════════════════
// Prompt de classificação (compacto para rapidez)
// ═══════════════════════════════════════════════

const SYSTEM_PROMPT = `Você é um classificador de intenções para um bot escolar de WhatsApp no Brasil.
Analise a mensagem do responsável/aluno e retorne APENAS um JSON (sem markdown, sem explicação).

Intenções possíveis:
- "justificar_falta": quer justificar falta PASSADA, atestado, filho faltou, estava doente (falta que JÁ ACONTECEU)
- "avisar_ausencia": avisa que o filho NÃO VAI HOJE ou vai chegar atrasado. Motivos: chuva, febre, dores, médico, problema. Foco no PRESENTE/FUTURO
- "consultar_faltas": quer ver faltas, frequência, quantas faltas, como está a presença
- "consultar_aula": quer saber se hoje tem aula, se vai ter escola, se tem aula amanhã, horário de aula
- "consultar_beneficio": quer saber do meu tênis, benefício, auxílio material, dinheiro caiu, pagamento
- "corrigir_beneficio": quer corrigir dados do benefício, conta errada, CPF errado, dados incorretos do meu tênis
- "carteirinha": carteira de estudante, carteirinha, ID escolar
- "boletim": boletim, notas, histórico escolar, rendimento
- "declaracao": declaração de escolaridade, comprovante de matrícula, declaração
- "pe_de_meia": pé-de-meia, pé de meia, programa pé de meia, auxílio estudantil federal
- "saudacao": apenas cumprimento (oi, olá, bom dia, boa tarde, boa noite) SEM pedido específico
- "desconhecido": não se encaixa em nenhuma das anteriores

DIFERENÇA IMPORTANTE:
- "justificar_falta" = falta que já ocorreu (passado): "ele faltou ontem", "faltou semana passada"
- "avisar_ausencia" = aviso antecipado (presente/futuro): "não vai hoje", "tá com febre não vai", "vai chegar tarde"

Responda SOMENTE com JSON: {"intent":"<intent>","confianca":<0.0-1.0>}

Exemplos:
Msg: "oi bom dia" → {"intent":"saudacao","confianca":0.99}
Msg: "meu filho faltou ontem pq tava doente" → {"intent":"justificar_falta","confianca":0.95}
Msg: "meu filho não vai hoje, tá com febre" → {"intent":"avisar_ausencia","confianca":0.96}
Msg: "vai ter aula hoje?" → {"intent":"consultar_aula","confianca":0.97}
Msg: "hoje tem escola?" → {"intent":"consultar_aula","confianca":0.95}
Msg: "quero o boletim do meu filho" → {"intent":"boletim","confianca":0.92}
Msg: "preciso de uma declaração" → {"intent":"declaracao","confianca":0.90}
Msg: "quantas faltas tem?" → {"intent":"consultar_faltas","confianca":0.93}
Msg: "cadê meu tênis?" → {"intent":"consultar_beneficio","confianca":0.94}
Msg: "o dinheiro do uniforma caiu?" → {"intent":"consultar_beneficio","confianca":0.91}
Msg: "minha conta tá errada no meu tênis" → {"intent":"corrigir_beneficio","confianca":0.93}
Msg: "corrigir dados do benefício" → {"intent":"corrigir_beneficio","confianca":0.95}
Msg: "ele não vai por causa da chuva" → {"intent":"avisar_ausencia","confianca":0.94}`;

// ═══════════════════════════════════════════════
// Regex fallback (quando IA falha)
// ═══════════════════════════════════════════════

const REGEX_PATTERNS = [
    { intent: 'consultar_aula', patterns: [/tem\s+aula/i, /vai\s+ter\s+aula/i, /hoje\s+tem\s+(aula|escola)/i, /hor[aá]rio\s+(de\s+)?aula/i, /tem\s+escola/i] },
    { intent: 'avisar_ausencia', patterns: [/n[aã]o\s+vai\s+hoje/i, /n[aã]o\s+vai\s+ir/i, /n[aã]o\s+vai\s+pra?\s+(escola|aula)/i, /vai\s+chegar\s+(tarde|atrasad)/i, /t[aá]\s+com\s+(febre|dor|gripe|covid)/i, /n[aã]o\s+vai\s+por\s+causa/i, /n[aã]o\s+vai\s+poder\s+ir/i, /meu\s+filho\s+n[aã]o\s+vai/i] },
    { intent: 'consultar_beneficio', patterns: [/meu\s+t[eê]nis/i, /benefi[cí]cio/i, /dinheiro\s+(do|caiu)/i, /aux[ií]lio\s+material/i, /pagamento\s+(do|da)/i, /cad[eê]\s+o\s+(dinheiro|pagamento|t[eê]nis)/i] },
    { intent: 'corrigir_beneficio', patterns: [/corrigir\s+(meu\s+t[eê]nis|dados|benefi)/i, /dados?\s+(errado|incorret|trocar)/i, /conta\s+(errada|incorreta)/i, /cpf\s+(errado|incorret)/i] },
    { intent: 'justificar_falta', patterns: [/justific/i, /atestado/i, /faltou/i, /doente/i, /estava?\s+(doente|enferm|hospital)/i, /motivo\s+(da|de)\s+falta/i] },
    { intent: 'consultar_faltas', patterns: [/quantas?\s+falt/i, /frequ[eê]ncia/i, /faltas?\s+(do|da|tem|meu)/i, /consultar?\s+falt/i, /ver\s+falt/i] },
    { intent: 'carteirinha', patterns: [/carteir(inha|a)\s*(de\s*estudante|escolar)?/i, /id\s+escolar/i] },
    { intent: 'boletim', patterns: [/boletim/i, /notas?/i, /hist[oó]rico\s+escolar/i, /rendimento/i] },
    { intent: 'declaracao', patterns: [/declara[cç][aã]o/i, /comprovante/i, /escolaridade/i, /matr[ií]cula/i] },
    { intent: 'pe_de_meia', patterns: [/p[eé]\s*(de|-)??\s*meia/i, /aux[ií]lio\s+estudantil/i] },
    { intent: 'saudacao', patterns: [/^(oi|ol[aá]|bom\s+dia|boa\s+(tarde|noite)|e\s*a[ií]|hey|ola)\s*[!?.]*$/i] },
];

function classifyByRegex(text) {
    const cleaned = text.trim();
    for (const { intent, patterns } of REGEX_PATTERNS) {
        for (const pattern of patterns) {
            if (pattern.test(cleaned)) {
                return { intent, confianca: 0.70, source: 'regex' };
            }
        }
    }
    return null;
}

// ═══════════════════════════════════════════════
// Chamada Gemini Flash
// ═══════════════════════════════════════════════

async function classifyWithGemini(userMessage) {
    if (!GEMINI_API_KEY) return null;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    try {
        const res = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [
                    { role: 'user', parts: [{ text: `${SYSTEM_PROMPT}\n\nMensagem do usuário: "${userMessage}"` }] }
                ],
                generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 60,
                },
            }),
            signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!res.ok) {
            console.error(`[AI-CLASSIFIER] Gemini HTTP ${res.status}`);
            return null;
        }

        const data = await res.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        return parseAiResponse(rawText, 'gemini');
    } catch (err) {
        clearTimeout(timeout);
        if (err.name === 'AbortError') {
            console.warn('[AI-CLASSIFIER] Gemini timeout (4s)');
        } else {
            console.error('[AI-CLASSIFIER] Gemini error:', err.message);
        }
        return null;
    }
}

// ═══════════════════════════════════════════════
// Chamada Groq (fallback)
// ═══════════════════════════════════════════════

async function classifyWithGroq(userMessage) {
    if (!GROQ_API_KEY) return null;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    try {
        const res = await fetch(GROQ_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: `Mensagem do usuário: "${userMessage}"` },
                ],
                temperature: 0.1,
                max_tokens: 60,
            }),
            signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!res.ok) {
            console.error(`[AI-CLASSIFIER] Groq HTTP ${res.status}`);
            return null;
        }

        const data = await res.json();
        const rawText = data.choices?.[0]?.message?.content || '';
        return parseAiResponse(rawText, 'groq');
    } catch (err) {
        clearTimeout(timeout);
        if (err.name === 'AbortError') {
            console.warn('[AI-CLASSIFIER] Groq timeout (4s)');
        } else {
            console.error('[AI-CLASSIFIER] Groq error:', err.message);
        }
        return null;
    }
}

// ═══════════════════════════════════════════════
// Parser da resposta da IA
// ═══════════════════════════════════════════════

const VALID_INTENTS = [
    'justificar_falta', 'consultar_faltas', 'carteirinha', 
    'boletim', 'declaracao', 'pe_de_meia', 'saudacao', 'desconhecido',
    'consultar_aula', 'avisar_ausencia', 'consultar_beneficio', 'corrigir_beneficio'
];

function parseAiResponse(rawText, source) {
    try {
        let jsonStr = rawText.trim();
        const jsonMatch = jsonStr.match(/\{[\s\S]*?\}/);
        if (jsonMatch) {
            jsonStr = jsonMatch[0];
        }

        const parsed = JSON.parse(jsonStr);
        
        if (parsed.intent && VALID_INTENTS.includes(parsed.intent)) {
            return {
                intent: parsed.intent,
                confianca: parsed.confianca || 0.8,
                source,
            };
        }

        console.warn(`[AI-CLASSIFIER] Intent desconhecida: ${parsed.intent}`);
        return null;
    } catch (err) {
        console.error(`[AI-CLASSIFIER] Erro parse (${source}):`, rawText.substring(0, 100));
        return null;
    }
}

// ═══════════════════════════════════════════════
// Classificador principal (exportado)
// ═══════════════════════════════════════════════

async function classifyIntent(userMessage) {
    const text = (userMessage || '').trim();
    if (!text) return null;

    const startTime = Date.now();

    // 1. Tenta Gemini
    let result = await classifyWithGemini(text);
    if (result && result.confianca >= 0.6) {
        console.log(`🧠 [AI-CLASSIFIER] ${result.source}: "${text.substring(0,40)}..." → ${result.intent} (${(result.confianca * 100).toFixed(0)}%) [${Date.now() - startTime}ms]`);
        return result;
    }

    // 2. Tenta Groq como fallback
    result = await classifyWithGroq(text);
    if (result && result.confianca >= 0.6) {
        console.log(`🧠 [AI-CLASSIFIER] ${result.source}: "${text.substring(0,40)}..." → ${result.intent} (${(result.confianca * 100).toFixed(0)}%) [${Date.now() - startTime}ms]`);
        return result;
    }

    // 3. Tenta regex como último recurso
    const regexResult = classifyByRegex(text);
    if (regexResult) {
        console.log(`🧠 [AI-CLASSIFIER] regex: "${text.substring(0,40)}..." → ${regexResult.intent} (${(regexResult.confianca * 100).toFixed(0)}%) [${Date.now() - startTime}ms]`);
        return regexResult;
    }

    console.log(`🧠 [AI-CLASSIFIER] NENHUM match para: "${text.substring(0,50)}..." [${Date.now() - startTime}ms]`);
    return null;
}

// ═══════════════════════════════════════════════
// Mensagens humanizadas
// ═══════════════════════════════════════════════

function getGreetingMessage() {
    const hour = new Date().getHours() - 3;
    const adjustedHour = hour < 0 ? hour + 24 : hour;
    
    let saudacao;
    if (adjustedHour >= 5 && adjustedHour < 12) saudacao = 'Bom dia';
    else if (adjustedHour >= 12 && adjustedHour < 18) saudacao = 'Boa tarde';
    else saudacao = 'Boa noite';

    return `${saudacao}! 😊 Sou o assistente virtual da escola.\n\nPosso te ajudar com:\n\n📝 *Justificar faltas* do seu filho(a)\n📊 *Consultar faltas* e frequência\n📚 *Saber se hoje tem aula*\n🎓 *Solicitar documentos* (carteirinha, boletim, declaração)\n👟 *Consultar benefícios* (Meu Tênis)\n💰 *Informações sobre Pé-de-Meia*\n\nÉ só me dizer o que precisa! Por exemplo:\n_"Hoje tem aula?" ou "Cadê o meu tênis?"_`;
}

function getUnknownMessage() {
    return `Não consegui entender exatamente o que você precisa 😅\n\nPosso te ajudar com:\n• Justificar faltas\n• Avisar que seu filho não vai hoje\n• Saber se hoje tem aula\n• Consultar frequência\n• Consultar benefícios (Meu Tênis)\n• Solicitar documentos (carteirinha, boletim, declaração)\n• Informações sobre Pé-de-Meia\n\nPode reformular seu pedido? Por exemplo:\n_"Hoje tem aula?" ou "Meu filho não vai hoje"_\n\nOu se preferir, digite um número:\n1️⃣ Justificar Falta\n2️⃣ Carteira de Estudante\n3️⃣ Histórico/Boletim\n4️⃣ Declaração\n5️⃣ Pé-de-Meia\n6️⃣ Consultar Faltas\n7️⃣ Hoje tem aula?\n8️⃣ Consultar Meu Tênis`;
}

module.exports = {
    classifyIntent,
    getGreetingMessage,
    getUnknownMessage
};
