-- =============================================================================
-- Migration: Perfil Socioeconômico dos Alunos + Coordenadas
-- Date: 2026-02-22
-- Description: Adiciona campos socioeconômicos e de geolocalização para
--              combate à evasão escolar e mapa de alunos
-- =============================================================================

-- =============================================
-- 1. Novos campos na tabela ALUNOS
-- =============================================
ALTER TABLE public.alunos
    ADD COLUMN IF NOT EXISTS trabalha boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS recebe_pe_de_meia boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS recebe_bolsa_familia boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS mora_com_familia boolean DEFAULT true,
    ADD COLUMN IF NOT EXISTS usa_transporte boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS tem_passe_livre boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS latitude double precision,
    ADD COLUMN IF NOT EXISTS longitude double precision,
    ADD COLUMN IF NOT EXISTS telefone_aluno text;

-- =============================================
-- 2. Novos campos na tabela ESCOLA_CONFIGURACAO
-- =============================================
ALTER TABLE public.escola_configuracao
    ADD COLUMN IF NOT EXISTS latitude double precision,
    ADD COLUMN IF NOT EXISTS longitude double precision;

-- =============================================
-- 3. Índice para consultas geoespaciais
-- =============================================
CREATE INDEX IF NOT EXISTS idx_alunos_coordinates
    ON public.alunos (escola_id)
    WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- =============================================
-- 4. Forçar reload do schema cache do PostgREST
-- =============================================
NOTIFY pgrst, 'reload schema';
