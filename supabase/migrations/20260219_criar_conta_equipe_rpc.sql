-- =============================================================================
-- Migration: RPC para configurar conta de equipe (após signUp)
-- Date: 2026-02-22
-- Description: Configura user_roles e confirma email para conta criada via
--              supabase.auth.signUp(). Substitui inserção direta em auth.users.
-- =============================================================================

-- Drop versão anterior se existir
DROP FUNCTION IF EXISTS criar_conta_equipe(TEXT, TEXT, TEXT, TEXT);

-- Nova função simplificada: configurar conta após signUp
CREATE OR REPLACE FUNCTION configurar_conta_equipe(
    p_user_id UUID,
    p_role TEXT,
    p_nome TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_creator_id UUID;
    v_creator_role TEXT;
    v_creator_escola_id UUID;
    v_allowed_roles TEXT[] := ARRAY['professor', 'coordenador', 'secretario', 'diretor', 'admin'];
    v_creator_allowed TEXT[] := ARRAY['admin', 'diretor'];
BEGIN
    -- 1. Identificar o criador (usuário autenticado)
    v_creator_id := auth.uid();
    IF v_creator_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Usuário não autenticado');
    END IF;

    -- 2. Verificar permissão do criador
    SELECT role, escola_id INTO v_creator_role, v_creator_escola_id
    FROM public.user_roles
    WHERE user_id = v_creator_id
    LIMIT 1;

    IF v_creator_role IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Usuário sem perfil de escola');
    END IF;

    IF NOT (v_creator_role = ANY(v_creator_allowed)) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Apenas Admin ou Diretor podem criar contas');
    END IF;

    -- 3. Validar role
    IF NOT (p_role = ANY(v_allowed_roles)) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Role inválido');
    END IF;

    -- 4. Verificar que o user existe em auth.users
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Usuário não encontrado no auth');
    END IF;

    -- 5. Confirmar email (pular verificação de email)
    UPDATE auth.users
    SET email_confirmed_at = COALESCE(email_confirmed_at, now()),
        raw_user_meta_data = raw_user_meta_data || jsonb_build_object(
            'must_change_password', true,
            'role', p_role,
            'username', p_nome
        ),
        updated_at = now()
    WHERE id = p_user_id;

    -- 6. Criar ou atualizar user_roles
    IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user_id) THEN
        UPDATE public.user_roles
        SET role = p_role, escola_id = v_creator_escola_id
        WHERE user_id = p_user_id;
    ELSE
        INSERT INTO public.user_roles (user_id, escola_id, role)
        VALUES (p_user_id, v_creator_escola_id, p_role);
    END IF;

    -- 7. Atualizar convite se existir
    UPDATE public.convites_acesso
    SET status = 'aceito'
    WHERE email = (SELECT email FROM auth.users WHERE id = p_user_id)
      AND escola_id = v_creator_escola_id;

    RETURN jsonb_build_object(
        'success', true,
        'userId', p_user_id,
        'message', format('Conta configurada: %s (%s)', p_nome, p_role)
    );

EXCEPTION
    WHEN unique_violation THEN
        RETURN jsonb_build_object('success', false, 'error', 'Usuário já possui role nesta escola');
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION configurar_conta_equipe IS 'Configura user_roles e confirma email para conta criada via signUp. Apenas admin/diretor.';

-- Forçar reload do cache do PostgREST
NOTIFY pgrst, 'reload schema';
