-- Adicionar campo escola_id à tabela turmas
ALTER TABLE public.turmas 
ADD COLUMN escola_id UUID REFERENCES public.escola_configuracao(id) ON DELETE CASCADE;

-- Adicionar comentário
COMMENT ON COLUMN public.turmas.escola_id IS 'ID da escola em escola_configuracao';

-- Criar índice para melhor performance
CREATE INDEX idx_turmas_escola_id ON public.turmas(escola_id);

-- Habilitar RLS na tabela turmas
ALTER TABLE public.turmas ENABLE ROW LEVEL SECURITY;

-- Política para permitir que usuários vejam apenas turmas de sua escola
CREATE POLICY "Usuários podem ver turmas de sua escola" ON public.turmas
    FOR SELECT USING (
        escola_id IN (
            SELECT escola_id 
            FROM public.user_roles 
            WHERE user_id = auth.uid()
        )
    );

-- Política para permitir que usuários insiram turmas em sua escola
CREATE POLICY "Usuários podem inserir turmas em sua escola" ON public.turmas
    FOR INSERT WITH CHECK (
        escola_id IN (
            SELECT escola_id 
            FROM public.user_roles 
            WHERE user_id = auth.uid()
        )
    );

-- Política para permitir que usuários atualizem turmas de sua escola
CREATE POLICY "Usuários podem atualizar turmas de sua escola" ON public.turmas
    FOR UPDATE USING (
        escola_id IN (
            SELECT escola_id 
            FROM public.user_roles 
            WHERE user_id = auth.uid()
        )
    );

-- Política para permitir que usuários deletem turmas de sua escola
CREATE POLICY "Usuários podem deletar turmas de sua escola" ON public.turmas
    FOR DELETE USING (
        escola_id IN (
            SELECT escola_id 
            FROM public.user_roles 
            WHERE user_id = auth.uid()
        )
    ); 