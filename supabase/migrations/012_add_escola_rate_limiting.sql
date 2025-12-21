-- ============================================================================
-- Migration: 012_add_escola_rate_limiting.sql
-- Purpose: Add rate limiting per escola to prevent DDoS and support 500+ schools
-- ChamadaDiária v2.2.0
-- 
-- DESIGN DECISIONS:
-- 1. Rate limit is per escola_id, NOT per user (multiple users from same escola share limit)
-- 2. Uses sliding window with automatic reset (no cron job needed)
-- 3. Returns JSONB error (not EXCEPTION) to allow proper handling by SyncManager
-- 4. Rate limit failures do NOT rollback other operations
-- 5. Easy to disable by commenting out check_escola_rate_limit call
-- 
-- LIMITS:
-- - Default: 120 requests per minute per escola (2 req/sec average)
-- - This allows sync of 60 chamadas/minute with room for overhead
-- 
-- ROLLBACK PLAN:
-- To disable, simply comment out the PERFORM check_escola_rate_limit calls in RPCs
-- Or DROP FUNCTION check_escola_rate_limit CASCADE;
-- ============================================================================

-- ============================================================================
-- 1. RATE LIMIT CONTROL TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.escola_rate_limit (
    escola_id UUID PRIMARY KEY REFERENCES public.escola_configuracao(id) ON DELETE CASCADE,
    window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    request_count INTEGER NOT NULL DEFAULT 0,
    last_request_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.escola_rate_limit IS 'Rate limiting control per escola for write operations';
COMMENT ON COLUMN public.escola_rate_limit.window_start IS 'Start of current rate limit window';
COMMENT ON COLUMN public.escola_rate_limit.request_count IS 'Number of requests in current window';

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_escola_rate_limit_window 
ON public.escola_rate_limit(window_start);

-- ============================================================================
-- 2. RATE LIMIT CHECK FUNCTION
-- Returns NULL on success, JSONB error object on rate limit exceeded
-- 
-- CRITICAL: This function does NOT throw exceptions to avoid breaking sync flow
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_escola_rate_limit(
    p_escola_id UUID,
    p_limit INTEGER DEFAULT 120,           -- requests per window
    p_window_seconds INTEGER DEFAULT 60    -- window duration
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_current_count INTEGER;
    v_window_start TIMESTAMPTZ;
    v_now TIMESTAMPTZ := NOW();
    v_window_expired BOOLEAN;
BEGIN
    -- Input validation
    IF p_escola_id IS NULL THEN
        RETURN jsonb_build_object(
            'rate_limited', TRUE,
            'error', 'invalid_escola_id',
            'message', 'ID da escola inválido para rate limit'
        );
    END IF;

    -- Upsert rate limit record with atomic increment
    INSERT INTO escola_rate_limit (escola_id, window_start, request_count, last_request_at)
    VALUES (p_escola_id, v_now, 1, v_now)
    ON CONFLICT (escola_id) DO UPDATE SET
        -- Reset window if expired, otherwise increment
        window_start = CASE 
            WHEN escola_rate_limit.window_start + (p_window_seconds || ' seconds')::INTERVAL < v_now 
            THEN v_now 
            ELSE escola_rate_limit.window_start 
        END,
        request_count = CASE 
            WHEN escola_rate_limit.window_start + (p_window_seconds || ' seconds')::INTERVAL < v_now 
            THEN 1  -- Reset to 1 (this request)
            ELSE escola_rate_limit.request_count + 1 
        END,
        last_request_at = v_now
    RETURNING request_count, window_start INTO v_current_count, v_window_start;

    -- Check if limit exceeded
    IF v_current_count > p_limit THEN
        -- Calculate when the window will reset
        RETURN jsonb_build_object(
            'rate_limited', TRUE,
            'error', 'rate_limit_exceeded',
            'message', format('Limite de requisições excedido (%s/%s). Aguarde %s segundos.',
                v_current_count, p_limit,
                EXTRACT(EPOCH FROM (v_window_start + (p_window_seconds || ' seconds')::INTERVAL - v_now))::INTEGER
            ),
            'current_count', v_current_count,
            'limit', p_limit,
            'retry_after_seconds', EXTRACT(EPOCH FROM (v_window_start + (p_window_seconds || ' seconds')::INTERVAL - v_now))::INTEGER,
            'window_resets_at', v_window_start + (p_window_seconds || ' seconds')::INTERVAL
        );
    END IF;

    -- Success: NULL means no rate limit hit
    RETURN NULL;

EXCEPTION
    WHEN OTHERS THEN
        -- On any error, log and allow the request (fail-open for safety)
        RAISE NOTICE '[RateLimit] Error checking rate limit for escola %: % %', p_escola_id, SQLSTATE, SQLERRM;
        RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.check_escola_rate_limit IS 
'Checks and increments rate limit counter for a escola. Returns NULL on success, JSONB error on limit exceeded. Fail-open on errors.';

-- ============================================================================
-- 3. UPDATED RPC: salvar_chamada with rate limiting
-- ============================================================================

DROP FUNCTION IF EXISTS public.salvar_chamada(TEXT, UUID, DATE, JSONB, BIGINT);

CREATE OR REPLACE FUNCTION public.salvar_chamada(
    p_idempotency_key TEXT,
    p_turma_id UUID,
    p_data_chamada DATE,
    p_registros JSONB,
    p_client_timestamp BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_escola_id UUID;
    v_user_id UUID;
    v_turma_escola_id UUID;
    v_already_exists BOOLEAN := FALSE;
    v_registros_count INTEGER;
    v_lock_key BIGINT;
    v_inserted_count INTEGER := 0;
    v_rate_limit_result JSONB;
BEGIN
    -- ========================================================================
    -- 1. GET USER ID FROM AUTH
    -- ========================================================================
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'not_authenticated',
            'message', 'Usuário não autenticado'
        );
    END IF;

    -- ========================================================================
    -- 2. GET escola_id FROM user_roles TABLE
    -- ========================================================================
    SELECT escola_id INTO v_escola_id
    FROM user_roles
    WHERE user_id = v_user_id
    LIMIT 1;
    
    IF v_escola_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'escola_id_missing',
            'message', 'Usuário não está vinculado a nenhuma escola'
        );
    END IF;

    -- ========================================================================
    -- 2.5. RATE LIMIT CHECK (per escola)
    -- To disable: comment out the following block
    -- ========================================================================
    v_rate_limit_result := check_escola_rate_limit(v_escola_id, 120, 60);
    
    IF v_rate_limit_result IS NOT NULL THEN
        -- Rate limit exceeded - return error without throwing exception
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'rate_limit_exceeded',
            'message', v_rate_limit_result->>'message',
            'retry_after_seconds', (v_rate_limit_result->>'retry_after_seconds')::INTEGER,
            'rate_limited', TRUE
        );
    END IF;
    -- END RATE LIMIT CHECK

    -- ========================================================================
    -- 3. VALIDAR PAYLOAD
    -- ========================================================================
    IF p_idempotency_key IS NULL OR p_idempotency_key = '' THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'invalid_idempotency_key',
            'message', 'Chave de idempotência obrigatória'
        );
    END IF;
    
    IF p_turma_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'invalid_turma_id',
            'message', 'ID da turma obrigatório'
        );
    END IF;
    
    IF p_data_chamada IS NULL THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'invalid_data_chamada',
            'message', 'Data da chamada obrigatória'
        );
    END IF;
    
    IF p_registros IS NULL OR jsonb_array_length(p_registros) = 0 THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'empty_registros',
            'message', 'Registros de presença obrigatórios'
        );
    END IF;
    
    v_registros_count := jsonb_array_length(p_registros);

    -- ========================================================================
    -- 4. VALIDAR TURMA PERTENCE À ESCOLA
    -- ========================================================================
    SELECT escola_id INTO v_turma_escola_id
    FROM turmas
    WHERE id = p_turma_id;
    
    IF v_turma_escola_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'turma_not_found',
            'message', 'Turma não encontrada'
        );
    END IF;
    
    IF v_turma_escola_id != v_escola_id THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'unauthorized_escola',
            'message', 'Turma não pertence à sua escola'
        );
    END IF;

    -- ========================================================================
    -- 5. ADVISORY LOCK
    -- ========================================================================
    v_lock_key := hashtext(p_turma_id::TEXT || p_data_chamada::TEXT);
    PERFORM pg_advisory_xact_lock(v_lock_key);

    -- ========================================================================
    -- 6. IDEMPOTENCY CHECK
    -- ========================================================================
    SELECT EXISTS (
        SELECT 1 FROM chamadas_sync_log 
        WHERE idempotency_key = p_idempotency_key
    ) INTO v_already_exists;
    
    IF v_already_exists THEN
        RETURN jsonb_build_object(
            'success', TRUE,
            'status', 'already_synced',
            'message', 'Chamada já sincronizada anteriormente',
            'idempotency_key', p_idempotency_key
        );
    END IF;

    -- ========================================================================
    -- 7. ATOMIC DELETE + INSERT
    -- ========================================================================
    DELETE FROM presencas
    WHERE turma_id = p_turma_id
      AND escola_id = v_escola_id
      AND data_chamada = p_data_chamada;
    
    WITH inserted AS (
        INSERT INTO presencas (
            aluno_id, turma_id, escola_id, data_chamada, presente, falta_justificada
        )
        SELECT 
            (reg->>'aluno_id')::UUID,
            p_turma_id,
            v_escola_id,
            p_data_chamada,
            COALESCE((reg->>'presente')::BOOLEAN, TRUE),
            COALESCE((reg->>'falta_justificada')::BOOLEAN, FALSE)
        FROM jsonb_array_elements(p_registros) AS reg
        WHERE (reg->>'aluno_id') IS NOT NULL
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_inserted_count FROM inserted;

    -- ========================================================================
    -- 8. LOG SYNC
    -- ========================================================================
    INSERT INTO chamadas_sync_log (
        idempotency_key, turma_id, escola_id, data_chamada, synced_by, registros_count, client_timestamp
    ) VALUES (
        p_idempotency_key, p_turma_id, v_escola_id, p_data_chamada, v_user_id, v_inserted_count, p_client_timestamp
    );

    -- ========================================================================
    -- 9. SUCCESS
    -- ========================================================================
    RETURN jsonb_build_object(
        'success', TRUE,
        'status', 'created',
        'message', 'Chamada salva com sucesso',
        'registros_count', v_inserted_count,
        'idempotency_key', p_idempotency_key,
        'turma_id', p_turma_id,
        'data_chamada', p_data_chamada
    );

EXCEPTION
    WHEN unique_violation THEN
        RETURN jsonb_build_object(
            'success', TRUE,
            'status', 'already_synced',
            'message', 'Chamada processada por outra transação',
            'idempotency_key', p_idempotency_key
        );
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', SQLSTATE,
            'message', SQLERRM
        );
