-- ============================================================================
-- Migration: 027_add_data_nascimento_alunos.sql
-- Purpose: Add birth date field to students table
-- ChamadaDiária v2.1.0
-- ============================================================================

-- Add data_nascimento column to alunos
ALTER TABLE public.alunos 
ADD COLUMN IF NOT EXISTS data_nascimento DATE;

-- Index for birthday queries (e.g., aniversariantes do mês)
CREATE INDEX IF NOT EXISTS idx_alunos_data_nascimento 
ON public.alunos(data_nascimento);

-- Helper function to calculate age
CREATE OR REPLACE FUNCTION calcular_idade(data_nasc DATE)
RETURNS INTEGER AS $$
BEGIN
    IF data_nasc IS NULL THEN
        RETURN NULL;
    END IF;
    RETURN DATE_PART('year', AGE(CURRENT_DATE, data_nasc));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Comment
COMMENT ON COLUMN public.alunos.data_nascimento IS 'Data de nascimento do aluno';
