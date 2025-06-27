-- Adicionar campo escola_id à tabela presencas
ALTER TABLE public.presencas 
ADD COLUMN escola_id UUID REFERENCES public.escola_configuracao(id) ON DELETE CASCADE;

-- Adicionar comentário
COMMENT ON COLUMN public.presencas.escola_id IS 'ID da escola em escola_configuracao';

-- Criar índice para melhor performance
CREATE INDEX idx_presencas_escola_id ON public.presencas(escola_id);

-- Habilitar RLS na tabela presencas (se ainda não estiver habilitado)
ALTER TABLE public.presencas ENABLE ROW LEVEL SECURITY;

-- Política para permitir que usuários vejam apenas presenças de sua escola
CREATE POLICY "Usuários podem ver presenças de sua escola" ON public.presencas
    FOR SELECT USING (
        escola_id IN (
            SELECT escola_id 
            FROM public.user_roles 
            WHERE user_id = auth.uid()
        )
    );

-- Política para permitir que usuários insiram presenças em sua escola
CREATE POLICY "Usuários podem inserir presenças em sua escola" ON public.presencas
    FOR INSERT WITH CHECK (
        escola_id IN (
            SELECT escola_id 
            FROM public.user_roles 
            WHERE user_id = auth.uid()
        )
    );

-- Política para permitir que usuários atualizem presenças de sua escola
CREATE POLICY "Usuários podem atualizar presenças de sua escola" ON public.presencas
    FOR UPDATE USING (
        escola_id IN (
            SELECT escola_id 
            FROM public.user_roles 
            WHERE user_id = auth.uid()
        )
    );

-- Política para permitir que usuários deletem presenças de sua escola
CREATE POLICY "Usuários podem deletar presenças de sua escola" ON public.presencas
    FOR DELETE USING (
        escola_id IN (
            SELECT escola_id 
            FROM public.user_roles 
            WHERE user_id = auth.uid()
        )
    ); 