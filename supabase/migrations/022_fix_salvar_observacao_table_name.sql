-- ============================================================================
-- FIX: Atualizar RPC salvar_observacao para usar tabela correta
-- Executar no SQL Editor do Supabase Dashboard
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
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'not_authenticated',
            'message', 'Usuário não autenticado'
        );
    END IF;
    
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
    
    IF v_escola_id != p_escola_id THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'unauthorized_escola',
            'message', 'Escola não corresponde ao usuário'
        );
    END IF;

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

    -- CORRIGIDO: Usar tabela observacoes_alunos (não observacoes)
    INSERT INTO observacoes_alunos (
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

    RETURN jsonb_build_object(
        'success', TRUE,
        'status', 'created',
        'message', 'Observação salva com sucesso',
        'observacao_id', v_observacao_id,
        'idempotency_key', p_idempotency_key
    );

EXCEPTION
    WHEN unique_violation THEN
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
