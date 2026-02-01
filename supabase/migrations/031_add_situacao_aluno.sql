-- ============================================================================
-- Migration: 031_add_situacao_aluno.sql
-- Purpose: Add student status for year-end migration (approved, failed, etc)
-- ChamadaDiária v2.1.0
-- ============================================================================

-- ============================================================================
-- 1. ADD SITUACAO ENUM TYPE
-- ============================================================================

-- Create enum for student situation
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'situacao_aluno') THEN
        CREATE TYPE situacao_aluno AS ENUM (
            'ativo',        -- Normal, studying
            'aprovado',     -- Approved for next year
            'reprovado',    -- Failed, stays in same grade
            'transferido',  -- Transferred to another school
            'abandono',     -- Dropped out
            'falecido',     -- Deceased
            'cancelado'     -- Registration cancelled
        );
    END IF;
END $$;

-- ============================================================================
-- 2. ADD SITUACAO COLUMN TO ALUNOS
-- ============================================================================

-- Add column with default 'ativo'
ALTER TABLE public.alunos 
ADD COLUMN IF NOT EXISTS situacao text DEFAULT 'ativo'
CHECK (situacao IN ('ativo', 'aprovado', 'reprovado', 'transferido', 'abandono', 'falecido', 'cancelado'));

-- Index for filtering
CREATE INDEX IF NOT EXISTS idx_alunos_situacao ON public.alunos(situacao);

-- ============================================================================
-- 3. COMMENTS
-- ============================================================================

COMMENT ON COLUMN public.alunos.situacao IS 'Situação do aluno: ativo, aprovado, reprovado, transferido, abandono, falecido, cancelado';
