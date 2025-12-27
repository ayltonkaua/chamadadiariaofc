-- ============================================================================
-- Migration: 016_add_salvar_observacao_rpc.sql
-- Purpose: Create secure RPC for saving student observations with idempotency
-- ChamadaDiária v2.1.0
-- ============================================================================

-- ============================================================================
-- 1. TABELA DE LOG DE SINCRONIZAÇÃO DE OBSERVAÇÕES (Idempotência)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.observacoes_sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key TEXT NOT NULL,
    escola_id UUID NOT NULL REFERENCES public.escola_configuracao(id) ON DELETE CASCADE,
    aluno_id UUID NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
    turma_id UUID NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    synced_by UUID REFERENCES auth.users(id),
    client_timestamp BIGINT,
    
    -- Constraint de unicidade para idempotência
    CONSTRAINT observacoes_sync_log_idempotency_key_unique UNIQUE (idempotency_key)
);

COMMENT ON TABLE public.observacoes_sync_log IS 'Log de observações sincronizadas para garantir idempotência';

-- Índice para busca por escola (RLS)
CREATE INDEX IF NOT EXISTS idx_observacoes_sync_log_escola 
    ON public.observacoes_sync_log(escola_id);

-- ============================================================================
-- 2. RLS PARA TABELA DE SYNC LOG
-- ============================================================================

ALTER TABLE public.observacoes_sync_log ENABLE ROW LEVEL SECURITY;

-- Drop policies existentes se houver
DROP POLICY IF EXISTS "observacoes_sync_log_select_escola" ON public.observacoes_sync_log;
DROP POLICY IF EXISTS "observacoes_sync_log_insert_rpc" ON public.observacoes_sync_log;

-- Leitura: apenas da própria escola
CREATE POLICY "observacoes_sync_log_select_escola" ON public.observacoes_sync_log
    FOR SELECT
    USING (escola_id IN (
        SELECT ur.escola_id FROM user_roles ur WHERE ur.user_id = auth.uid()
    ));

-- Inserção: bloqueada diretamente, apenas via RPC
CREATE POLICY "observacoes_sync_log_insert_rpc" ON public.observacoes_sync_log
    FOR INSERT
    WITH CHECK (FALSE);

-- ============================================================================
-- 3. RPC: SALVAR OBSERVAÇÃO (SECURITY DEFINER)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.salvar_observacao(
    p_idempotency_key TEXT,
    p_escola_id UUID,
    p_turma_id UUID,
    p_aluno_id UUID,
    p_user_id UUID,
    p_data_observacao DATE,
    p_titulo TEXT,
    p_descricao TEXT,
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
    v_already_exists BOOLEAN := FALSE;
    v_observacao_id UUID;
BEGIN
    -- ========================================================================
    -- 1. EXTRAIR CONTEXTO DO JWT
    -- ========================================================================
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'not_authenticated',
            'message', 'Usuário não autenticado'
        );
    END IF;
    
    -- Get escola_id from user_roles
    SELECT escola_id INTO v_escola_id
    FROM user_roles
    WHERE user_id = v_user_id
    LIMIT 1;
    
    IF v_escola_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'escola_id_missing',
            'message', 'Usuário não possui escola associada'
        );
    END IF;
    
    -- Verify escola matches
    IF v_escola_id != p_escola_id THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'unauthorized_escola',
            'message', 'Escola não corresponde ao usuário'
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
    
    IF p_aluno_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'invalid_aluno_id',
            'message', 'ID do aluno obrigatório'
        );
    END IF;
    
    IF p_titulo IS NULL OR p_titulo = '' THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'invalid_titulo',
            'message', 'Título da observação obrigatório'
        );
    END IF;

    -- ========================================================================
    -- 3. VERIFICAR IDEMPOTÊNCIA
    -- ========================================================================
    SELECT EXISTS (
        SELECT 1 FROM observacoes_sync_log 
        WHERE idempotency_key = p_idempotency_key
    ) INTO v_already_exists;
    
    IF v_already_exists THEN
        RETURN jsonb_build_object(
            'success', TRUE,
            'status', 'already_synced',
            'message', 'Observação já sincronizada anteriormente',
            'idempotency_key', p_idempotency_key
        );
    END IF;

    -- ========================================================================
    -- 4. INSERIR OBSERVAÇÃO
    -- ========================================================================
    INSERT INTO observacoes (
        aluno_id,
        turma_id,
        escola_id,
        user_id,
        data_observacao,
        titulo,
        descricao
    ) VALUES (
        p_aluno_id,
        p_turma_id,
        v_escola_id,
        p_user_id,
        p_data_observacao,
        p_titulo,
        p_descricao
    )
    RETURNING id INTO v_observacao_id;

    -- ========================================================================
    -- 5. REGISTRAR LOG DE SINCRONIZAÇÃO
    -- ========================================================================
    INSERT INTO observacoes_sync_log (
        idempotency_key,
        escola_id,
        aluno_id,
        turma_id,
        synced_by,
        client_timestamp
    ) VALUES (
        p_idempotency_key,
        v_escola_id,
        p_aluno_id,
        p_turma_id,
        v_user_id,
        p_client_timestamp
    );

    -- ========================================================================
    -- 6. RETORNO DE SUCESSO
    -- ========================================================================
    RETURN jsonb_build_object(
        'success', TRUE,
        'status', 'created',
        'message', 'Observação salva com sucesso',
        'observacao_id', v_observacao_id,
        'idempotency_key', p_idempotency_key
    );

EXCEPTION
    WHEN unique_violation THEN
        -- Conflito de idempotência (race condition resolvida)
        RETURN jsonb_build_object(
            'success', TRUE,
            'status', 'already_synced',
            'message', 'Observação processada por outra transação',
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

COMMENT ON FUNCTION public.salvar_observacao IS 
'RPC segura para salvar observação de aluno. Garante atomicidade e idempotência.';

-- ============================================================================
-- 4. GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.salvar_observacao TO authenticated;
GRANT SELECT ON public.observacoes_sync_log TO authenticated;
