-- ============================================================================
-- Migration: 014_fix_salvar_chamada_escola_from_user_roles.sql
-- Purpose: Fix salvar_chamada to get escola_id from user_roles table
--          instead of JWT app_metadata (which is not set for most users).
--          Keeps Last-Writer-Wins (LWW) idempotency from migration 013.
-- ChamadaDiária v2.1.2
-- ============================================================================

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
    v_existing_timestamp BIGINT;
    v_registros_count INTEGER;
    v_lock_key BIGINT;
    v_inserted_count INTEGER := 0;
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
    -- 2. GET escola_id FROM user_roles TABLE (NOT JWT)
    -- CRITICAL: JWT app_metadata does NOT contain escola_id for most users
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
    -- 3. VALIDAR PAYLOAD
    -- ========================================================================
    IF p_idempotency_key IS NULL OR p_idempotency_key = '' THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_idempotency_key', 'message', 'Chave de idempotência obrigatória');
    END IF;
    
    IF p_turma_id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_turma_id', 'message', 'ID da turma obrigatório');
    END IF;
    
    IF p_data_chamada IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_data_chamada', 'message', 'Data da chamada obrigatória');
    END IF;
    
    IF p_registros IS NULL OR jsonb_array_length(p_registros) = 0 THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'empty_registros', 'message', 'Registros de presença obrigatórios');
    END IF;
    
    v_registros_count := jsonb_array_length(p_registros);

    -- ========================================================================
    -- 4. VALIDAR TURMA PERTENCE À ESCOLA DO USUÁRIO
    -- ========================================================================
    v_turma_escola_id := (SELECT escola_id FROM turmas WHERE id = p_turma_id LIMIT 1);
    
    IF v_turma_escola_id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'turma_not_found', 'message', 'Turma não encontrada');
    END IF;
    
    IF v_turma_escola_id != v_escola_id THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'unauthorized_escola', 'message', 'Turma não pertence à sua escola');
    END IF;

    -- ========================================================================
    -- 5. ADVISORY LOCK (Evita race condition)
    -- ========================================================================
    v_lock_key := hashtext(p_turma_id::TEXT || p_data_chamada::TEXT);
    PERFORM pg_advisory_xact_lock(v_lock_key);

    -- ========================================================================
    -- 6. VERIFICAR IDEMPOTÊNCIA COM LAST-WRITER-WINS
    -- ========================================================================
    v_existing_timestamp := (SELECT client_timestamp FROM chamadas_sync_log WHERE idempotency_key = p_idempotency_key LIMIT 1);
    
    IF v_existing_timestamp IS NOT NULL THEN
        -- Last-Writer-Wins: se o timestamp do client é mais velho ou igual, ignoramos
        IF p_client_timestamp IS NOT NULL AND v_existing_timestamp IS NOT NULL AND p_client_timestamp <= v_existing_timestamp THEN
            RETURN jsonb_build_object(
                'success', TRUE,
                'status', 'already_synced',
                'message', 'Chamada ou edição já sincronizada (' || p_client_timestamp::TEXT || ' <= ' || v_existing_timestamp::TEXT || ')',
                'idempotency_key', p_idempotency_key
            );
        END IF;
        
        -- Se p_client_timestamp > v_existing_timestamp, DEIXAMOS AVANÇAR
        -- Pois é uma edição mais nova sendo sincronizada!
    END IF;

    -- ========================================================================
    -- 7. OPERAÇÃO ATÔMICA: DELETE + INSERT
    -- ========================================================================
    
    -- 7a. Deletar presenças existentes para esta turma/data
    DELETE FROM presencas
    WHERE turma_id = p_turma_id
      AND escola_id = v_escola_id
      AND data_chamada = p_data_chamada;
    
    -- 7b. Inserir novos registros
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
    WHERE (reg->>'aluno_id') IS NOT NULL;
    
    GET DIAGNOSTICS v_inserted_count = ROW_COUNT;

    -- ========================================================================
    -- 8. REGISTRAR OU ATUALIZAR LOG DE SINCRONIZAÇÃO (UPSERT)
    -- ========================================================================
    INSERT INTO chamadas_sync_log (
        idempotency_key,
        turma_id,
        escola_id,
        data_chamada,
        synced_by,
        registros_count,
        client_timestamp
    ) VALUES (
        p_idempotency_key, p_turma_id, v_escola_id, p_data_chamada, v_user_id, v_inserted_count, p_client_timestamp
    )
    ON CONFLICT (idempotency_key) DO UPDATE SET
        synced_at = NOW(),
        synced_by = EXCLUDED.synced_by,
        registros_count = EXCLUDED.registros_count,
        client_timestamp = EXCLUDED.client_timestamp;

    -- ========================================================================
    -- 9. RETORNO DE SUCESSO
    -- ========================================================================
    RETURN jsonb_build_object(
        'success', TRUE,
        'status', 'created',
        'message', 'Chamada salva e atualizada com sucesso',
        'registros_count', v_inserted_count,
        'idempotency_key', p_idempotency_key,
        'turma_id', p_turma_id,
        'data_chamada', p_data_chamada
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', SQLSTATE,
            'message', SQLERRM
        );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.salvar_chamada TO authenticated;
