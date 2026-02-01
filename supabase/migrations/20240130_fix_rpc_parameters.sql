-- ============================================================================
-- SCRIPT BASEADO NO SCHEMA REAL DO BANCO DE DADOS
-- Execute este script COMPLETO no Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- 1. DROP TODAS AS FUNÇÕES EXISTENTES (força limpeza completa)
-- ============================================================================

-- Método seguro para dropar todas as versões de uma função
DO $$ 
DECLARE r RECORD; 
BEGIN 
    FOR r IN SELECT oid::regprocedure AS func FROM pg_proc WHERE proname = 'get_comparativo_turmas' LOOP 
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func || ' CASCADE'; 
    END LOOP; 
    FOR r IN SELECT oid::regprocedure AS func FROM pg_proc WHERE proname = 'get_escola_kpis' LOOP 
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func || ' CASCADE'; 
    END LOOP; 
    FOR r IN SELECT oid::regprocedure AS func FROM pg_proc WHERE proname = 'get_kpis_administrativos' LOOP 
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func || ' CASCADE'; 
    END LOOP; 
    FOR r IN SELECT oid::regprocedure AS func FROM pg_proc WHERE proname = 'get_alunos_em_risco_anual' LOOP 
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func || ' CASCADE'; 
    END LOOP; 
    FOR r IN SELECT oid::regprocedure AS func FROM pg_proc WHERE proname = 'get_alunos_faltas_consecutivas' LOOP 
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func || ' CASCADE'; 
    END LOOP; 
    FOR r IN SELECT oid::regprocedure AS func FROM pg_proc WHERE proname = 'get_ultimas_observacoes' LOOP 
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func || ' CASCADE'; 
    END LOOP; 
    FOR r IN SELECT oid::regprocedure AS func FROM pg_proc WHERE proname = 'get_ultimas_presencas_aluno' LOOP 
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func || ' CASCADE'; 
    END LOOP; 
    FOR r IN SELECT oid::regprocedure AS func FROM pg_proc WHERE proname = 'get_frequencia_por_disciplina' LOOP 
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func || ' CASCADE'; 
    END LOOP; 
END $$;

-- ============================================================================
-- 2. get_comparativo_turmas
-- Parâmetros usados pelo código: p_escola_id, p_ano_letivo_id
-- Tabelas usadas: turmas (tem ano_letivo_id), presencas
-- ============================================================================
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
LANGUAGE plpgsql SECURITY DEFINER 
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id AS turma_id, 
        t.nome AS turma_nome,
        COALESCE(COUNT(p.id) FILTER (WHERE p.presente = TRUE), 0)::INT AS total_presencas,
        COALESCE(COUNT(p.id) FILTER (WHERE p.presente = FALSE), 0)::INT AS total_faltas,
        ROUND(
            COALESCE(
                (COUNT(p.id) FILTER (WHERE p.presente = TRUE)::NUMERIC / NULLIF(COUNT(p.id), 0)) * 100, 
                0
            ), 1
        ) AS taxa_presenca
    FROM public.turmas t
    LEFT JOIN public.presencas p ON p.turma_id = t.id
    WHERE t.escola_id = p_escola_id
      AND (p_ano_letivo_id IS NULL OR t.ano_letivo_id = p_ano_letivo_id)
    GROUP BY t.id, t.nome
    ORDER BY taxa_presenca DESC;
END;
$$;

-- ============================================================================
-- 3. get_escola_kpis
-- Parâmetros usados pelo código: _escola_id
-- Tabelas usadas: alunos, presencas
-- ============================================================================
CREATE OR REPLACE FUNCTION get_escola_kpis(_escola_id UUID) 
RETURNS JSONB 
LANGUAGE plpgsql SECURITY DEFINER 
AS $$
DECLARE 
    v_total_alunos INT; 
    v_taxa_geral NUMERIC;
