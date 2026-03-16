-- =============================================================================
-- Migration: RPC paginada para análise de evasão
-- Date: 2026-03-07
-- =============================================================================

DROP FUNCTION IF EXISTS public.get_evasao_paginated(uuid, uuid, text, text, integer, integer);

CREATE OR REPLACE FUNCTION public.get_evasao_paginated(
    p_escola_id uuid,
    p_turma_id uuid DEFAULT NULL,
    p_nivel text DEFAULT NULL,
    p_busca text DEFAULT NULL,
    p_page integer DEFAULT 1,
    p_page_size integer DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_page integer := GREATEST(COALESCE(p_page, 1), 1);
    v_page_size integer := LEAST(GREATEST(COALESCE(p_page_size, 20), 1), 100);
    v_offset integer := (v_page - 1) * v_page_size;
    v_result jsonb;
BEGIN
    -- Guardrail: bloqueia acesso cruzado entre escolas
    IF p_escola_id IS DISTINCT FROM get_user_escola_id() THEN
        RAISE EXCEPTION 'Acesso negado para escola informada';
    END IF;

    WITH presenca_agg AS (
        SELECT
            p.aluno_id,
            COUNT(*)::int AS total_chamadas,
            COUNT(*) FILTER (WHERE p.presente = TRUE)::int AS total_presencas,
            COUNT(*) FILTER (WHERE p.presente = FALSE AND COALESCE(p.falta_justificada, FALSE) = FALSE)::int AS faltas
        FROM public.presencas p
        WHERE p.escola_id = p_escola_id
        GROUP BY p.aluno_id
    ),
    base AS (
        SELECT
            a.id,
            a.nome,
            a.turma_id,
            t.nome AS turma_nome,
            a.data_nascimento,
            a.endereco,
            a.latitude,
            a.longitude,
            COALESCE(a.trabalha, FALSE) AS trabalha,
            COALESCE(a.recebe_pe_de_meia, FALSE) AS recebe_pe_de_meia,
            COALESCE(a.recebe_bolsa_familia, FALSE) AS recebe_bolsa_familia,
            COALESCE(a.mora_com_familia, TRUE) AS mora_com_familia,
            COALESCE(a.usa_transporte, FALSE) AS usa_transporte,
            COALESCE(a.tem_passe_livre, FALSE) AS tem_passe_livre,
            COALESCE(pa.total_chamadas, 0) AS total_chamadas,
            COALESCE(pa.total_presencas, 0) AS total_presencas,
            COALESCE(pa.faltas, 0) AS faltas,
            CASE
                WHEN COALESCE(pa.total_chamadas, 0) > 0
                    THEN ROUND((COALESCE(pa.total_presencas, 0)::numeric / pa.total_chamadas::numeric) * 100)::int
                ELSE 100
            END AS frequencia,
            CASE
                WHEN ec.latitude IS NOT NULL AND ec.longitude IS NOT NULL
                     AND a.latitude IS NOT NULL AND a.longitude IS NOT NULL
                    THEN ROUND(
                        (
                            6371 * acos(
                                LEAST(
                                    1,
                                    GREATEST(
                                        -1,
                                        cos(radians(ec.latitude)) * cos(radians(a.latitude)) *
                                        cos(radians(a.longitude) - radians(ec.longitude)) +
                                        sin(radians(ec.latitude)) * sin(radians(a.latitude))
                                    )
                                )
                            )
                        )::numeric,
                        1
                    )
                ELSE NULL
            END AS distancia_km
        FROM public.alunos a
        LEFT JOIN public.turmas t ON t.id = a.turma_id
        LEFT JOIN presenca_agg pa ON pa.aluno_id = a.id
        LEFT JOIN public.escola_configuracao ec ON ec.id = a.escola_id
        WHERE a.escola_id = p_escola_id
    ),
    scored AS (
        SELECT
            b.*,
            LEAST(
                100,
                (
                    CASE
                        WHEN b.frequencia < 70 THEN 35
                        WHEN b.frequencia < 85 THEN 15
                        ELSE 0
                    END
                    +
                    CASE
                        WHEN b.total_chamadas > 0
                             AND (b.faltas::numeric / b.total_chamadas::numeric) * 100 > 40 THEN 10
                        ELSE 0
                    END
                    +
                    CASE WHEN b.trabalha THEN 15 ELSE 0 END
                    +
                    CASE WHEN NOT b.mora_com_familia THEN 12 ELSE 0 END
                    +
                    CASE WHEN NOT b.recebe_bolsa_familia AND NOT b.recebe_pe_de_meia THEN 8 ELSE 0 END
                    +
                    CASE
                        WHEN b.distancia_km IS NOT NULL AND b.distancia_km > 10 THEN 10
                        WHEN b.distancia_km IS NOT NULL AND b.distancia_km > 5 THEN 5
                        ELSE 0
                    END
                    +
                    CASE
                        WHEN NOT b.usa_transporte AND b.distancia_km IS NOT NULL AND b.distancia_km > 3 THEN 5
                        ELSE 0
                    END
                )
            )::int AS score
        FROM base b
    ),
    filtered AS (
        SELECT
            s.*,
            CASE
                WHEN s.score >= 60 THEN 'vermelho'
                WHEN s.score >= 30 THEN 'amarelo'
                ELSE 'verde'
            END AS nivel
        FROM scored s
        WHERE (p_turma_id IS NULL OR s.turma_id = p_turma_id)
          AND (p_busca IS NULL OR trim(p_busca) = '' OR s.nome ILIKE '%' || trim(p_busca) || '%')
    ),
    filtered_with_nivel AS (
        SELECT *
        FROM filtered f
        WHERE (p_nivel IS NULL OR trim(p_nivel) = '' OR trim(p_nivel) = 'todos' OR f.nivel = trim(lower(p_nivel)))
    ),
    summary AS (
        SELECT
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE nivel = 'verde')::int AS verdes,
            COUNT(*) FILTER (WHERE nivel = 'amarelo')::int AS amarelos,
            COUNT(*) FILTER (WHERE nivel = 'vermelho')::int AS vermelhos,
            COALESCE(ROUND(AVG(score))::int, 0) AS score_media
        FROM filtered_with_nivel
    ),
    paged AS (
        SELECT *
        FROM filtered_with_nivel
        ORDER BY score DESC, nome ASC
        LIMIT v_page_size
        OFFSET v_offset
    )
    SELECT jsonb_build_object(
        'items', COALESCE((SELECT jsonb_agg(to_jsonb(p)) FROM paged p), '[]'::jsonb),
        'pagination', jsonb_build_object(
            'page', v_page,
            'page_size', v_page_size,
            'total', (SELECT total FROM summary),
            'total_pages', CEIL((SELECT total FROM summary)::numeric / v_page_size)::int
        ),
        'summary', (
            SELECT jsonb_build_object(
                'total', total,
                'verdes', verdes,
                'amarelos', amarelos,
                'vermelhos', vermelhos,
                'score_media', score_media
            )
            FROM summary
        )
    )
    INTO v_result;

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_evasao_paginated(uuid, uuid, text, text, integer, integer) TO authenticated;
