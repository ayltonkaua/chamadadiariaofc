-- Migration: 20240125_fix_schema_and_rpcs.sql
-- Purpose: Consolidate Schema fixes (missing columns/tables) and Dashboard RPCs into one guaranteed script.
-- Recommended execution: Run this entire script in Supabase SQL Editor.

-- ============================================================================
-- 1. ENSURE FOUNDATION TABLES (anos_letivos)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.anos_letivos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    escola_id uuid NOT NULL REFERENCES public.escola_configuracao(id) ON DELETE CASCADE,
    ano integer NOT NULL,
    nome text NOT NULL,
    data_inicio date NOT NULL,
    data_fim date NOT NULL,
    status text NOT NULL DEFAULT 'aberto' 
        CHECK (status IN ('planejamento', 'aberto', 'fechado')),
    criado_por uuid REFERENCES auth.users(id),
    fechado_por uuid REFERENCES auth.users(id),
    fechado_em timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT uq_escola_ano UNIQUE (escola_id, ano),
    CONSTRAINT chk_datas CHECK (data_fim > data_inicio)
);

-- Indexes for anos_letivos
CREATE UNIQUE INDEX IF NOT EXISTS idx_unico_ano_aberto ON public.anos_letivos(escola_id) WHERE status = 'aberto';
CREATE INDEX IF NOT EXISTS idx_anos_letivos_escola_status ON public.anos_letivos(escola_id, status);

-- RLS for anos_letivos
ALTER TABLE public.anos_letivos ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'anos_letivos' AND policyname = 'Usuarios podem ver anos da sua escola') THEN
        CREATE POLICY "Usuarios podem ver anos da sua escola" ON public.anos_letivos FOR SELECT USING (
            escola_id IN (SELECT ur.escola_id FROM public.user_roles ur WHERE ur.user_id = auth.uid())
        );
    END IF;
    
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'anos_letivos' AND policyname = 'Diretor_Secretario podem gerenciar anos') THEN
        CREATE POLICY "Diretor_Secretario podem gerenciar anos" ON public.anos_letivos FOR ALL USING (
            EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.escola_id = anos_letivos.escola_id AND ur.role IN ('diretor', 'secretario', 'admin', 'super_admin'))
        );
    END IF;
END $$;

-- ============================================================================
-- 2. ENSURE COLUMNS ON turmas
-- ============================================================================

ALTER TABLE public.turmas 
ADD COLUMN IF NOT EXISTS ano_letivo_id uuid REFERENCES public.anos_letivos(id);

CREATE INDEX IF NOT EXISTS idx_turmas_ano_letivo ON public.turmas(ano_letivo_id);
CREATE INDEX IF NOT EXISTS idx_turmas_escola_ano ON public.turmas(escola_id, ano_letivo_id);

-- ============================================================================
-- 3. DEFINE DASHBOARD RPCs (Safe Dynamic Drop)
-- ============================================================================

-- Function: get_comparativo_turmas
DO $$ DECLARE r RECORD; BEGIN 
    FOR r IN SELECT oid::regprocedure AS func_signature FROM pg_proc WHERE proname = 'get_comparativo_turmas' LOOP 
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_signature || ' CASCADE'; 
    END LOOP; 
END $$;

