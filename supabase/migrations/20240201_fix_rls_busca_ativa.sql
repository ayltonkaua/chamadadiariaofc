-- ============================================================================
-- CORREÇÃO RLS: registros_contato_busca_ativa
-- Execute este script no Supabase SQL Editor
-- ============================================================================

-- 1. Habilitar RLS (se não estiver)
ALTER TABLE public.registros_contato_busca_ativa ENABLE ROW LEVEL SECURITY;

-- 2. Remover políticas antigas (se existirem)
DROP POLICY IF EXISTS "Usuarios podem ver registros de busca ativa da sua escola" ON public.registros_contato_busca_ativa;
DROP POLICY IF EXISTS "Usuarios podem criar registros de busca ativa" ON public.registros_contato_busca_ativa;
DROP POLICY IF EXISTS "Usuarios podem atualizar registros de busca ativa da sua escola" ON public.registros_contato_busca_ativa;
DROP POLICY IF EXISTS "Usuarios podem deletar registros de busca ativa da sua escola" ON public.registros_contato_busca_ativa;

-- 3. Criar políticas de SELECT (leitura)
CREATE POLICY "Usuarios podem ver registros de busca ativa da sua escola" 
ON public.registros_contato_busca_ativa 
FOR SELECT 
USING (
    escola_id IN (
        SELECT ur.escola_id 
        FROM public.user_roles ur 
        WHERE ur.user_id = auth.uid()
    )
);

-- 4. Criar políticas de INSERT (criação)
CREATE POLICY "Usuarios podem criar registros de busca ativa" 
ON public.registros_contato_busca_ativa 
FOR INSERT 
WITH CHECK (
    escola_id IN (
        SELECT ur.escola_id 
        FROM public.user_roles ur 
        WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin', 'admin', 'diretor', 'coordenador', 'professor', 'secretario')
    )
);

-- 5. Criar políticas de UPDATE (atualização)
CREATE POLICY "Usuarios podem atualizar registros de busca ativa da sua escola" 
ON public.registros_contato_busca_ativa 
FOR UPDATE 
USING (
    escola_id IN (
        SELECT ur.escola_id 
        FROM public.user_roles ur 
        WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin', 'admin', 'diretor', 'coordenador', 'professor', 'secretario')
    )
);

-- 6. Criar políticas de DELETE (exclusão)
CREATE POLICY "Usuarios podem deletar registros de busca ativa da sua escola" 
ON public.registros_contato_busca_ativa 
FOR DELETE 
USING (
    escola_id IN (
        SELECT ur.escola_id 
        FROM public.user_roles ur 
        WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin', 'admin', 'diretor', 'coordenador')
    )
);

-- ============================================================================
-- VERIFICAÇÃO
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE 'RLS para registros_contato_busca_ativa configurado com sucesso!';
END $$;
