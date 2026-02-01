-- ============================================================================
-- Migration: 032_bloquear_anos_fechados.sql
-- Purpose: RLS policies to block editing in closed academic years
-- ChamadaDiária v2.1.0
-- ============================================================================

-- ============================================================================
-- 1. UPDATE ANOS_LETIVOS STATUS CONSTRAINT
-- ============================================================================

-- Add 'arquivado' status option
ALTER TABLE public.anos_letivos 
DROP CONSTRAINT IF EXISTS anos_letivos_status_check;

ALTER TABLE public.anos_letivos 
ADD CONSTRAINT anos_letivos_status_check 
CHECK (status IN ('planejamento', 'aberto', 'fechado', 'arquivado'));

-- ============================================================================
-- 2. HELPER FUNCTION: Check if turma's year is open
-- ============================================================================

CREATE OR REPLACE FUNCTION is_turma_ano_aberto(p_turma_id uuid)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM public.turmas t
        LEFT JOIN public.anos_letivos al ON t.ano_letivo_id = al.id
        WHERE t.id = p_turma_id
        AND (
            -- Turma without year (legacy) is considered open
            t.ano_letivo_id IS NULL 
            OR 
            -- Year must be 'aberto'
            al.status = 'aberto'
        )
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================================
-- 3. RLS POLICIES FOR PRESENCAS
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "bloquear_insert_ano_fechado" ON public.presencas;
DROP POLICY IF EXISTS "bloquear_update_ano_fechado" ON public.presencas;
DROP POLICY IF EXISTS "bloquear_delete_ano_fechado" ON public.presencas;

-- Block INSERT on closed years
CREATE POLICY "bloquear_insert_ano_fechado" ON public.presencas
FOR INSERT WITH CHECK (
    is_turma_ano_aberto(turma_id)
);

-- Block UPDATE on closed years
CREATE POLICY "bloquear_update_ano_fechado" ON public.presencas
FOR UPDATE USING (
    is_turma_ano_aberto(turma_id)
);

-- Block DELETE on closed years
CREATE POLICY "bloquear_delete_ano_fechado" ON public.presencas
FOR DELETE USING (
    is_turma_ano_aberto(turma_id)
);

-- ============================================================================
-- 4. RLS POLICIES FOR OBSERVACOES
-- ============================================================================

DROP POLICY IF EXISTS "bloquear_obs_insert_ano_fechado" ON public.observacoes_alunos;
DROP POLICY IF EXISTS "bloquear_obs_update_ano_fechado" ON public.observacoes_alunos;

CREATE POLICY "bloquear_obs_insert_ano_fechado" ON public.observacoes_alunos
FOR INSERT WITH CHECK (
    is_turma_ano_aberto(turma_id)
);

CREATE POLICY "bloquear_obs_update_ano_fechado" ON public.observacoes_alunos
FOR UPDATE USING (
    is_turma_ano_aberto(turma_id)
);

-- ============================================================================
-- 5. FUNCTION TO CHECK IF EDIT IS ALLOWED (for frontend use)
-- ============================================================================

CREATE OR REPLACE FUNCTION pode_editar_chamada(p_turma_id uuid)
RETURNS jsonb AS $$
DECLARE
    v_ano_status text;
    v_ano_nome text;
BEGIN
    SELECT al.status, al.nome 
    INTO v_ano_status, v_ano_nome
    FROM public.turmas t
    LEFT JOIN public.anos_letivos al ON t.ano_letivo_id = al.id
    WHERE t.id = p_turma_id;
    
    -- No year linked = allowed (legacy data)
    IF v_ano_status IS NULL THEN
        RETURN jsonb_build_object(
            'permitido', true,
            'motivo', null
        );
    END IF;
    
    -- Year is open = allowed
    IF v_ano_status = 'aberto' THEN
        RETURN jsonb_build_object(
            'permitido', true,
            'motivo', null
        );
    END IF;
    
    -- Year is closed or archived = blocked
    RETURN jsonb_build_object(
        'permitido', false,
        'motivo', format('O ano letivo "%s" foi encerrado. Não é possível editar chamadas.', v_ano_nome),
        'status_ano', v_ano_status
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================================
-- 6. COMMENTS
-- ============================================================================

COMMENT ON FUNCTION is_turma_ano_aberto IS 'Verifica se a turma pertence a um ano letivo aberto (permite edição)';
COMMENT ON FUNCTION pode_editar_chamada IS 'Retorna se é permitido editar chamada da turma e motivo se não for';