BEGIN
    -- Conta alunos ativos (situacao = 'ativo')
    SELECT COUNT(*) INTO v_total_alunos 
    FROM public.alunos 
    WHERE escola_id = _escola_id 
      AND situacao = 'ativo';
    
    -- Taxa de presença dos últimos 30 dias
    SELECT ROUND(COALESCE(AVG(CASE WHEN presente THEN 100.0 ELSE 0.0 END), 0), 1) 
    INTO v_taxa_geral
    FROM public.presencas 
    WHERE escola_id = _escola_id 
      AND data_chamada >= (CURRENT_DATE - INTERVAL '30 days');
    
    RETURN jsonb_build_object(
        'total_alunos', COALESCE(v_total_alunos, 0), 
        'taxa_presenca_geral', COALESCE(v_taxa_geral, 0)
    );
END;
$$;

-- ============================================================================
-- 4. get_kpis_administrativos
-- Parâmetros usados pelo código: _escola_id
-- Tabelas usadas: atestados (tem status), presencas (tem falta_justificada)
-- ============================================================================
CREATE OR REPLACE FUNCTION get_kpis_administrativos(_escola_id UUID) 
RETURNS JSONB 
LANGUAGE plpgsql SECURITY DEFINER 
AS $$
DECLARE 
    v_atestados_pendentes INT := 0;
    v_atestados_aprovados INT := 0;
    v_atestados_rejeitados INT := 0;
    v_faltas_justificadas INT := 0;
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
    
    -- Faltas com justificativa (falta_justificada = true)
    SELECT COUNT(*) INTO v_faltas_justificadas
    FROM public.presencas
    WHERE escola_id = _escola_id 
      AND presente = FALSE 
      AND falta_justificada = TRUE
      AND data_chamada >= (CURRENT_DATE - INTERVAL '30 days');
    
    RETURN jsonb_build_object(
        'atestados_pendentes', COALESCE(v_atestados_pendentes, 0), 
        'atestados_aprovados', COALESCE(v_atestados_aprovados, 0),
        'atestados_rejeitados', COALESCE(v_atestados_rejeitados, 0),
        'faltas_justificadas', COALESCE(v_faltas_justificadas, 0),
        'justificativas_a_rever', COALESCE(v_atestados_pendentes, 0)
    );
END;
$$;

-- ============================================================================
-- 5. get_alunos_em_risco_anual
-- Parâmetros usados pelo código: limite_faltas, _escola_id
-- Tabelas usadas: alunos (situacao), turmas, presencas
-- ============================================================================
CREATE OR REPLACE FUNCTION get_alunos_em_risco_anual(limite_faltas INT, _escola_id UUID) 
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
    GROUP BY a.id, a.nome, t.nome 
    HAVING COUNT(p.id) >= limite_faltas 
    ORDER BY total_faltas DESC 
    LIMIT 20;
END;
$$;

-- ============================================================================
-- 6. get_alunos_faltas_consecutivas
-- Parâmetros usados pelo código: dias_seguidos, _escola_id
-- Tabelas usadas: alunos, turmas, presencas
-- ============================================================================
CREATE OR REPLACE FUNCTION get_alunos_faltas_consecutivas(dias_seguidos INT, _escola_id UUID) 
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
    WITH RecentFaltas AS (
        SELECT 
            p.aluno_id AS aid, 
            COUNT(*) AS faltas_recentes 
        FROM public.presencas p
        WHERE p.escola_id = _escola_id 
          AND p.presente = FALSE 
          AND p.data_chamada >= (CURRENT_DATE - (dias_seguidos || ' days')::INTERVAL)
        GROUP BY p.aluno_id
    )
    SELECT 
        a.id AS aluno_id, 
        a.nome AS aluno_nome, 
        t.nome AS turma_nome, 
        rf.faltas_recentes AS contagem_faltas_consecutivas
    FROM RecentFaltas rf
    JOIN public.alunos a ON rf.aid = a.id 
    JOIN public.turmas t ON a.turma_id = t.id 
    WHERE rf.faltas_recentes >= dias_seguidos
      AND a.situacao = 'ativo';
END;
$$;

