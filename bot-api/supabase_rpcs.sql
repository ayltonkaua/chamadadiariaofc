-- ==========================================================================
-- Supabase RPCs for Alert Routes
-- 
-- These are OPTIONAL performance improvements. The JS code already uses
-- batch queries (.in()) as fallback.  Deploy these via Supabase Dashboard
-- → SQL Editor to further reduce round-trips.
-- ==========================================================================

-- 1. get_alunos_risco: students with absence rate > threshold
-- Returns: id, nome, nome_responsavel, telefone_responsavel, total_aulas, total_faltas, taxa_falta
CREATE OR REPLACE FUNCTION get_alunos_risco(p_escola_id uuid, p_threshold numeric DEFAULT 30)
RETURNS TABLE (
    id uuid,
    nome text,
    nome_responsavel text,
    telefone_responsavel text,
    total_aulas bigint,
    total_faltas bigint,
    taxa_falta numeric
)
LANGUAGE sql STABLE
AS $$
    SELECT
        a.id,
        a.nome,
        a.nome_responsavel,
        a.telefone_responsavel,
        COUNT(p.id) AS total_aulas,
        COUNT(p.id) FILTER (WHERE p.presente = false AND p.falta_justificada = false) AS total_faltas,
        CASE 
            WHEN COUNT(p.id) > 0 
            THEN ROUND((COUNT(p.id) FILTER (WHERE p.presente = false AND p.falta_justificada = false)::numeric / COUNT(p.id)) * 100, 2)
            ELSE 0
        END AS taxa_falta
    FROM alunos a
    JOIN presencas p ON p.aluno_id = a.id AND p.escola_id = a.escola_id
    WHERE a.escola_id = p_escola_id
      AND a.situacao = 'ativo'
      AND a.telefone_responsavel IS NOT NULL
    GROUP BY a.id, a.nome, a.nome_responsavel, a.telefone_responsavel
    HAVING CASE 
        WHEN COUNT(p.id) > 0 
        THEN (COUNT(p.id) FILTER (WHERE p.presente = false AND p.falta_justificada = false)::numeric / COUNT(p.id)) * 100
        ELSE 0
    END > p_threshold;
$$;

-- 2. get_faltas_mes: monthly absence counts per student
-- Returns: aluno_id, nome, nome_responsavel, telefone_responsavel, faltas_mes
CREATE OR REPLACE FUNCTION get_faltas_mes(p_escola_id uuid, p_first_day date, p_last_day date)
RETURNS TABLE (
    aluno_id uuid,
    nome text,
    nome_responsavel text,
    telefone_responsavel text,
    faltas_mes bigint
)
LANGUAGE sql STABLE
AS $$
    SELECT
        a.id AS aluno_id,
        a.nome,
        a.nome_responsavel,
        a.telefone_responsavel,
        COUNT(p.id) AS faltas_mes
    FROM alunos a
    JOIN presencas p ON p.aluno_id = a.id AND p.escola_id = a.escola_id
    WHERE a.escola_id = p_escola_id
      AND a.situacao = 'ativo'
      AND a.telefone_responsavel IS NOT NULL
      AND p.presente = false
      AND p.data_chamada >= p_first_day
      AND p.data_chamada <= p_last_day
    GROUP BY a.id, a.nome, a.nome_responsavel, a.telefone_responsavel
    HAVING COUNT(p.id) > 0;
$$;

-- 3. get_alunos_faltosos_dia: students absent on a specific date
-- Returns: aluno_id, nome, nome_responsavel, telefone_responsavel, turma_id, turma_nome
CREATE OR REPLACE FUNCTION get_alunos_faltosos_dia(p_escola_id uuid, p_data date)
RETURNS TABLE (
    aluno_id uuid,
    nome text,
    nome_responsavel text,
    telefone_responsavel text,
    turma_id uuid,
    turma_nome text
)
LANGUAGE sql STABLE
AS $$
    SELECT DISTINCT ON (a.id)
        a.id AS aluno_id,
        a.nome,
        a.nome_responsavel,
        a.telefone_responsavel,
        a.turma_id,
        t.nome AS turma_nome
    FROM presencas p
    JOIN alunos a ON a.id = p.aluno_id
    LEFT JOIN turmas t ON t.id = a.turma_id
    WHERE p.escola_id = p_escola_id
      AND p.data_chamada = p_data
      AND p.presente = false
      AND p.falta_justificada = false
      AND a.situacao = 'ativo'
    ORDER BY a.id, a.nome;
$$;

-- 4. get_presencas_recentes: last N presencas for multiple students
-- Useful for computing consecutive absences in batch.
-- Note: This returns ALL rows — caller should group by aluno_id and limit per student.
CREATE OR REPLACE FUNCTION get_presencas_recentes(p_escola_id uuid, p_aluno_ids uuid[], p_limit int DEFAULT 10)
RETURNS TABLE (
    aluno_id uuid,
    presente boolean,
    falta_justificada boolean,
    data_chamada date,
    row_num bigint
)
LANGUAGE sql STABLE
AS $$
    SELECT sub.aluno_id, sub.presente, sub.falta_justificada, sub.data_chamada, sub.rn
    FROM (
        SELECT
            p.aluno_id,
            p.presente,
            p.falta_justificada,
            p.data_chamada,
            ROW_NUMBER() OVER (PARTITION BY p.aluno_id ORDER BY p.data_chamada DESC) AS rn
        FROM presencas p
        WHERE p.escola_id = p_escola_id
          AND p.aluno_id = ANY(p_aluno_ids)
    ) sub
    WHERE sub.rn <= p_limit
    ORDER BY sub.aluno_id, sub.data_chamada DESC;
$$;
