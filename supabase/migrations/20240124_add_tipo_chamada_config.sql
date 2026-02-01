-- Adiciona coluna tipo_chamada na tabela escola_configuracao
ALTER TABLE escola_configuracao 
ADD COLUMN tipo_chamada TEXT DEFAULT 'diaria' CHECK (tipo_chamada IN ('diaria', 'disciplina'));

-- Comentário na coluna
COMMENT ON COLUMN escola_configuracao.tipo_chamada IS 'Tipo de chamada: diaria (padrão) ou disciplina';
