-- ============================================================================
-- Migration: 023_add_get_ultimas_presencas_aluno_rpc.sql
-- Purpose: Create RPC for getting last attendances of a student
-- ChamadaDiária v2.1.0
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_ultimas_presencas_aluno(p_aluno_id UUID)
RETURNS TABLE (
    data_chamada DATE,
    presente BOOLEAN,
    falta_justificada BOOLEAN,
    turma_nome TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        p.data_chamada,
        p.presente,
        p.falta_justificada,
        t.nome as turma_nome
    FROM presencas p
    JOIN turmas t ON p.turma_id = t.id
    JOIN alunos a ON p.aluno_id = a.id
    WHERE p.aluno_id = p_aluno_id
      AND a.escola_id IN (
          SELECT escola_id FROM user_roles WHERE user_id = auth.uid()
      )
    ORDER BY p.data_chamada DESC
    LIMIT 10;
$$;

COMMENT ON FUNCTION public.get_ultimas_presencas_aluno IS 
'Returns last 10 attendances for a specific student. Used in dashboard for at-risk student details.';

GRANT EXECUTE ON FUNCTION public.get_ultimas_presencas_aluno TO authenticated;
