-- SCRIPT DE DIAGNÓSTICO E LIBERAÇÃO GERAL
-- Execute este script no SQL Editor do Supabase.

-- 1. Desativar momentaneamente o RLS para isolarmos se a culpa é dele
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.escola_configuracao DISABLE ROW LEVEL SECURITY;

-- 2. Garantir permissões irrestritas (Read/Write) para o sistema de Auth conseguir autenticar sem ser barrado
GRANT ALL ON public.user_roles TO anon, authenticated, service_role;
GRANT ALL ON public.escola_configuracao TO anon, authenticated, service_role;

-- Se você possuir Custom JWT Hooks ou Triggers do Supabase rodando como supabase_auth_admin, ele precisa dessa permissão:
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
        EXECUTE 'GRANT ALL ON public.user_roles TO supabase_auth_admin';
        EXECUTE 'GRANT ALL ON public.escola_configuracao TO supabase_auth_admin';
    END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
