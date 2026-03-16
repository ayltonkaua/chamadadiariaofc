-- ============================================================================
-- MELHORIAS DO DASHBOARD GESTOR — 2026-03-15
-- Executar COMPLETO no SQL Editor do Supabase
-- ============================================================================

-- ============================================================================
-- P1: CORRIGIR get_alunos_faltas_consecutivas (consecutivas REAIS)
-- ============================================================================
DO $$ 
DECLARE r RECORD; 
BEGIN 
    FOR r IN SELECT oid::regprocedure AS func FROM pg_proc 
             WHERE proname = 'get_alunos_faltas_consecutivas' 
             AND pronamespace = 'public'::regnamespace
    LOOP 
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func || ' CASCADE'; 
    END LOOP; 
END $$;

CREATE OR REPLACE FUNCTION get_alunos_faltas_consecutivas(
    dias_seguidos INT, 
    _escola_id UUID
) 
RETURNS TABLE (
    aluno_id UUID, 
    aluno_nome TEXT, 
    turma_nome TEXT, 
    contagem_faltas_consecutivas BIGINT
) 
LANGUAGE plpgsql SECURITY DEFINER 
AS $$
BEGIN
    RETURN QUERY 
    -- Step 1: Number each student's records from MOST RECENT backwards
    WITH presencas_numeradas AS (
        SELECT 
            p.aluno_id AS aid,
            p.data_chamada,
            p.presente,
            COALESCE(p.falta_justificada, FALSE) AS justificada,
            ROW_NUMBER() OVER (
                PARTITION BY p.aluno_id 
                ORDER BY p.data_chamada DESC
            ) AS rn
        FROM public.presencas p
        JOIN public.alunos a ON a.id = p.aluno_id
        WHERE p.escola_id = _escola_id 
          AND a.situacao = 'ativo'
          AND p.data_chamada >= (CURRENT_DATE - INTERVAL '30 days')
    ),
    -- Step 2: Find each student's first "present" record (breaks the streak)
    primeira_presenca AS (
        SELECT 
            aid,
            MIN(rn) AS quebra_rn
        FROM presencas_numeradas
        WHERE presente = TRUE OR justificada = TRUE
        GROUP BY aid
    ),
    -- Step 3: Count only absences BEFORE the first presence (= current streak)
    contagem AS (
        SELECT 
            pn.aid,
            COUNT(*) AS faltas_consecutivas
        FROM presencas_numeradas pn
        LEFT JOIN primeira_presenca pp ON pp.aid = pn.aid
        WHERE pn.presente = FALSE
          AND pn.justificada = FALSE
          AND pn.rn < COALESCE(pp.quebra_rn, 999999)
        GROUP BY pn.aid
        HAVING COUNT(*) >= dias_seguidos
    )
    SELECT 
        a.id AS aluno_id, 
        a.nome AS aluno_nome, 
        t.nome AS turma_nome, 
        c.faltas_consecutivas AS contagem_faltas_consecutivas
    FROM contagem c
    JOIN public.alunos a ON c.aid = a.id 
    JOIN public.turmas t ON a.turma_id = t.id
    ORDER BY c.faltas_consecutivas DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_alunos_faltas_consecutivas TO authenticated;

-- ============================================================================
-- P2: CORRIGIR get_kpis_administrativos (justificativas_a_rever)
-- ============================================================================
DO $$ 
DECLARE r RECORD; 
BEGIN 
    FOR r IN SELECT oid::regprocedure AS func FROM pg_proc 
             WHERE proname = 'get_kpis_administrativos' 
             AND pronamespace = 'public'::regnamespace
    LOOP 
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func || ' CASCADE'; 
    END LOOP; 
END $$;

CREATE OR REPLACE FUNCTION get_kpis_administrativos(_escola_id UUID) 
RETURNS JSONB 
LANGUAGE plpgsql SECURITY DEFINER 
AS $$
DECLARE 
    v_atestados_pendentes INT := 0;
    v_atestados_aprovados INT := 0;
    v_atestados_rejeitados INT := 0;
    v_faltas_justificadas INT := 0;
    v_faltas_hoje INT := 0;
    v_turmas_sem_chamada INT := 0;