-- ============================================================================
-- 7. get_ultimas_observacoes
-- Parâmetros usados pelo código: limite, _escola_id
-- Tabelas usadas: observacoes_alunos (tem titulo, created_at), alunos
-- ============================================================================
CREATE OR REPLACE FUNCTION get_ultimas_observacoes(limite INT, _escola_id UUID) 
RETURNS TABLE (
    id UUID, 
    aluno_nome TEXT, 
    titulo TEXT, 
    data_criacao TIMESTAMPTZ
) 
LANGUAGE plpgsql SECURITY DEFINER 
AS $$
BEGIN
    RETURN QUERY 
    SELECT 
        o.id, 
        a.nome AS aluno_nome, 
        o.titulo, 
        o.created_at AS data_criacao
    FROM public.observacoes_alunos o 
    JOIN public.alunos a ON o.aluno_id = a.id
    WHERE o.escola_id = _escola_id 
    ORDER BY o.created_at DESC 
    LIMIT limite;
END;
$$;

-- ============================================================================
-- 8. get_ultimas_presencas_aluno
-- Parâmetros usados pelo código: p_aluno_id
-- Tabelas usadas: presencas
-- ============================================================================
CREATE OR REPLACE FUNCTION get_ultimas_presencas_aluno(p_aluno_id UUID) 
RETURNS TABLE (
    data_chamada DATE, 
    presente BOOLEAN
) 
LANGUAGE plpgsql SECURITY DEFINER 
AS $$
BEGIN
    RETURN QUERY 
    SELECT 
        p.data_chamada::DATE, 
        p.presente 
    FROM public.presencas p
    WHERE p.aluno_id = p_aluno_id 
    ORDER BY p.data_chamada DESC 
    LIMIT 5;
END;
$$;

-- ============================================================================
-- 9. get_frequencia_por_disciplina
-- Parâmetros usados pelo código: p_escola_id, p_ano_letivo_id
-- Tabelas usadas: presencas (tem disciplina_id!), disciplinas, turmas
-- ============================================================================
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
) 
LANGUAGE plpgsql SECURITY DEFINER 
AS $$
BEGIN
    RETURN QUERY 
    SELECT 
        d.id AS disciplina_id, 
        d.nome AS disciplina_nome,
        COUNT(CASE WHEN p.presente = TRUE THEN 1 END)::INT AS total_presencas,
        COUNT(CASE WHEN p.presente = FALSE THEN 1 END)::INT AS total_faltas,
        COUNT(*)::INT AS total_aulas,
        CASE 
            WHEN COUNT(*) = 0 THEN 0 
            ELSE ROUND((COUNT(CASE WHEN p.presente = TRUE THEN 1 END)::NUMERIC / COUNT(*)::NUMERIC) * 100, 2) 
        END AS taxa_frequencia
    FROM public.presencas p 
    JOIN public.disciplinas d ON p.disciplina_id = d.id
    LEFT JOIN public.turmas t ON p.turma_id = t.id
    WHERE p.escola_id = p_escola_id
      AND (p_ano_letivo_id IS NULL OR t.ano_letivo_id = p_ano_letivo_id)
    GROUP BY d.id, d.nome 
    ORDER BY taxa_frequencia ASC;
END;
$$;

-- ============================================================================
-- 10. GRANTS para usuários autenticados
-- ============================================================================
GRANT EXECUTE ON FUNCTION get_comparativo_turmas TO authenticated;
GRANT EXECUTE ON FUNCTION get_escola_kpis TO authenticated;
GRANT EXECUTE ON FUNCTION get_kpis_administrativos TO authenticated;
GRANT EXECUTE ON FUNCTION get_alunos_em_risco_anual TO authenticated;
GRANT EXECUTE ON FUNCTION get_alunos_faltas_consecutivas TO authenticated;
GRANT EXECUTE ON FUNCTION get_ultimas_observacoes TO authenticated;
GRANT EXECUTE ON FUNCTION get_ultimas_presencas_aluno TO authenticated;
GRANT EXECUTE ON FUNCTION get_frequencia_por_disciplina TO authenticated;

-- ============================================================================
-- VERIFICAÇÃO: Mensagem de sucesso
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '========================================================';
    RAISE NOTICE 'SCRIPT EXECUTADO COM SUCESSO!';
    RAISE NOTICE 'Todas as 8 funções RPC foram criadas/atualizadas.';
    RAISE NOTICE 'Recarregue a página do dashboard para testar.';
    RAISE NOTICE '========================================================';
END $$;