CREATE OR REPLACE FUNCTION get_comparativo_turmas(
  p_escola_id UUID,
  p_ano_letivo_id UUID DEFAULT NULL
) RETURNS TABLE (
  turma_id UUID, turma_nome TEXT, total_presencas INT, total_faltas INT, taxa_presenca NUMERIC
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT t.id AS turma_id, t.nome AS turma_nome,
    COUNT(p.id) FILTER (WHERE p.presente = TRUE)::INT AS total_presencas,
    COUNT(p.id) FILTER (WHERE p.presente = FALSE)::INT AS total_faltas,
    ROUND(COALESCE((COUNT(p.id) FILTER (WHERE p.presente = TRUE)::NUMERIC / NULLIF(COUNT(p.id), 0)) * 100, 0), 1) AS taxa_presenca
  FROM turmas t
  LEFT JOIN presencas p ON p.turma_id = t.id AND p.escola_id = p_escola_id
  WHERE t.escola_id = p_escola_id AND t.ativo = TRUE
    AND (p_ano_letivo_id IS NULL OR t.ano_letivo_id = p_ano_letivo_id)
  GROUP BY t.id, t.nome
  ORDER BY taxa_presenca DESC;
END; $$;

-- Function: get_escola_kpis
DO $$ DECLARE r RECORD; BEGIN 
    FOR r IN SELECT oid::regprocedure AS func_signature FROM pg_proc WHERE proname = 'get_escola_kpis' LOOP 
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_signature || ' CASCADE'; 
    END LOOP; 
END $$;

CREATE OR REPLACE FUNCTION get_escola_kpis(_escola_id UUID) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_total_alunos INT; v_taxa_geral NUMERIC;
BEGIN
  SELECT COUNT(*) INTO v_total_alunos FROM alunos WHERE escola_id = _escola_id AND ativo = TRUE;
  SELECT ROUND(COALESCE(AVG(CASE WHEN presente THEN 100.0 ELSE 0.0 END), 0), 1) INTO v_taxa_geral
  FROM presencas WHERE escola_id = _escola_id AND data_chamada >= (CURRENT_DATE - INTERVAL '30 days');
  RETURN jsonb_build_object('total_alunos', v_total_alunos, 'taxa_presenca_geral', v_taxa_geral);
END; $$;

-- Function: get_kpis_administrativos
DO $$ DECLARE r RECORD; BEGIN 
    FOR r IN SELECT oid::regprocedure AS func_signature FROM pg_proc WHERE proname = 'get_kpis_administrativos' LOOP 
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_signature || ' CASCADE'; 
    END LOOP; 
END $$;

CREATE OR REPLACE FUNCTION get_kpis_administrativos(_escola_id UUID) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_atestados_pendentes INT;
BEGIN
  SELECT COUNT(*) INTO v_atestados_pendentes FROM atestados WHERE escola_id = _escola_id AND status = 'pendente';
  RETURN jsonb_build_object('atestados_pendentes', v_atestados_pendentes, 'justificativas_a_rever', 0);
END; $$;

-- Function: get_alunos_em_risco_anual
DO $$ DECLARE r RECORD; BEGIN 
    FOR r IN SELECT oid::regprocedure AS func_signature FROM pg_proc WHERE proname = 'get_alunos_em_risco_anual' LOOP 
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_signature || ' CASCADE'; 
    END LOOP; 
END $$;

CREATE OR REPLACE FUNCTION get_alunos_em_risco_anual(limite_faltas INT, _escola_id UUID) 
RETURNS TABLE (aluno_id UUID, aluno_nome TEXT, turma_nome TEXT, total_faltas BIGINT) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY SELECT a.id, a.nome, t.nome, COUNT(p.id) as total_faltas
  FROM alunos a JOIN turmas t ON a.turma_id = t.id JOIN presencas p ON p.aluno_id = a.id
  WHERE a.escola_id = _escola_id AND p.presente = FALSE AND p.escola_id = _escola_id
  GROUP BY a.id, a.nome, t.nome HAVING COUNT(p.id) >= limite_faltas ORDER BY total_faltas DESC LIMIT 20;
END; $$;

-- Function: get_alunos_faltas_consecutivas
DO $$ DECLARE r RECORD; BEGIN 
    FOR r IN SELECT oid::regprocedure AS func_signature FROM pg_proc WHERE proname = 'get_alunos_faltas_consecutivas' LOOP 
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_signature || ' CASCADE'; 
    END LOOP; 
END $$;

CREATE OR REPLACE FUNCTION get_alunos_faltas_consecutivas(dias_seguidos INT, _escola_id UUID) 
RETURNS TABLE (aluno_id UUID, aluno_nome TEXT, turma_nome TEXT, contagem_faltas_consecutivas BIGINT) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY WITH RecentFaltas AS (
     SELECT p.aluno_id, COUNT(*) as faltas_recentes FROM presencas p
     WHERE p.escola_id = _escola_id AND p.presente = FALSE AND p.data_chamada >= (CURRENT_DATE - (dias_seguidos || ' days')::INTERVAL)
     GROUP BY p.aluno_id
  )
  SELECT a.id, a.nome, t.nome, rf.faltas_recentes FROM RecentFaltas rf
  JOIN alunos a ON rf.aluno_id = a.id JOIN turmas t ON a.turma_id = t.id WHERE rf.faltas_recentes >= dias_seguidos;
END; $$;

-- Function: get_ultimas_observacoes
DO $$ DECLARE r RECORD; BEGIN 
    FOR r IN SELECT oid::regprocedure AS func_signature FROM pg_proc WHERE proname = 'get_ultimas_observacoes' LOOP 
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_signature || ' CASCADE'; 
    END LOOP; 
END $$;

CREATE OR REPLACE FUNCTION get_ultimas_observacoes(limite INT, _escola_id UUID) 
RETURNS TABLE (id UUID, aluno_nome TEXT, titulo TEXT, data_criacao TIMESTAMPTZ) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY SELECT o.id, a.nome, o.titulo, o.created_at
  FROM observacoes_alunos o JOIN alunos a ON o.aluno_id = a.id
  WHERE o.escola_id = _escola_id ORDER BY o.created_at DESC LIMIT limite;
END; $$;

-- Function: get_ultimas_presencas_aluno
DO $$ DECLARE r RECORD; BEGIN 
    FOR r IN SELECT oid::regprocedure AS func_signature FROM pg_proc WHERE proname = 'get_ultimas_presencas_aluno' LOOP 
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_signature || ' CASCADE'; 
    END LOOP; 
END $$;

CREATE OR REPLACE FUNCTION get_ultimas_presencas_aluno(p_aluno_id UUID) 
RETURNS TABLE (data_chamada DATE, presente BOOLEAN) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY SELECT p.data_chamada::DATE, p.presente FROM presencas p
    WHERE p.aluno_id = p_aluno_id ORDER BY p.data_chamada DESC LIMIT 5;
END; $$;

-- Function: get_frequencia_por_disciplina
DO $$ DECLARE r RECORD; BEGIN 
    FOR r IN SELECT oid::regprocedure AS func_signature FROM pg_proc WHERE proname = 'get_frequencia_por_disciplina' LOOP 
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_signature || ' CASCADE'; 
    END LOOP; 
END $$;

CREATE OR REPLACE FUNCTION get_frequencia_por_disciplina(p_escola_id UUID, p_ano_letivo_id UUID DEFAULT NULL) 
RETURNS TABLE (disciplina_id UUID, disciplina_nome TEXT, total_presencas INT, total_faltas INT, total_aulas INT, taxa_frequencia NUMERIC) 
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY SELECT d.id as disciplina_id, d.nome as disciplina_nome,
        COUNT(CASE WHEN p.presente = true THEN 1 END)::INT as total_presencas,
        COUNT(CASE WHEN p.presente = false THEN 1 END)::INT as total_faltas,
        COUNT(*)::INT as total_aulas,
        CASE WHEN COUNT(*) = 0 THEN 0 ELSE ROUND((COUNT(CASE WHEN p.presente = true THEN 1 END)::NUMERIC / COUNT(*)::NUMERIC) * 100, 2) END as taxa_frequencia
    FROM presencas p JOIN disciplinas d ON p.disciplina_id = d.id
    WHERE p.escola_id = p_escola_id AND (p_ano_letivo_id IS NULL OR EXISTS (SELECT 1 FROM turmas t WHERE t.id = p.turma_id AND t.ano_letivo_id = p_ano_letivo_id))
    GROUP BY d.id, d.nome ORDER BY taxa_frequencia ASC;
END; $$;

-- GRANTS
GRANT EXECUTE ON FUNCTION get_comparativo_turmas TO authenticated;
GRANT EXECUTE ON FUNCTION get_escola_kpis TO authenticated;
GRANT EXECUTE ON FUNCTION get_kpis_administrativos TO authenticated;
GRANT EXECUTE ON FUNCTION get_alunos_em_risco_anual TO authenticated;
GRANT EXECUTE ON FUNCTION get_alunos_faltas_consecutivas TO authenticated;
GRANT EXECUTE ON FUNCTION get_ultimas_observacoes TO authenticated;
GRANT EXECUTE ON FUNCTION get_ultimas_presencas_aluno TO authenticated;
GRANT EXECUTE ON FUNCTION get_frequencia_por_disciplina TO authenticated;