BEGIN
    -- Atestados por status
    SELECT COUNT(*) INTO v_atestados_pendentes 
    FROM public.atestados 
    WHERE escola_id = _escola_id AND status = 'pendente';
    
    SELECT COUNT(*) INTO v_atestados_aprovados 
    FROM public.atestados 
    WHERE escola_id = _escola_id AND status = 'aprovado';
    
    SELECT COUNT(*) INTO v_atestados_rejeitados 
    FROM public.atestados 
    WHERE escola_id = _escola_id AND status = 'rejeitado';
    
    -- Faltas com justificativa nos últimos 30 dias
    SELECT COUNT(*) INTO v_faltas_justificadas
    FROM public.presencas
    WHERE escola_id = _escola_id 
      AND presente = FALSE 
      AND falta_justificada = TRUE
      AND data_chamada >= (CURRENT_DATE - INTERVAL '30 days');

    -- NOVO: Faltas hoje
    SELECT COUNT(DISTINCT p.aluno_id) INTO v_faltas_hoje
    FROM public.presencas p
    WHERE p.escola_id = _escola_id
      AND p.data_chamada = CURRENT_DATE
      AND p.presente = FALSE;

    -- NOVO: Turmas sem chamada hoje
    SELECT COUNT(*) INTO v_turmas_sem_chamada
    FROM public.turmas t
    WHERE t.escola_id = _escola_id
      AND NOT EXISTS (
          SELECT 1 FROM public.presencas p
          WHERE p.turma_id = t.id
            AND p.data_chamada = CURRENT_DATE
      );
    
    RETURN jsonb_build_object(
        'atestados_pendentes', COALESCE(v_atestados_pendentes, 0), 
        'atestados_aprovados', COALESCE(v_atestados_aprovados, 0),
        'atestados_rejeitados', COALESCE(v_atestados_rejeitados, 0),
        'faltas_justificadas', COALESCE(v_faltas_justificadas, 0),
        'justificativas_a_rever', COALESCE(v_faltas_justificadas, 0),
        'faltas_hoje', COALESCE(v_faltas_hoje, 0),
        'turmas_sem_chamada', COALESCE(v_turmas_sem_chamada, 0)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION get_kpis_administrativos TO authenticated;

-- ============================================================================
-- P3: ATUALIZAR get_escola_kpis (filtrar por ano letivo)
-- ============================================================================
DO $$ 
DECLARE r RECORD; 
BEGIN 
    FOR r IN SELECT oid::regprocedure AS func FROM pg_proc 
             WHERE proname = 'get_escola_kpis' 
             AND pronamespace = 'public'::regnamespace
    LOOP 
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func || ' CASCADE'; 
    END LOOP; 
END $$;

CREATE OR REPLACE FUNCTION get_escola_kpis(
    _escola_id UUID,
    _ano_letivo_id UUID DEFAULT NULL
) 
RETURNS JSONB 
LANGUAGE plpgsql SECURITY DEFINER 
AS $$
DECLARE 
    v_total_alunos INT; 
    v_taxa_geral NUMERIC;
BEGIN
    -- Conta alunos ativos, filtrando por ano letivo se informado
    SELECT COUNT(*) INTO v_total_alunos 
    FROM public.alunos a
    LEFT JOIN public.turmas t ON a.turma_id = t.id
    WHERE a.escola_id = _escola_id 
      AND a.situacao = 'ativo'
      AND (_ano_letivo_id IS NULL OR t.ano_letivo_id = _ano_letivo_id);
    
    -- Taxa de presença dos últimos 30 dias, filtrando por ano letivo
    SELECT ROUND(COALESCE(AVG(CASE WHEN p.presente THEN 100.0 ELSE 0.0 END), 0), 1) 
    INTO v_taxa_geral
    FROM public.presencas p
    LEFT JOIN public.turmas t ON p.turma_id = t.id
    WHERE p.escola_id = _escola_id 
      AND p.data_chamada >= (CURRENT_DATE - INTERVAL '30 days')
      AND (_ano_letivo_id IS NULL OR t.ano_letivo_id = _ano_letivo_id);
    
    RETURN jsonb_build_object(
        'total_alunos', COALESCE(v_total_alunos, 0), 
        'taxa_presenca_geral', COALESCE(v_taxa_geral, 0)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION get_escola_kpis TO authenticated;

-- ============================================================================
-- P3: ATUALIZAR get_alunos_em_risco_anual (filtrar por ano letivo)
-- ============================================================================
DO $$ 
DECLARE r RECORD; 
BEGIN 
    FOR r IN SELECT oid::regprocedure AS func FROM pg_proc 
             WHERE proname = 'get_alunos_em_risco_anual' 
             AND pronamespace = 'public'::regnamespace
    LOOP 
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func || ' CASCADE'; 
    END LOOP; 
END $$;

CREATE OR REPLACE FUNCTION get_alunos_em_risco_anual(
    limite_faltas INT, 
    _escola_id UUID,
    _ano_letivo_id UUID DEFAULT NULL
) 
RETURNS TABLE (
    aluno_id UUID, 
    aluno_nome TEXT, 
    turma_nome TEXT, 
    total_faltas BIGINT
) 
LANGUAGE plpgsql SECURITY DEFINER 
AS $$
BEGIN
    RETURN QUERY 
    SELECT 
        a.id AS aluno_id, 
        a.nome AS aluno_nome, 
        t.nome AS turma_nome, 
        COUNT(p.id) AS total_faltas
    FROM public.alunos a 
    JOIN public.turmas t ON a.turma_id = t.id 
    LEFT JOIN public.presencas p ON p.aluno_id = a.id AND p.presente = FALSE
    WHERE a.escola_id = _escola_id 
      AND a.situacao = 'ativo'
      AND (_ano_letivo_id IS NULL OR t.ano_letivo_id = _ano_letivo_id)
    GROUP BY a.id, a.nome, t.nome 
    HAVING COUNT(p.id) >= limite_faltas 
    ORDER BY total_faltas DESC 
    LIMIT 20;
END;
$$;

GRANT EXECUTE ON FUNCTION get_alunos_em_risco_anual TO authenticated;

-- ============================================================================
-- P5: CRIAR get_ultimas_presencas_batch (eliminar N+1)
-- ============================================================================
CREATE OR REPLACE FUNCTION get_ultimas_presencas_batch(p_aluno_ids UUID[])
RETURNS TABLE (aluno_id UUID, data_chamada DATE, presente BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
    SELECT sub.aluno_id, sub.data_chamada, sub.presente
    FROM (
        SELECT p.aluno_id, p.data_chamada::DATE, p.presente,
               ROW_NUMBER() OVER (PARTITION BY p.aluno_id ORDER BY p.data_chamada DESC) AS rn
        FROM public.presencas p
        WHERE p.aluno_id = ANY(p_aluno_ids)
    ) sub
    WHERE sub.rn <= 3
    ORDER BY sub.aluno_id, sub.data_chamada DESC;
$$;

GRANT EXECUTE ON FUNCTION get_ultimas_presencas_batch TO authenticated;

-- ============================================================================
-- P4: CRIAR get_faltas_por_dia_semana (evitar problemas de timezone no JS)
-- ============================================================================
DO $$ 
DECLARE r RECORD; 
BEGIN 
    FOR r IN SELECT oid::regprocedure AS func FROM pg_proc 
             WHERE proname = 'get_faltas_por_dia_semana' 
             AND pronamespace = 'public'::regnamespace
    LOOP 
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func || ' CASCADE'; 
    END LOOP; 
END $$;

CREATE OR REPLACE FUNCTION get_faltas_por_dia_semana(
    _escola_id UUID,
    _dias INT DEFAULT 15,
    _ano_letivo_id UUID DEFAULT NULL
)
RETURNS TABLE (
    dia_semana_nome TEXT,
    dia_semana_num INT,
    total_registros BIGINT,
    total_faltas BIGINT,
    percentual_faltas NUMERIC
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH dados AS (
        SELECT
            -- EXTRACT(DOW) = 0(Dom) 1(Seg) 2(Ter) 3(Qua) 4(Qui) 5(Sex) 6(Sab)
            EXTRACT(DOW FROM p.data_chamada)::INT AS dow,
            p.presente
        FROM public.presencas p
        LEFT JOIN public.turmas t ON p.turma_id = t.id
        WHERE p.escola_id = _escola_id
          AND p.data_chamada >= (CURRENT_DATE - (_dias || ' days')::INTERVAL)
          AND (_ano_letivo_id IS NULL OR t.ano_letivo_id = _ano_letivo_id)
    )
    SELECT
        CASE d.dow
            WHEN 0 THEN 'Dom'
            WHEN 1 THEN 'Seg'
            WHEN 2 THEN 'Ter'
            WHEN 3 THEN 'Qua'
            WHEN 4 THEN 'Qui'
            WHEN 5 THEN 'Sex'
            WHEN 6 THEN 'Sáb'
        END AS dia_semana_nome,
        d.dow AS dia_semana_num,
        COUNT(*) AS total_registros,
        COUNT(*) FILTER (WHERE d.presente = FALSE) AS total_faltas,
        ROUND(
            COALESCE(
                (COUNT(*) FILTER (WHERE d.presente = FALSE)::NUMERIC / NULLIF(COUNT(*), 0)) * 100,
                0
            ), 1
        ) AS percentual_faltas
    FROM dados d
    GROUP BY d.dow
    ORDER BY d.dow;
END;
$$;

GRANT EXECUTE ON FUNCTION get_faltas_por_dia_semana TO authenticated;

-- ============================================================================
-- VERIFICAÇÃO
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '========================================================';
    RAISE NOTICE 'TODAS AS RPCs DO DASHBOARD ATUALIZADAS COM SUCESSO!';
    RAISE NOTICE '- P1: get_alunos_faltas_consecutivas (consecutivas reais)';
    RAISE NOTICE '- P2: get_kpis_administrativos (faltas_hoje + turmas_sem_chamada)';
    RAISE NOTICE '- P3: get_escola_kpis (filtro ano letivo)';
    RAISE NOTICE '- P3: get_alunos_em_risco_anual (filtro ano letivo)';
    RAISE NOTICE '- P4: get_faltas_por_dia_semana (server-side)';
    RAISE NOTICE '- P5: get_ultimas_presencas_batch (batch query)';
    RAISE NOTICE '========================================================';
END $$;

