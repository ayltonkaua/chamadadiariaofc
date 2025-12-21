-- ============================================================================
-- Migration: 010_secure_chamada_rpcs.sql
-- Purpose: Create secure attendance RPCs with idempotency and atomic operations
-- ChamadaDiária v2.1.0
-- ============================================================================

-- ============================================================================
-- 1. TABELA DE LOG DE SINCRONIZAÇÃO (Idempotência)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.chamadas_sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key TEXT NOT NULL,
    turma_id UUID NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
    escola_id UUID NOT NULL REFERENCES public.escola_configuracao(id) ON DELETE CASCADE,
    data_chamada DATE NOT NULL,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    synced_by UUID REFERENCES auth.users(id),
    registros_count INTEGER NOT NULL DEFAULT 0,
    client_timestamp BIGINT,
    
    -- Constraint de unicidade para idempotência
    CONSTRAINT chamadas_sync_log_idempotency_key_unique UNIQUE (idempotency_key),
    CONSTRAINT chamadas_sync_log_turma_data_unique UNIQUE (turma_id, data_chamada)
);

-- Comentários para documentação
COMMENT ON TABLE public.chamadas_sync_log IS 'Log de chamadas sincronizadas para garantir idempotência';
COMMENT ON COLUMN public.chamadas_sync_log.idempotency_key IS 'SHA-256(escola_id + turma_id + data_chamada)';

-- ============================================================================
-- 2. ÍNDICES PARA PERFORMANCE
-- ============================================================================

-- Índice para busca por escola (RLS)
CREATE INDEX IF NOT EXISTS idx_chamadas_sync_log_escola 
    ON public.chamadas_sync_log(escola_id);

-- Índice para busca por turma + data
CREATE INDEX IF NOT EXISTS idx_chamadas_sync_log_turma_data 
    ON public.chamadas_sync_log(turma_id, data_chamada);

-- Índice para limpeza de logs antigos
CREATE INDEX IF NOT EXISTS idx_chamadas_sync_log_synced_at 
    ON public.chamadas_sync_log(synced_at);

-- Índice composto em presencas para performance da RPC
CREATE INDEX IF NOT EXISTS idx_presencas_turma_escola_data 
    ON public.presencas(turma_id, escola_id, data_chamada);

-- ============================================================================
-- 3. RLS PARA TABELA DE SYNC LOG
-- ============================================================================

ALTER TABLE public.chamadas_sync_log ENABLE ROW LEVEL SECURITY;

-- Drop policies existentes se houver
DROP POLICY IF EXISTS "chamadas_sync_log_select_escola" ON public.chamadas_sync_log;
DROP POLICY IF EXISTS "chamadas_sync_log_insert_rpc" ON public.chamadas_sync_log;

-- Leitura: apenas da própria escola
CREATE POLICY "chamadas_sync_log_select_escola" ON public.chamadas_sync_log
    FOR SELECT
    USING (escola_id = (auth.jwt() -> 'app_metadata' ->> 'escola_id')::UUID);

-- Inserção: bloqueada diretamente, apenas via RPC
CREATE POLICY "chamadas_sync_log_insert_rpc" ON public.chamadas_sync_log
    FOR INSERT
    WITH CHECK (FALSE); -- Sempre falha insert direto

-- ============================================================================
-- 4. RPC: SALVAR CHAMADA (SECURITY DEFINER)
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
    v_already_exists BOOLEAN := FALSE;
    v_registros_count INTEGER;
    v_lock_key BIGINT;
    v_inserted_count INTEGER := 0;
BEGIN
    -- ========================================================================
    -- 1. EXTRAIR CONTEXTO DO JWT
    -- ========================================================================
    v_escola_id := (auth.jwt() -> 'app_metadata' ->> 'escola_id')::UUID;
    v_user_id := auth.uid();
    
    IF v_escola_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'escola_id_missing',
            'message', 'JWT não contém escola_id'
        );
    END IF;
    
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'not_authenticated',
            'message', 'Usuário não autenticado'
        );
    END IF;

    -- ========================================================================
    -- 2. VALIDAR PAYLOAD
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
    -- 3. VALIDAR TURMA PERTENCE À ESCOLA DO JWT
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
    -- 4. ADVISORY LOCK (Evita race condition)
    -- ========================================================================
    -- Cria lock key único baseado em turma + data
    v_lock_key := hashtext(p_turma_id::TEXT || p_data_chamada::TEXT);
    
    -- Tenta adquirir lock (bloqueia outras transações concorrentes)
    PERFORM pg_advisory_xact_lock(v_lock_key);

    -- ========================================================================
    -- 5. VERIFICAR IDEMPOTÊNCIA
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
    -- 6. OPERAÇÃO ATÔMICA: DELETE + INSERT
    -- ========================================================================
    
    -- 6a. Deletar presenças existentes para esta turma/data
    DELETE FROM presencas
    WHERE turma_id = p_turma_id
      AND escola_id = v_escola_id
      AND data_chamada = p_data_chamada;
    
    -- 6b. Inserir novos registros
    WITH inserted AS (
        INSERT INTO presencas (
            aluno_id,
            turma_id,
            escola_id,
            data_chamada,
            presente,
            falta_justificada
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
    -- 7. REGISTRAR LOG DE SINCRONIZAÇÃO
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
        p_idempotency_key,
        p_turma_id,
        v_escola_id,
        p_data_chamada,
        v_user_id,
        v_inserted_count,
        p_client_timestamp
    );

    -- ========================================================================
    -- 8. RETORNO DE SUCESSO
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
        -- Conflito de idempotência (race condition resolvida)
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

-- Comentário da função
COMMENT ON FUNCTION public.salvar_chamada IS 
'RPC segura para salvar chamada de presença. Garante atomicidade, idempotência e isolamento por escola.';

-- ============================================================================
-- 5. RPC: EXCLUIR CHAMADA (SECURITY DEFINER)
-- ============================================================================

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
    v_turma_escola_id UUID;
    v_deleted_count INTEGER;
BEGIN
    -- Extrair escola do JWT
    v_escola_id := (auth.jwt() -> 'app_metadata' ->> 'escola_id')::UUID;
    
    IF v_escola_id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'escola_id_missing');
    END IF;

    -- Validar turma pertence à escola
    SELECT escola_id INTO v_turma_escola_id FROM turmas WHERE id = p_turma_id;
    
    IF v_turma_escola_id IS NULL OR v_turma_escola_id != v_escola_id THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'unauthorized');
    END IF;

    -- Deletar presenças
    DELETE FROM presencas
    WHERE turma_id = p_turma_id
      AND escola_id = v_escola_id
      AND data_chamada = p_data_chamada;
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    -- Remover do log de sync (permite re-sync)
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

-- ============================================================================
-- 6. GRANT PERMISSIONS
-- ============================================================================

-- Permitir chamada das RPCs para usuários autenticados
GRANT EXECUTE ON FUNCTION public.salvar_chamada TO authenticated;
GRANT EXECUTE ON FUNCTION public.excluir_chamada TO authenticated;

-- Permitir leitura do log de sync (para debug/auditoria)
GRANT SELECT ON public.chamadas_sync_log TO authenticated;
