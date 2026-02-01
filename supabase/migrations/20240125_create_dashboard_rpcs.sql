-- Migration: 20240125_create_dashboard_rpcs.sql
-- Purpose: Create missing RPCs for Dashboard Gestor with year filtering support

-- 1. get_comparativo_turmas
DO $$ 
DECLARE 
    r RECORD;
BEGIN 
    FOR r IN SELECT oid::regprocedure AS func_signature FROM pg_proc WHERE proname = 'get_comparativo_turmas' LOOP 
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_signature || ' CASCADE'; 
    END LOOP; 
END $$;

CREATE OR REPLACE FUNCTION get_comparativo_turmas(
  p_escola_id UUID,
  p_ano_letivo_id UUID DEFAULT NULL
)
RETURNS TABLE (
  turma_id UUID,
  turma_nome TEXT,
  total_presencas INT,
  total_faltas INT,
  taxa_presenca NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id AS turma_id,
    t.nome AS turma_nome,
    COUNT(p.id) FILTER (WHERE p.presente = TRUE)::INT AS total_presencas,
    COUNT(p.id) FILTER (WHERE p.presente = FALSE)::INT AS total_faltas,
    ROUND(COALESCE(
      (COUNT(p.id) FILTER (WHERE p.presente = TRUE)::NUMERIC / NULLIF(COUNT(p.id), 0)) * 100,
      0
    ), 1) AS taxa_presenca
  FROM turmas t
  LEFT JOIN presencas p ON p.turma_id = t.id AND p.escola_id = p_escola_id
  WHERE t.escola_id = p_escola_id
    AND t.ativo = TRUE
    AND (p_ano_letivo_id IS NULL OR t.ano_letivo_id = p_ano_letivo_id)
  GROUP BY t.id, t.nome
  ORDER BY taxa_presenca DESC;
END;
$$;

-- 2. get_escola_kpis
DO $$ 
DECLARE 
    r RECORD;
BEGIN 
    FOR r IN SELECT oid::regprocedure AS func_signature FROM pg_proc WHERE proname = 'get_escola_kpis' LOOP 
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_signature || ' CASCADE'; 
    END LOOP; 
END $$;

CREATE OR REPLACE FUNCTION get_escola_kpis(_escola_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_alunos INT;
  v_taxa_geral NUMERIC;
BEGIN
  SELECT COUNT(*) INTO v_total_alunos FROM alunos WHERE escola_id = _escola_id AND ativo = TRUE;
  
  SELECT ROUND(COALESCE(AVG(CASE WHEN presente THEN 100.0 ELSE 0.0 END), 0), 1)
  INTO v_taxa_geral
  FROM presencas
  WHERE escola_id = _escola_id AND data_chamada >= (CURRENT_DATE - INTERVAL '30 days');

  RETURN jsonb_build_object(
    'total_alunos', v_total_alunos,
    'taxa_presenca_geral', v_taxa_geral
  );
END;
$$;

-- 3. get_kpis_administrativos
DO $$ 
DECLARE 
    r RECORD;
BEGIN 
    FOR r IN SELECT oid::regprocedure AS func_signature FROM pg_proc WHERE proname = 'get_kpis_administrativos' LOOP 
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_signature || ' CASCADE'; 
    END LOOP; 
END $$;

CREATE OR REPLACE FUNCTION get_kpis_administrativos(_escola_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_atestados_pendentes INT;
  v_justificativas INT := 0; -- Placeholder
BEGIN
  SELECT COUNT(*) INTO v_atestados_pendentes 
  FROM atestados 
  WHERE escola_id = _escola_id AND status = 'pendente';

  RETURN jsonb_build_object(
    'atestados_pendentes', v_atestados_pendentes,
    'justificativas_a_rever', v_justificativas
  );
END;
$$;

-- 4. get_alunos_em_risco_anual
DO $$ 
DECLARE 
    r RECORD;
BEGIN 
    FOR r IN SELECT oid::regprocedure AS func_signature FROM pg_proc WHERE proname = 'get_alunos_em_risco_anual' LOOP 
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_signature || ' CASCADE'; 
    END LOOP; 
END $$;

CREATE OR REPLACE FUNCTION get_alunos_em_risco_anual(
  limite_faltas INT,
  _escola_id UUID
)
RETURNS TABLE (
  aluno_id UUID,
  aluno_nome TEXT,
  turma_nome TEXT,
  total_faltas BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.nome,
    t.nome,
    COUNT(p.id) as total_faltas
  FROM alunos a
  JOIN turmas t ON a.turma_id = t.id
  JOIN presencas p ON p.aluno_id = a.id
  WHERE a.escola_id = _escola_id
    AND p.presente = FALSE
    AND p.escola_id = _escola_id
  GROUP BY a.id, a.nome, t.nome
  HAVING COUNT(p.id) >= limite_faltas
  ORDER BY total_faltas DESC
  LIMIT 20;
END;
$$;

-- 5. get_alunos_faltas_consecutivas
DO $$ 
DECLARE 
    r RECORD;
BEGIN 
    FOR r IN SELECT oid::regprocedure AS func_signature FROM pg_proc WHERE proname = 'get_alunos_faltas_consecutivas' LOOP 
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_signature || ' CASCADE'; 
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
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH RecentFaltas AS (
     SELECT
       p.aluno_id,
       COUNT(*) as faltas_recentes
     FROM presencas p
     WHERE p.escola_id = _escola_id
       AND p.presente = FALSE
       AND p.data_chamada >= (CURRENT_DATE - (dias_seguidos || ' days')::INTERVAL)
     GROUP BY p.aluno_id
  )
  SELECT
    a.id,
    a.nome,
    t.nome,
    rf.faltas_recentes
  FROM RecentFaltas rf
  JOIN alunos a ON rf.aluno_id = a.id
  JOIN turmas t ON a.turma_id = t.id
  WHERE rf.faltas_recentes >= dias_seguidos;
END;
$$;

-- 6. get_ultimas_observacoes
DO $$ 
DECLARE 
    r RECORD;
BEGIN 
    FOR r IN SELECT oid::regprocedure AS func_signature FROM pg_proc WHERE proname = 'get_ultimas_observacoes' LOOP 
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_signature || ' CASCADE'; 
    END LOOP; 
END $$;

CREATE OR REPLACE FUNCTION get_ultimas_observacoes(
  limite INT,
  _escola_id UUID
)
RETURNS TABLE (
  id UUID,
  aluno_nome TEXT,
  titulo TEXT,
  data_criacao TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.id,
    a.nome,
    o.titulo,
    o.created_at
  FROM observacoes_alunos o
  JOIN alunos a ON o.aluno_id = a.id
  WHERE o.escola_id = _escola_id
  ORDER BY o.created_at DESC
  LIMIT limite;
END;
$$;

-- 7. get_ultimas_presencas_aluno
DO $$ 
DECLARE 
    r RECORD;
BEGIN 
    FOR r IN SELECT oid::regprocedure AS func_signature FROM pg_proc WHERE proname = 'get_ultimas_presencas_aluno' LOOP 
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_signature || ' CASCADE'; 
    END LOOP; 
END $$;

CREATE OR REPLACE FUNCTION get_ultimas_presencas_aluno(p_aluno_id UUID)
RETURNS TABLE (
    data_chamada DATE,
    presente BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.data_chamada::DATE, 
        p.presente
    FROM presencas p
    WHERE p.aluno_id = p_aluno_id
    ORDER BY p.data_chamada DESC
    LIMIT 5;
END;
$$;

GRANT EXECUTE ON FUNCTION get_comparativo_turmas TO authenticated;
GRANT EXECUTE ON FUNCTION get_escola_kpis TO authenticated;
GRANT EXECUTE ON FUNCTION get_kpis_administrativos TO authenticated;
GRANT EXECUTE ON FUNCTION get_alunos_em_risco_anual TO authenticated;
GRANT EXECUTE ON FUNCTION get_alunos_faltas_consecutivas TO authenticated;
GRANT EXECUTE ON FUNCTION get_ultimas_observacoes TO authenticated;
GRANT EXECUTE ON FUNCTION get_ultimas_presencas_aluno TO authenticated;
GRANT EXECUTE ON FUNCTION get_comparativo_turmas TO authenticated;
GRANT EXECUTE ON FUNCTION get_escola_kpis TO authenticated;
GRANT EXECUTE ON FUNCTION get_kpis_administrativos TO authenticated;
GRANT EXECUTE ON FUNCTION get_alunos_em_risco_anual TO authenticated;
GRANT EXECUTE ON FUNCTION get_alunos_faltas_consecutivas TO authenticated;
GRANT EXECUTE ON FUNCTION get_ultimas_observacoes TO authenticated;
GRANT EXECUTE ON FUNCTION get_ultimas_presencas_aluno TO authenticated;

-- 8. get_frequencia_por_disciplina
DO $$ 
DECLARE 
    r RECORD;
BEGIN 
    FOR r IN SELECT oid::regprocedure AS func_signature FROM pg_proc WHERE proname = 'get_frequencia_por_disciplina' LOOP 
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_signature || ' CASCADE'; 
    END LOOP; 
END $$;

CREATE OR REPLACE FUNCTION get_frequencia_por_disciplina(
    p_escola_id UUID,
    p_ano_letivo_id UUID DEFAULT NULL
)
RETURNS TABLE (
    disciplina_id UUID,
    disciplina_nome TEXT,
    total_presencas INT,
    total_faltas INT,
    total_aulas INT,
    taxa_frequencia NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id as disciplina_id,
        d.nome as disciplina_nome,
        COUNT(CASE WHEN p.presente = true THEN 1 END)::INT as total_presencas,
        COUNT(CASE WHEN p.presente = false THEN 1 END)::INT as total_faltas,
        COUNT(*)::INT as total_aulas,
        CASE 
            WHEN COUNT(*) = 0 THEN 0 
            ELSE ROUND((COUNT(CASE WHEN p.presente = true THEN 1 END)::NUMERIC / COUNT(*)::NUMERIC) * 100, 2)
        END as taxa_frequencia
    FROM presencas p
    JOIN disciplinas d ON p.disciplina_id = d.id
    WHERE p.escola_id = p_escola_id
    AND (p_ano_letivo_id IS NULL OR EXISTS (
        SELECT 1 FROM turmas t 
        WHERE t.id = p.turma_id 
        AND t.ano_letivo_id = p_ano_letivo_id
    ))
    GROUP BY d.id, d.nome
    ORDER BY taxa_frequencia ASC;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_frequencia_por_disciplina TO authenticated;
