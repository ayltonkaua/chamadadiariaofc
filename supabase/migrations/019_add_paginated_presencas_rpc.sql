-- ============================================================================
-- Migration: 019_add_paginated_presencas_rpc.sql
-- Purpose: Add cursor-based pagination for historical attendance queries
-- ChamadaDiária v2.1.0
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_presencas_historico(
    p_turma_id UUID,
    p_limit INT DEFAULT 50,
    p_cursor DATE DEFAULT NULL,
    p_direction TEXT DEFAULT 'desc'
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_escola_id UUID;
    v_presencas JSONB;
    v_has_more BOOLEAN;
    v_next_cursor DATE;
BEGIN
    v_escola_id := get_user_escola_id();
    
    IF v_escola_id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'not_authenticated');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM turmas WHERE id = p_turma_id AND escola_id = v_escola_id) THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'unauthorized_turma');
    END IF;
    
    IF p_direction = 'desc' THEN
        SELECT jsonb_agg(row_to_json(p))
        INTO v_presencas
        FROM (
            SELECT id, aluno_id, turma_id, escola_id, data_chamada, presente, falta_justificada
            FROM presencas
            WHERE turma_id = p_turma_id AND escola_id = v_escola_id
              AND (p_cursor IS NULL OR data_chamada < p_cursor)
            ORDER BY data_chamada DESC
            LIMIT p_limit + 1
        ) p;
    ELSE
        SELECT jsonb_agg(row_to_json(p))
        INTO v_presencas
        FROM (
            SELECT id, aluno_id, turma_id, escola_id, data_chamada, presente, falta_justificada
            FROM presencas
            WHERE turma_id = p_turma_id AND escola_id = v_escola_id
              AND (p_cursor IS NULL OR data_chamada > p_cursor)
            ORDER BY data_chamada ASC
            LIMIT p_limit + 1
        ) p;
    END IF;
    
    v_has_more := COALESCE(jsonb_array_length(v_presencas), 0) > p_limit;
    
    IF v_has_more THEN
        v_presencas := (
            SELECT jsonb_agg(elem)
            FROM jsonb_array_elements(v_presencas) WITH ORDINALITY arr(elem, idx)
            WHERE idx <= p_limit
        );
        v_next_cursor := (v_presencas->-1->>'data_chamada')::DATE;
    ELSE
        v_next_cursor := NULL;
    END IF;
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'data', COALESCE(v_presencas, '[]'::jsonb),
        'pagination', jsonb_build_object(
            'has_more', v_has_more,
            'next_cursor', v_next_cursor,
            'count', COALESCE(jsonb_array_length(v_presencas), 0)
        )
    );
END;
$$;

COMMENT ON FUNCTION public.get_presencas_historico IS 
'Cursor-based paginated query for attendance history.';

CREATE INDEX IF NOT EXISTS idx_presencas_turma_data_desc 
    ON presencas(turma_id, data_chamada DESC);

GRANT EXECUTE ON FUNCTION public.get_presencas_historico TO authenticated;
