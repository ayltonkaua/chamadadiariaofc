-- =============================================
-- MIGRAÇÃO: Tabelas para Análise de Evasão + IA
-- =============================================

-- 1. Tabela de análises de evasão (resultados)
CREATE TABLE IF NOT EXISTS public.analises_evasao (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
    escola_id uuid NOT NULL REFERENCES public.escola_configuracao(id) ON DELETE CASCADE,
    score_risco integer NOT NULL DEFAULT 0 CHECK (score_risco >= 0 AND score_risco <= 100),
    nivel text NOT NULL DEFAULT 'verde' CHECK (nivel IN ('verde', 'amarelo', 'vermelho')),
    fatores_risco jsonb DEFAULT '[]'::jsonb,
    recomendacao_ia text,
    modelo_utilizado text CHECK (modelo_utilizado IN ('groq', 'gemini', 'local')),
    created_at timestamptz DEFAULT now(),
    analisado_por uuid REFERENCES auth.users(id)
);

-- 2. Tabela de controle de uso diário da IA
CREATE TABLE IF NOT EXISTS public.uso_ia_diario (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    escola_id uuid NOT NULL,
    data date NOT NULL DEFAULT CURRENT_DATE,
    contagem integer NOT NULL DEFAULT 1,
    UNIQUE(user_id, data)
);

-- 3. Índices para performance
CREATE INDEX IF NOT EXISTS idx_analises_evasao_aluno ON public.analises_evasao(aluno_id);
CREATE INDEX IF NOT EXISTS idx_analises_evasao_escola ON public.analises_evasao(escola_id);
CREATE INDEX IF NOT EXISTS idx_analises_evasao_nivel ON public.analises_evasao(nivel);
CREATE INDEX IF NOT EXISTS idx_analises_evasao_created ON public.analises_evasao(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_uso_ia_diario_user_data ON public.uso_ia_diario(user_id, data);

-- 4. RLS (Row Level Security)
ALTER TABLE public.analises_evasao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uso_ia_diario ENABLE ROW LEVEL SECURITY;

-- Policy: Usuários podem ver/inserir análises da própria escola
CREATE POLICY analises_evasao_select ON public.analises_evasao
    FOR SELECT USING (
        escola_id IN (SELECT escola_id FROM public.user_roles WHERE user_id = auth.uid())
    );

CREATE POLICY analises_evasao_insert ON public.analises_evasao
    FOR INSERT WITH CHECK (
        escola_id IN (SELECT escola_id FROM public.user_roles WHERE user_id = auth.uid())
    );

-- Policy: Usuários podem ver/atualizar próprio uso diário
CREATE POLICY uso_ia_select ON public.uso_ia_diario
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY uso_ia_insert ON public.uso_ia_diario
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY uso_ia_update ON public.uso_ia_diario
    FOR UPDATE USING (user_id = auth.uid());
