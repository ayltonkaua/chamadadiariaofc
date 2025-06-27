-- Configuração das políticas de segurança para user_roles
-- Esta migração deve ser executada após a criação da tabela user_roles

-- Habilitar Row Level Security na tabela user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Política para usuários acessarem seus próprios dados
CREATE POLICY "Users can view their own roles" ON public.user_roles
    FOR SELECT
    USING (auth.uid() = user_id);

-- Política para usuários inserirem seus próprios dados (se necessário)
CREATE POLICY "Users can insert their own roles" ON public.user_roles
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Política para usuários atualizarem seus próprios dados (se necessário)
CREATE POLICY "Users can update their own roles" ON public.user_roles
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Política para administradores acessarem todos os dados
CREATE POLICY "Admins can manage all roles" ON public.user_roles
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.role = 'admin'
        )
    );

-- Comentário explicativo
COMMENT ON TABLE public.user_roles IS 'Tabela para gerenciar roles e permissões dos usuários por escola';
COMMENT ON COLUMN public.user_roles.user_id IS 'ID do usuário em auth.users';
COMMENT ON COLUMN public.user_roles.escola_id IS 'ID da escola em escola_configuracao';
COMMENT ON COLUMN public.user_roles.role IS 'Role do usuário: admin, diretor, coordenador, professor, secretario'; 