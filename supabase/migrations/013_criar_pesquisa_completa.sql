-- Migration: 013_criar_pesquisa_completa.sql
-- Creates the RPC function for creating complete surveys with questions and destinatarios
-- This RPC was expected by PesquisaCreatePage.tsx but didn't exist

-- ==============================================================================
-- DROP existing function if it exists (to handle return type changes)
-- ==============================================================================
DROP FUNCTION IF EXISTS public.criar_pesquisa_completa(TEXT, TEXT, UUID, JSONB, UUID[]);

-- ==============================================================================
-- FUNCTION: criar_pesquisa_completa
-- Creates a survey with questions and links to all students in selected turmas
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.criar_pesquisa_completa(
    titulo TEXT,
    descricao TEXT,
    escola_id UUID,
    perguntas JSONB,
    turma_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_pesquisa_id UUID;
    v_pergunta JSONB;
    v_pergunta_id UUID;
    v_ordem INT := 0;
    v_turma_id UUID;
    v_aluno_id UUID;
    v_destinatarios_count INT := 0;
BEGIN
    -- Get current user
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Usuário não autenticado'
        );
    END IF;
    
    -- Validate inputs
    IF titulo IS NULL OR trim(titulo) = '' THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Título é obrigatório'
        );
    END IF;
    
    IF perguntas IS NULL OR jsonb_array_length(perguntas) = 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Ao menos uma pergunta é obrigatória'
        );
    END IF;
    
    IF turma_ids IS NULL OR array_length(turma_ids, 1) = 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Ao menos uma turma deve ser selecionada'
        );
    END IF;
    
    -- 1. Create the pesquisa
    INSERT INTO pesquisas (
        user_id,
        titulo,
        descricao,
        escola_id,
        status,
        created_at
    ) VALUES (
        v_user_id,
        trim(titulo),
        trim(COALESCE(descricao, '')),
        escola_id,
        'ativa',
        now()
    )
    RETURNING id INTO v_pesquisa_id;
    
    -- 2. Create perguntas
    FOR v_pergunta IN SELECT * FROM jsonb_array_elements(perguntas)
    LOOP
        v_ordem := v_ordem + 1;
        
        INSERT INTO pesquisa_perguntas (
            pesquisa_id,
            texto_pergunta,
            tipo_pergunta,
            opcoes,
            ordem
        ) VALUES (
            v_pesquisa_id,
            v_pergunta->>'texto_pergunta',
            'multipla_escolha',
            v_pergunta->'opcoes',
            v_ordem
        );
    END LOOP;
    
    -- 3. Add all students from selected turmas as destinatarios
    FOREACH v_turma_id IN ARRAY turma_ids
    LOOP
        FOR v_aluno_id IN 
            SELECT id FROM alunos 
            WHERE turma_id = v_turma_id 
            AND escola_id = criar_pesquisa_completa.escola_id
        LOOP
            -- Insert into pesquisa_destinatarios
            INSERT INTO pesquisa_destinatarios (
                pesquisa_id,
                aluno_id,
                status_resposta
            ) VALUES (
                v_pesquisa_id,
                v_aluno_id,
                'pendente'
            )
            ON CONFLICT (pesquisa_id, aluno_id) DO NOTHING;
            
            v_destinatarios_count := v_destinatarios_count + 1;
        END LOOP;
    END LOOP;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', format('Pesquisa criada com sucesso! %s destinatários adicionados.', v_destinatarios_count),
        'pesquisa_id', v_pesquisa_id,
        'destinatarios_count', v_destinatarios_count
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'message', format('Erro ao criar pesquisa: %s', SQLERRM)
    );
END;
$$;

-- ==============================================================================
-- GRANT PERMISSIONS
-- ==============================================================================

GRANT EXECUTE ON FUNCTION public.criar_pesquisa_completa(TEXT, TEXT, UUID, JSONB, UUID[]) TO authenticated;

-- ==============================================================================
-- COMMENTS
-- ==============================================================================

COMMENT ON FUNCTION public.criar_pesquisa_completa IS 'Creates a complete survey with questions and adds all students from selected turmas as destinatarios';
