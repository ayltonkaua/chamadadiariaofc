-- ============================================================================
-- Migration: 017_add_cache_version_rpc.sql
-- Purpose: Create RPC for cache versioning (ETag pattern)
-- ChamadaDiária v2.1.0
-- 
-- This enables efficient cache invalidation without Realtime subscriptions:
-- 1. App stores cache_version locally
-- 2. On open/refocus, calls get_cache_version()
-- 3. If hash differs → invalidate cache, reload
-- 4. If same → use existing cache
-- ============================================================================

-- ============================================================================
-- 1. RPC: GET CACHE VERSION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_cache_version(p_escola_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT jsonb_build_object(
        -- Hash of all aluno IDs (changes when alunos added/removed)
        'alunos_hash', COALESCE(
            md5(string_agg(a.id::text, '' ORDER BY a.id)),
            'empty'
        ),
        'alunos_count', COUNT(a.id),
        
        -- Hash of all turma IDs
        'turmas_hash', COALESCE(
            (SELECT md5(string_agg(t.id::text, '' ORDER BY t.id)) 
             FROM turmas t WHERE t.escola_id = p_escola_id),
            'empty'
        ),
        'turmas_count', (SELECT COUNT(*) FROM turmas t WHERE t.escola_id = p_escola_id),
        
        -- Last update timestamp (using created_at since updated_at may not exist)
        'last_aluno_update', COALESCE(
            (SELECT MAX(created_at) FROM alunos WHERE escola_id = p_escola_id),
            NOW()
        ),
        'last_turma_update', COALESCE(
            (SELECT MAX(created_at) FROM turmas WHERE escola_id = p_escola_id),
            NOW()
        ),
        
        -- Server timestamp for sync reference
        'server_time', NOW()
    )
    FROM alunos a
    WHERE a.escola_id = p_escola_id;
$$;

COMMENT ON FUNCTION public.get_cache_version IS 
'Returns hashes and counts for cache validation. Compare with local cache to determine if refresh needed.';

-- ============================================================================
-- 2. GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.get_cache_version TO authenticated;
