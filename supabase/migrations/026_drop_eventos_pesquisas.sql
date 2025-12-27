-- ============================================================================
-- Migration: 026_drop_eventos_pesquisas.sql
-- Purpose: Remove deprecated eventos and pesquisas modules
-- ChamadaDiária v2.2.0
-- ============================================================================

-- ============================================================================
-- WARNING: This migration is DESTRUCTIVE. Run only after confirming no data
-- is needed from these tables.
-- ============================================================================

-- ============================================================================
-- 1. DROP EVENTOS TABLES (in dependency order)
-- ============================================================================

DROP TABLE IF EXISTS public.eventos_checkins CASCADE;
DROP TABLE IF EXISTS public.eventos_convidados CASCADE;
DROP TABLE IF EXISTS public.eventos_staff CASCADE;
DROP TABLE IF EXISTS public.eventos CASCADE;

-- ============================================================================
-- 2. DROP PESQUISAS TABLES (in dependency order)
-- ============================================================================

DROP TABLE IF EXISTS public.pesquisa_respostas CASCADE;
DROP TABLE IF EXISTS public.pesquisa_perguntas CASCADE;
DROP TABLE IF EXISTS public.pesquisas CASCADE;

-- ============================================================================
-- 3. DROP RELATED FUNCTIONS (if any)
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_eventos_ativos;
DROP FUNCTION IF EXISTS public.get_proximos_eventos;

-- ============================================================================
-- 4. CONFIRMATION
-- ============================================================================

-- To verify, run:
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' 
--   AND table_name LIKE 'evento%' OR table_name LIKE 'pesquisa%';
-- Should return no rows after this migration.