END;
$$;

GRANT EXECUTE ON FUNCTION public.salvar_chamada TO authenticated;

-- ============================================================================
-- 4. UPDATED RPC: excluir_chamada with rate limiting
-- ============================================================================

DROP FUNCTION IF EXISTS public.excluir_chamada(UUID, DATE);

CREATE OR REPLACE FUNCTION public.excluir_chamada(
    p_turma_id UUID,
    p_data_chamada DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_escola_id UUID;
    v_user_id UUID;
    v_turma_escola_id UUID;
    v_deleted_count INTEGER;
    v_rate_limit_result JSONB;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'not_authenticated');
    END IF;

    -- Get escola_id from user_roles table
    SELECT escola_id INTO v_escola_id
    FROM user_roles
    WHERE user_id = v_user_id
    LIMIT 1;
    
    IF v_escola_id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'escola_id_missing');
    END IF;

    -- ========================================================================
    -- RATE LIMIT CHECK (per escola)
    -- To disable: comment out the following block
    -- ========================================================================
    v_rate_limit_result := check_escola_rate_limit(v_escola_id, 120, 60);
    
    IF v_rate_limit_result IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'rate_limit_exceeded',
            'message', v_rate_limit_result->>'message',
            'retry_after_seconds', (v_rate_limit_result->>'retry_after_seconds')::INTEGER,
            'rate_limited', TRUE
        );
    END IF;
    -- END RATE LIMIT CHECK

    -- Validate turma belongs to escola
    SELECT escola_id INTO v_turma_escola_id FROM turmas WHERE id = p_turma_id;
    
    IF v_turma_escola_id IS NULL OR v_turma_escola_id != v_escola_id THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'unauthorized');
    END IF;

    -- Delete presencas
    DELETE FROM presencas
    WHERE turma_id = p_turma_id
      AND escola_id = v_escola_id
      AND data_chamada = p_data_chamada;
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    -- Remove from sync log
    DELETE FROM chamadas_sync_log
    WHERE turma_id = p_turma_id
      AND escola_id = v_escola_id
      AND data_chamada = p_data_chamada;

    RETURN jsonb_build_object(
        'success', TRUE,
        'deleted_count', v_deleted_count
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.excluir_chamada TO authenticated;

-- ============================================================================
-- 5. UTILITY: Clear rate limit for a specific escola (admin use)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.reset_escola_rate_limit(p_escola_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM escola_rate_limit WHERE escola_id = p_escola_id;
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'message', 'Rate limit resetado para escola'
    );
END;
$$;

-- Only super_admin should be able to reset rate limits
-- (You may want to add RLS or check role here)

-- ============================================================================
-- 6. CLEANUP: Remove old rate limit entries (optional maintenance)
-- Can be run manually or via cron
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_rate_limit_entries()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_deleted INTEGER;
BEGIN
    -- Remove entries not updated in last 24 hours
    DELETE FROM escola_rate_limit
    WHERE last_request_at < NOW() - INTERVAL '24 hours';
    
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$;
