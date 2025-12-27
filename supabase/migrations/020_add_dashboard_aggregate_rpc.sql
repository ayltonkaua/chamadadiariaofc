-- ============================================================================
-- Migration: 020_add_dashboard_aggregate_rpc.sql
-- Purpose: Single RPC to fetch all dashboard data in one request
-- ChamadaDiária v2.1.0
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_dashboard_aggregate(p_escola_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_escola_id UUID;
    v_kpis JSONB;
    v_turma_stats JSONB;
    v_alunos_risco JSONB;
    v_hoje DATE := CURRENT_DATE;
    v_15_dias_atras DATE := CURRENT_DATE - INTERVAL '15 days';
BEGIN
    v_user_escola_id := get_user_escola_id();
    
    IF v_user_escola_id IS NULL OR v_user_escola_id != p_escola_id THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'unauthorized');
    END IF;

    -- KPIs
    WITH stats AS (
        SELECT 
            COUNT(DISTINCT a.id) as total_alunos,
            COUNT(DISTINCT t.id) as total_turmas,
            (SELECT COUNT(*) FROM presencas WHERE escola_id = p_escola_id AND data_chamada = v_hoje) as presencas_hoje,
            (SELECT COUNT(*) FROM presencas WHERE escola_id = p_escola_id AND data_chamada >= v_15_dias_atras) as presencas_15_dias
        FROM alunos a
        JOIN turmas t ON a.turma_id = t.id
        WHERE a.escola_id = p_escola_id
    ),
    attendance_rate AS (
        SELECT ROUND(COALESCE(AVG(CASE WHEN presente THEN 100.0 ELSE 0.0 END), 0), 1) as taxa
        FROM presencas WHERE escola_id = p_escola_id AND data_chamada >= v_15_dias_atras
    )
    SELECT jsonb_build_object(
        'total_alunos', s.total_alunos,
        'total_turmas', s.total_turmas,
        'presencas_hoje', s.presencas_hoje,
        'presencas_15_dias', s.presencas_15_dias,
        'taxa_presenca_15d', ar.taxa
    ) INTO v_kpis FROM stats s, attendance_rate ar;

    -- Turma stats
    SELECT COALESCE(jsonb_agg(turma_data), '[]'::jsonb) INTO v_turma_stats
    FROM (
        SELECT jsonb_build_object(
            'turma_id', t.id,
            'turma_nome', t.nome,
            'turno', t.turno,
            'total_alunos', COUNT(DISTINCT a.id),
            'taxa_presenca', ROUND(COALESCE(
                (SELECT AVG(CASE WHEN presente THEN 100.0 ELSE 0.0 END) 
                 FROM presencas p WHERE p.turma_id = t.id AND p.data_chamada >= CURRENT_DATE - 7), 0), 1)
        ) as turma_data
        FROM turmas t LEFT JOIN alunos a ON a.turma_id = t.id
        WHERE t.escola_id = p_escola_id
        GROUP BY t.id, t.nome, t.turno ORDER BY t.nome LIMIT 20
    ) sub;

    -- Alunos em risco
    SELECT COALESCE(jsonb_agg(aluno_risco), '[]'::jsonb) INTO v_alunos_risco
    FROM (
        SELECT jsonb_build_object(
            'aluno_id', a.id,
            'aluno_nome', a.nome,
            'turma_nome', t.nome,
            'faltas_30d', fc.faltas
        ) as aluno_risco
        FROM alunos a
        JOIN turmas t ON a.turma_id = t.id
        JOIN (
            SELECT aluno_id, COUNT(*) as faltas FROM presencas
            WHERE escola_id = p_escola_id AND presente = FALSE AND data_chamada >= CURRENT_DATE - 30
            GROUP BY aluno_id HAVING COUNT(*) >= 5
        ) fc ON fc.aluno_id = a.id
        WHERE a.escola_id = p_escola_id ORDER BY fc.faltas DESC LIMIT 10
    ) sub;

    RETURN jsonb_build_object(
        'success', TRUE,
        'kpis', v_kpis,
        'turma_stats', v_turma_stats,
        'alunos_risco', v_alunos_risco,
        'generated_at', NOW()
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', FALSE, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION public.get_dashboard_aggregate IS 
'Single RPC to fetch all dashboard data. Reduces N+1 queries.';

GRANT EXECUTE ON FUNCTION public.get_dashboard_aggregate TO authenticated;
