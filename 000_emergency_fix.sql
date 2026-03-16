-- SCRIPT DE RECUPERAÇÃO DE EMERGÊNCIA (RLS)
-- Execute APENAS este script no SQL Editor para restaurar o acesso à plataforma.

-- 1. Restaurar acesso à tabela user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can insert their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can update their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Allow first time user registration" ON public.user_roles;

CREATE POLICY "Users can view their own roles" ON public.user_roles
    FOR SELECT USING (auth.uid() = user_id AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert their own roles" ON public.user_roles
    FOR INSERT WITH CHECK (auth.uid() = user_id AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own roles" ON public.user_roles
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles" ON public.user_roles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() AND (ur.role = 'admin' OR ur.role = 'super_admin')
        )
    );

CREATE POLICY "Allow first time user registration" ON public.user_roles
    FOR INSERT WITH CHECK (
        auth.uid() = user_id AND auth.uid() IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid())
    );

-- 2. Restaurar acesso público à escola_configuracao
ALTER TABLE public.escola_configuracao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir leitura pública da configuração da escola" ON public.escola_configuracao;

CREATE POLICY "Permitir leitura pública da configuração da escola" ON public.escola_configuracao
    FOR SELECT USING (true);

-- 3. Conceder permissões autenticadas globais ao PostgREST
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT SELECT ON public.escola_configuracao TO anon, authenticated;

-- Forçar recarregamento do cache do Supabase
NOTIFY pgrst, 'reload schema';
