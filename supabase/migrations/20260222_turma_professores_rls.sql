-- =============================================================================
-- Migration: RLS Policies para turma_professores
-- Date: 2026-02-22
-- Description: Adiciona policies de SELECT, INSERT e DELETE para a tabela
--              turma_professores. Permite que admin/diretor/coordenador/secretario
--              gerenciem os vínculos professor-turma.
-- =============================================================================

-- Garantir que RLS está habilitado
ALTER TABLE public.turma_professores ENABLE ROW LEVEL SECURITY;

-- Drop policies antigas se existirem
DROP POLICY IF EXISTS "turma_professores_select" ON public.turma_professores;
DROP POLICY IF EXISTS "turma_professores_insert" ON public.turma_professores;
DROP POLICY IF EXISTS "turma_professores_delete" ON public.turma_professores;
DROP POLICY IF EXISTS "turma_professores_update" ON public.turma_professores;

-- SELECT: Membros da escola podem ver os vínculos professor-turma
CREATE POLICY "turma_professores_select" ON public.turma_professores
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.escola_id = turma_professores.escola_id
        )
    );

-- INSERT: Admin, Diretor, Coordenador e Secretário podem vincular professores
CREATE POLICY "turma_professores_insert" ON public.turma_professores
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.escola_id = turma_professores.escola_id
            AND ur.role IN ('admin', 'diretor', 'coordenador', 'secretario', 'super_admin')
        )
    );

-- UPDATE: Admin, Diretor, Coordenador e Secretário podem atualizar vínculos
CREATE POLICY "turma_professores_update" ON public.turma_professores
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.escola_id = turma_professores.escola_id
            AND ur.role IN ('admin', 'diretor', 'coordenador', 'secretario', 'super_admin')
        )
    );

-- DELETE: Admin, Diretor, Coordenador e Secretário podem desvincular professores
CREATE POLICY "turma_professores_delete" ON public.turma_professores
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.escola_id = turma_professores.escola_id
            AND ur.role IN ('admin', 'diretor', 'coordenador', 'secretario', 'super_admin')
        )
    );

-- Garantir permissões de tabela
GRANT SELECT, INSERT, UPDATE, DELETE ON public.turma_professores TO authenticated;

-- Forçar reload do schema cache
NOTIFY pgrst, 'reload schema';
