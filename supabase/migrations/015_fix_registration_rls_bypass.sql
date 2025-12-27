-- Migration: 015_fix_registration_rls_bypass.sql
-- Fixes the registration RPC to bypass RLS when looking up matriculas
-- The issue: verificar_matricula_disponivel uses SECURITY INVOKER, 
-- meaning it runs as 'anon' user and RLS blocks the SELECT on alunos

-- ==============================================================================
-- DROP existing functions
-- ==============================================================================
DROP FUNCTION IF EXISTS public.verificar_matricula_disponivel(TEXT);
DROP FUNCTION IF EXISTS public.vincular_aluno_usuario(TEXT, TEXT);

-- ==============================================================================
-- FUNCTION: verificar_matricula_disponivel 
-- SECURITY DEFINER = runs as function owner (postgres) = bypasses RLS
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.verificar_matricula_disponivel(
    p_matricula TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER  -- Changed from INVOKER to DEFINER to bypass RLS
SET search_path = public
AS $$
DECLARE
    v_aluno RECORD;
    v_matricula_clean TEXT;
BEGIN
    -- Clean and normalize the input
    v_matricula_clean := trim(COALESCE(p_matricula, ''));
    
    -- Empty check
    IF v_matricula_clean = '' THEN
        RETURN jsonb_build_object(
            'exists', false,
            'available', false,
            'message', 'Matrícula não informada.'
        );
    END IF;
    
    -- Case-insensitive search
    -- SECURITY DEFINER ensures this query runs as postgres user, bypassing RLS
    SELECT id, nome, user_id, escola_id, matricula
    INTO v_aluno
    FROM alunos
    WHERE LOWER(trim(matricula)) = LOWER(v_matricula_clean)
    LIMIT 1;
    
    -- Matrícula não existe no sistema
    IF v_aluno.id IS NULL THEN
        RETURN jsonb_build_object(
            'exists', false,
            'available', false,
            'message', 'Matrícula não encontrada no sistema. Verifique se a escola já cadastrou você.'
        );
    END IF;
    
    -- Matrícula existe mas já está vinculada
    IF v_aluno.user_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'exists', true,
            'available', false,
            'message', 'Esta matrícula já possui uma conta vinculada. Use "Esqueci minha senha" se for você.'
        );
    END IF;
    
    -- Matrícula existe e está disponível para vinculação
    RETURN jsonb_build_object(
        'exists', true,
        'available', true,
        'aluno_nome', v_aluno.nome,
        'message', 'Matrícula encontrada! Você pode prosseguir com o cadastro.'
    );
END;
$$;

-- ==============================================================================
-- FUNCTION: vincular_aluno_usuario (already SECURITY DEFINER, but fixing RLS)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.vincular_aluno_usuario(
    p_matricula TEXT,
    p_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_aluno_id UUID;
    v_aluno_user_id UUID;
    v_aluno_nome TEXT;
    v_escola_id UUID;
    v_current_user_id UUID;
    v_matricula_clean TEXT;
BEGIN
    -- Clean input
    v_matricula_clean := trim(COALESCE(p_matricula, ''));
    
    -- Obter o user_id do usuário atual
    v_current_user_id := auth.uid();
    
    IF v_current_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Usuário não autenticado. Por favor, tente novamente.'
        );
    END IF;
    
    -- Buscar o aluno pela matrícula (CASE INSENSITIVE)
    -- SECURITY DEFINER bypasses RLS
    SELECT id, user_id, nome, escola_id 
    INTO v_aluno_id, v_aluno_user_id, v_aluno_nome, v_escola_id
    FROM alunos
    WHERE LOWER(trim(matricula)) = LOWER(v_matricula_clean)
    LIMIT 1;
    
    -- Verificar se a matrícula existe
    IF v_aluno_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Matrícula não encontrada. A escola precisa cadastrar você primeiro.'
        );
    END IF;
    
    -- ⚠️ VERIFICAÇÃO CRÍTICA: Matrícula já vinculada a outro usuário?
    IF v_aluno_user_id IS NOT NULL AND v_aluno_user_id != v_current_user_id THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Esta matrícula já está vinculada a outra conta. Use "Esqueci minha senha" se for você.'
        );
    END IF;
    
    -- Se já está vinculado ao mesmo usuário, sucesso (idempotente)
    IF v_aluno_user_id = v_current_user_id THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', 'Matrícula já vinculada à sua conta.',
            'aluno_id', v_aluno_id
        );
    END IF;
    
    -- Vincular: Atualizar user_id no aluno (bypasses RLS with SECURITY DEFINER)
    UPDATE alunos 
    SET user_id = v_current_user_id
    WHERE id = v_aluno_id;
    
    -- Criar role para o aluno
    INSERT INTO user_roles (user_id, escola_id, role)
    VALUES (v_current_user_id, v_escola_id, 'aluno')
    ON CONFLICT DO NOTHING;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Matrícula vinculada com sucesso!',
        'aluno_id', v_aluno_id,
        'aluno_nome', v_aluno_nome,
        'escola_id', v_escola_id
    );
END;
$$;

-- ==============================================================================
-- GRANT PERMISSIONS
-- ==============================================================================

-- IMPORTANTE: anon users need to be able to call these functions during registration
GRANT EXECUTE ON FUNCTION public.verificar_matricula_disponivel(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.verificar_matricula_disponivel(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vincular_aluno_usuario(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.vincular_aluno_usuario(TEXT, TEXT) TO authenticated;

-- ==============================================================================
-- CREATE INDEX for case-insensitive lookups (if not exists)
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_alunos_matricula_lower ON alunos (LOWER(matricula));

-- ==============================================================================
-- COMMENTS
-- ==============================================================================

COMMENT ON FUNCTION public.verificar_matricula_disponivel IS 
'SECURITY DEFINER: Bypasses RLS to check if matricula exists and is available for registration. Safe for anon users.';

COMMENT ON FUNCTION public.vincular_aluno_usuario IS 
'SECURITY DEFINER: Bypasses RLS to link matricula to authenticated user. Creates user_role entry.';
