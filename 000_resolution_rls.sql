-- ============================================================================
-- SCRIPT DE RESOLUÇÃO DEFINITIVA (ERRO DE RECURSÃO INFINITA)
-- ============================================================================
-- O erro "infinite recursion detected" ocorre quando as Políticas da tabela 
-- consultam a própria tabela para tomarem decisões, gerando um loop eterno.
-- A solução oficial do PostgREST é isolar a consulta em funções seguras 
-- (SECURITY DEFINER) que burlam o loop para entregar o ID exato.
-- ============================================================================

-- 1. Criação das Funções de Túnel Seguro (Security Definer)
CREATE OR REPLACE FUNCTION public.get_auth_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_auth_user_escola_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT escola_id FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- 2. Limpeza das Políticas Causadoras do Loop
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can insert their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can update their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;

DROP POLICY IF EXISTS "Usuários podem ver turmas de sua escola" ON public.turmas;
DROP POLICY IF EXISTS "Usuários podem inserir turmas em sua escola" ON public.turmas;
DROP POLICY IF EXISTS "Usuários podem atualizar turmas de sua escola" ON public.turmas;
DROP POLICY IF EXISTS "Usuários podem deletar turmas de sua escola" ON public.turmas;
DROP POLICY IF EXISTS "Acesso as turmas (Escola Local)" ON public.turmas;

DROP POLICY IF EXISTS "Usuários podem ver presenças de sua escola" ON public.presencas;
DROP POLICY IF EXISTS "Usuários podem inserir presenças em sua escola" ON public.presencas;
DROP POLICY IF EXISTS "Usuários podem atualizar presenças de sua escola" ON public.presencas;
DROP POLICY IF EXISTS "Usuários podem deletar presenças de sua escola" ON public.presencas;
DROP POLICY IF EXISTS "Acesso as presencas (Escola Local)" ON public.presencas;

DROP POLICY IF EXISTS "Usuários podem ver alunos de sua escola" ON public.alunos;
DROP POLICY IF EXISTS "Usuários podem gerenciar alunos de sua escola" ON public.alunos;
DROP POLICY IF EXISTS "Acesso aos alunos (Escola Local)" ON public.alunos;

DROP POLICY IF EXISTS "Ver observacoes_alunos (Escola Local)" ON public.observacoes_alunos;
DROP POLICY IF EXISTS "Users can view observations for their school" ON public.observacoes_alunos;
DROP POLICY IF EXISTS "Users can create observations for their school" ON public.observacoes_alunos;
DROP POLICY IF EXISTS "Users can update their own observations" ON public.observacoes_alunos;
DROP POLICY IF EXISTS "Users can delete their own observations" ON public.observacoes_alunos;
DROP POLICY IF EXISTS "Acesso as observacoes (Escola Local)" ON public.observacoes_alunos;

-- 3. Aplicação das Novas Políticas (Usando o Túnel)
-- Tabela: user_roles
CREATE POLICY "Leitura Pessoal de Papel" ON public.user_roles
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Acesso de Admin a todos os papeis" ON public.user_roles
    FOR ALL USING (public.get_auth_user_role() IN ('admin', 'diretor', 'super_admin'));

-- Tabela: turmas
CREATE POLICY "Acesso as turmas da Escola Local" ON public.turmas 
    FOR ALL USING (escola_id = public.get_auth_user_escola_id())
    WITH CHECK (escola_id = public.get_auth_user_escola_id());

-- Tabela: presencas
CREATE POLICY "Acesso as presencas da Escola Local" ON public.presencas 
    FOR ALL USING (escola_id = public.get_auth_user_escola_id())
    WITH CHECK (escola_id = public.get_auth_user_escola_id());

-- Tabela: alunos
CREATE POLICY "Acesso aos alunos da Escola Local" ON public.alunos 
    FOR ALL USING (escola_id = public.get_auth_user_escola_id())
    WITH CHECK (escola_id = public.get_auth_user_escola_id());

-- Tabela: observacoes_alunos
CREATE POLICY "Acesso as observacoes da Escola Local" ON public.observacoes_alunos 
    FOR ALL USING (escola_id = public.get_auth_user_escola_id())
    WITH CHECK (escola_id = public.get_auth_user_escola_id());

NOTIFY pgrst, 'reload schema';
