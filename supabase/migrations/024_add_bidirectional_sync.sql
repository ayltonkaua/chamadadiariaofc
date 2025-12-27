-- ============================================================================
-- Migration: 024_add_bidirectional_sync.sql
-- Purpose: Enable server→client sync for reference data (alunos, turmas)
-- ChamadaDiária v2.1.0
-- ============================================================================

-- ============================================================================
-- 1. CHANGE LOG TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.change_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL,  -- 'aluno', 'turma'
    entity_id UUID NOT NULL,
    escola_id UUID NOT NULL REFERENCES public.escola_configuracao(id) ON DELETE CASCADE,
    operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    changed_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_change_log_escola_time 
    ON public.change_log(escola_id, changed_at DESC);

COMMENT ON TABLE public.change_log IS 
'Tracks changes to reference data for bidirectional sync. Client polls this to detect server-side changes.';

-- ============================================================================
-- 2. TRIGGERS FOR ALUNOS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.log_aluno_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO change_log (entity_type, entity_id, escola_id, operation, changed_by)
        VALUES ('aluno', NEW.id, NEW.escola_id, 'INSERT', auth.uid());
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO change_log (entity_type, entity_id, escola_id, operation, changed_by)
        VALUES ('aluno', NEW.id, NEW.escola_id, 'UPDATE', auth.uid());
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO change_log (entity_type, entity_id, escola_id, operation, changed_by)
        VALUES ('aluno', OLD.id, OLD.escola_id, 'DELETE', auth.uid());
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_alunos_change_log ON public.alunos;
CREATE TRIGGER trg_alunos_change_log
    AFTER INSERT OR UPDATE OR DELETE ON public.alunos
    FOR EACH ROW EXECUTE FUNCTION log_aluno_changes();

-- ============================================================================
-- 3. TRIGGERS FOR TURMAS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.log_turma_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO change_log (entity_type, entity_id, escola_id, operation, changed_by)
        VALUES ('turma', NEW.id, NEW.escola_id, 'INSERT', auth.uid());
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO change_log (entity_type, entity_id, escola_id, operation, changed_by)
        VALUES ('turma', NEW.id, NEW.escola_id, 'UPDATE', auth.uid());
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO change_log (entity_type, entity_id, escola_id, operation, changed_by)
        VALUES ('turma', OLD.id, OLD.escola_id, 'DELETE', auth.uid());
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_turmas_change_log ON public.turmas;
CREATE TRIGGER trg_turmas_change_log
    AFTER INSERT OR UPDATE OR DELETE ON public.turmas
    FOR EACH ROW EXECUTE FUNCTION log_turma_changes();

-- ============================================================================
-- 4. RPC: GET CHANGES SINCE
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_changes_since(
    p_escola_id UUID,
    p_since TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_escola_id UUID;
    v_changes JSONB;
BEGIN
    v_user_escola_id := get_user_escola_id();
    
    IF v_user_escola_id IS NULL OR v_user_escola_id != p_escola_id THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'unauthorized');
    END IF;

    SELECT jsonb_build_object(
        'success', TRUE,
        'changes', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', cl.id,
                'entity_type', cl.entity_type,
                'entity_id', cl.entity_id,
                'operation', cl.operation,
                'changed_at', cl.changed_at
            ) ORDER BY cl.changed_at ASC)
            FROM change_log cl
            WHERE cl.escola_id = p_escola_id
              AND cl.changed_at > p_since
        ), '[]'::jsonb),
        'server_time', NOW()
    ) INTO v_changes;

    RETURN v_changes;
END;
$$;

COMMENT ON FUNCTION public.get_changes_since IS 
'Returns all changes since given timestamp for bidirectional sync.';

-- ============================================================================
-- 5. RLS FOR CHANGE_LOG
-- ============================================================================

ALTER TABLE public.change_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "change_log_select_escola" ON public.change_log
    FOR SELECT USING (escola_id IN (
        SELECT escola_id FROM user_roles WHERE user_id = auth.uid()
    ));

-- ============================================================================
-- 6. PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.get_changes_since TO authenticated;
GRANT SELECT ON public.change_log TO authenticated;

-- ============================================================================
-- 7. CLEANUP OLD CHANGES (keep 30 days)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_old_change_logs()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    DELETE FROM change_log WHERE changed_at < NOW() - INTERVAL '30 days';
$$;
