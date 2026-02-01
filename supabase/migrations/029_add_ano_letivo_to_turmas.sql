-- ============================================================================
-- Migration: 029_add_ano_letivo_to_turmas.sql
-- Purpose: Link classes to academic years
-- ChamadaDiária v2.1.0
-- ============================================================================

-- ============================================================================
-- 1. ADD FOREIGN KEY TO TURMAS
-- ============================================================================

-- Add column (nullable initially to allow migration)
ALTER TABLE public.turmas 
ADD COLUMN IF NOT EXISTS ano_letivo_id uuid REFERENCES public.anos_letivos(id);

-- Performance index
CREATE INDEX IF NOT EXISTS idx_turmas_ano_letivo 
ON public.turmas(ano_letivo_id);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_turmas_escola_ano 
ON public.turmas(escola_id, ano_letivo_id);

-- ============================================================================
-- 2. COMMENTS
-- ============================================================================

COMMENT ON COLUMN public.turmas.ano_letivo_id IS 'Referência ao ano letivo da turma';
