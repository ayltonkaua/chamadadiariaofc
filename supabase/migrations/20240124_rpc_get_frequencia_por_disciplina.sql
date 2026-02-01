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
