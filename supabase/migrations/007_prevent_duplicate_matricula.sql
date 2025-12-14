-- Migration: Prevent duplicate matricula registrations
-- This migration fixes the issue where users can create multiple accounts
-- linked to the same matricula

-- ==============================================================================
-- PART 1: Updated vincular_aluno_usuario function with duplicate check
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
BEGIN
    -- Obter o user_id do usuário atual
    v_current_user_id := auth.uid();
    
    IF v_current_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Usuário não autenticado'
        );
    END IF;
    
    -- Buscar o aluno pela matrícula
    SELECT id, user_id, nome, escola_id 
    INTO v_aluno_id, v_aluno_user_id, v_aluno_nome, v_escola_id
    FROM alunos
    WHERE matricula = trim(p_matricula);
    
    -- Verificar se a matrícula existe
    IF v_aluno_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Matrícula não encontrada. Verifique se o número está correto ou contate a secretaria.'
        );
    END IF;
    
    -- ⚠️ VERIFICAÇÃO CRÍTICA: Matrícula já vinculada a outro usuário?
    IF v_aluno_user_id IS NOT NULL AND v_aluno_user_id != v_current_user_id THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Esta matrícula já está vinculada a outra conta. Se você esqueceu sua senha, use a opção "Esqueci minha senha" na tela de login.'
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
    
    -- Vincular: Atualizar user_id no aluno
    UPDATE alunos 
    SET user_id = v_current_user_id
    WHERE id = v_aluno_id;
    
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
-- PART 2: Function to check if matricula is available (for frontend pre-check)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.verificar_matricula_disponivel(
    p_matricula TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_aluno RECORD;
BEGIN
    -- Buscar aluno pela matrícula
    SELECT id, nome, user_id, escola_id
    INTO v_aluno
    FROM alunos
    WHERE matricula = trim(p_matricula);
    
    -- Matrícula não existe no sistema
    IF v_aluno.id IS NULL THEN
        RETURN jsonb_build_object(
            'exists', false,
            'available', false,
            'message', 'Matrícula não encontrada no sistema.'
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
-- PART 3: Grant permissions
-- ==============================================================================

-- Allow anonymous users to check if matricula is available (before registration)
GRANT EXECUTE ON FUNCTION public.verificar_matricula_disponivel(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.verificar_matricula_disponivel(TEXT) TO authenticated;

-- vincular_aluno_usuario needs to be called after auth signup
GRANT EXECUTE ON FUNCTION public.vincular_aluno_usuario(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.vincular_aluno_usuario(TEXT, TEXT) TO authenticated;

-- ==============================================================================
-- PART 4: Add unique constraint if not exists (belt and suspenders)
-- ==============================================================================

-- This ensures at the database level that only one user can be linked to a matricula
-- Note: Does NOT make user_id unique across all rows, just prevents duplicates
-- where user_id is NOT NULL

DO $$
BEGIN
    -- Check if constraint already exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'unique_aluno_user_id'
    ) THEN
        -- Only add if user_id column exists
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'alunos' AND column_name = 'user_id'
        ) THEN
            ALTER TABLE public.alunos 
            ADD CONSTRAINT unique_aluno_user_id UNIQUE (user_id);
        END IF;
    END IF;
END $$;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_alunos_user_id ON public.alunos(user_id);
CREATE INDEX IF NOT EXISTS idx_alunos_matricula ON public.alunos(matricula);

-- Comments
COMMENT ON FUNCTION public.vincular_aluno_usuario IS 'Links a student matricula to a user account, with duplicate prevention';
COMMENT ON FUNCTION public.verificar_matricula_disponivel IS 'Checks if a matricula is available for registration';
