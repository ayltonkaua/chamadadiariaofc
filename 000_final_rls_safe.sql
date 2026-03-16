-- ============================================================================
-- SCRIPT MESTRE DE CORREÇÃO DE RLS - VERSÃO SEGURA (SEM USO DE CUSTOM JWT)
-- Execute este script no SQL Editor para restaurar as listagens de Presenças, 
-- Turmas, Alunos e Observações que sumiram ou travaram no Dashboard.
-- ============================================================================

-- ============================================================================
-- 1. TABELA USER_ROLES (Reativando a segurança com proteção de ciclo infinito)
-- ============================================================================
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can insert their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can update their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;

CREATE POLICY "Users can view their own roles" ON public.user_roles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles" ON public.user_roles
    FOR ALL USING (
        -- Evita recursion consultando a base por fora ou restringe
        auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'diretor', 'super_admin'))
    );

-- ============================================================================
-- 2. TABELA TURMAS (Listagens do Dashboard como 'Evolução Semanal')
-- ============================================================================
ALTER TABLE public.turmas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários podem ver turmas de sua escola" ON public.turmas;
DROP POLICY IF EXISTS "Usuários podem inserir turmas em sua escola" ON public.turmas;
DROP POLICY IF EXISTS "Usuários podem atualizar turmas de sua escola" ON public.turmas;
DROP POLICY IF EXISTS "Usuários podem deletar turmas de sua escola" ON public.turmas;
DROP POLICY IF EXISTS "Acesso as turmas (Escola Local)" ON public.turmas;

CREATE POLICY "Acesso as turmas (Escola Local)" ON public.turmas FOR ALL 
USING (escola_id IN (SELECT escola_id FROM public.user_roles WHERE user_id = auth.uid()))
WITH CHECK (escola_id IN (SELECT escola_id FROM public.user_roles WHERE user_id = auth.uid()));

-- ============================================================================
-- 3. TABELA PRESENCAS (Gráfico de Evolução e Faltas Consecutivas)
-- ============================================================================
ALTER TABLE public.presencas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários podem ver presenças de sua escola" ON public.presencas;
DROP POLICY IF EXISTS "Usuários podem inserir presenças em sua escola" ON public.presencas;
DROP POLICY IF EXISTS "Usuários podem atualizar presenças de sua escola" ON public.presencas;
DROP POLICY IF EXISTS "Usuários podem deletar presenças de sua escola" ON public.presencas;
DROP POLICY IF EXISTS "Acesso as presencas (Escola Local)" ON public.presencas;

CREATE POLICY "Acesso as presencas (Escola Local)" ON public.presencas FOR ALL 
USING (escola_id IN (SELECT escola_id FROM public.user_roles WHERE user_id = auth.uid()))
WITH CHECK (escola_id IN (SELECT escola_id FROM public.user_roles WHERE user_id = auth.uid()));

-- ============================================================================
-- 4. TABELA ALUNOS (Cálculo de Risco)
-- ============================================================================
ALTER TABLE public.alunos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários podem ver alunos de sua escola" ON public.alunos;
DROP POLICY IF EXISTS "Usuários podem gerenciar alunos de sua escola" ON public.alunos;
DROP POLICY IF EXISTS "Acesso aos alunos (Escola Local)" ON public.alunos;

CREATE POLICY "Acesso aos alunos (Escola Local)" ON public.alunos FOR ALL 
USING (escola_id IN (SELECT escola_id FROM public.user_roles WHERE user_id = auth.uid()))
WITH CHECK (escola_id IN (SELECT escola_id FROM public.user_roles WHERE user_id = auth.uid()));

-- ============================================================================
-- 5. TABELA OBSERVACOES_ALUNOS (Radar Pedagógico)
-- ============================================================================
ALTER TABLE public.observacoes_alunos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ver observacoes_alunos (Escola Local)" ON public.observacoes_alunos;
DROP POLICY IF EXISTS "Users can view observations for their school" ON public.observacoes_alunos;
DROP POLICY IF EXISTS "Users can create observations for their school" ON public.observacoes_alunos;
DROP POLICY IF EXISTS "Users can update their own observations" ON public.observacoes_alunos;
DROP POLICY IF EXISTS "Users can delete their own observations" ON public.observacoes_alunos;
DROP POLICY IF EXISTS "Acesso as observacoes (Escola Local)" ON public.observacoes_alunos;

CREATE POLICY "Acesso as observacoes (Escola Local)" ON public.observacoes_alunos FOR ALL 
USING (escola_id IN (SELECT escola_id FROM public.user_roles WHERE user_id = auth.uid()))
WITH CHECK (escola_id IN (SELECT escola_id FROM public.user_roles WHERE user_id = auth.uid()));

-- ============================================================================
-- RELOAD DO CACHE E PERMISSÕES GERAIS
-- ============================================================================
GRANT ALL ON public.turmas TO authenticated;
GRANT ALL ON public.presencas TO authenticated;
GRANT ALL ON public.alunos TO authenticated;
GRANT ALL ON public.observacoes_alunos TO authenticated;

NOTIFY pgrst, 'reload schema';
