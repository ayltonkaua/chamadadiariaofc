-- Add disciplina_id to presencas table
ALTER TABLE presencas
ADD COLUMN IF NOT EXISTS disciplina_id UUID REFERENCES disciplinas(id) ON DELETE SET NULL;

-- Add index to improve query performance
CREATE INDEX IF NOT EXISTS idx_presencas_disciplina_id ON presencas(disciplina_id);

-- Add comment
COMMENT ON COLUMN presencas.disciplina_id IS 'Disciplina associada à chamada (opcional para compatibilidade)';
