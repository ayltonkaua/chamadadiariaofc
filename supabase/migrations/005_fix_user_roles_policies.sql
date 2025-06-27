-- Corrigir políticas da tabela user_roles para permitir criação de registros
-- Esta migração resolve o problema de RLS ao criar escolas

-- Remover políticas existentes que podem estar causando conflito
DROP POLICY IF EXISTS "Users can insert their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;

-- Política mais permissiva para inserção - usuários autenticados podem inserir seus próprios registros
CREATE POLICY "Users can insert their own roles" ON public.user_roles
    FOR INSERT
    WITH CHECK (
        auth.uid() = user_id 
        AND auth.uid() IS NOT NULL
    );

-- Política para usuários visualizarem seus próprios dados
CREATE POLICY "Users can view their own roles" ON public.user_roles
    FOR SELECT
    USING (
        auth.uid() = user_id 
        AND auth.uid() IS NOT NULL
    );

-- Política para usuários atualizarem seus próprios dados
CREATE POLICY "Users can update their own roles" ON public.user_roles
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Política para administradores gerenciarem todos os dados
CREATE POLICY "Admins can manage all roles" ON public.user_roles
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.role = 'admin'
        )
    );

-- Política adicional para permitir inserção quando o usuário não tem registro ainda
-- (necessário para o primeiro acesso)
CREATE POLICY "Allow first time user registration" ON public.user_roles
    FOR INSERT
    WITH CHECK (
        auth.uid() = user_id 
        AND auth.uid() IS NOT NULL
        AND NOT EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid()
        )
    );

-- Comentário explicativo
COMMENT ON TABLE public.user_roles IS 'Tabela para gerenciar roles e permissões dos usuários por escola';
COMMENT ON COLUMN public.user_roles.user_id IS 'ID do usuário em auth.users';
COMMENT ON COLUMN public.user_roles.escola_id IS 'ID da escola em escola_configuracao';
COMMENT ON COLUMN public.user_roles.role IS 'Role do usuário: admin, diretor, coordenador, professor, secretario'; 