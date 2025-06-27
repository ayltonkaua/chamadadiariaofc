-- Criar tabela escola_configuracao
CREATE TABLE IF NOT EXISTS escola_configuracao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(255) NOT NULL,
  endereco TEXT NOT NULL,
  telefone VARCHAR(50) NOT NULL,
  email VARCHAR(255) NOT NULL,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  cor_primaria VARCHAR(7) NOT NULL DEFAULT '#7c3aed',
  cor_secundaria VARCHAR(7) NOT NULL DEFAULT '#f3f4f6',
  url_logo TEXT
);

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_escola_config_created_at ON escola_configuracao(criado_em);

-- Criar função para atualizar o timestamp de atualização
CREATE OR REPLACE FUNCTION update_escola_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para atualizar automaticamente o timestamp
CREATE TRIGGER trigger_update_escola_config_updated_at
  BEFORE UPDATE ON escola_configuracao
  FOR EACH ROW
  EXECUTE FUNCTION update_escola_config_updated_at();

-- Inserir configuração padrão
INSERT INTO escola_configuracao (nome, endereco, telefone, email, cor_primaria, cor_secundaria)
VALUES (
  'Minha Escola',
  'Endereço da escola',
  '(11) 1234-5678',
  'contato@escola.com',
  '#7c3aed',
  '#f3f4f6'
) ON CONFLICT DO NOTHING;

-- Configurar RLS (Row Level Security)
ALTER TABLE escola_configuracao ENABLE ROW LEVEL SECURITY;

-- Política para permitir leitura pública (para o tema da escola)
CREATE POLICY "Permitir leitura pública da configuração da escola" ON escola_configuracao
FOR SELECT USING (true);

-- Política para permitir inserção apenas para usuários autenticados
CREATE POLICY "Permitir inserção de configuração da escola" ON escola_configuracao
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Política para permitir atualização apenas para usuários autenticados
CREATE POLICY "Permitir atualização de configuração da escola" ON escola_configuracao
FOR UPDATE USING (auth.role() = 'authenticated');

-- Política para permitir exclusão apenas para usuários autenticados
CREATE POLICY "Permitir exclusão de configuração da escola" ON escola_configuracao
FOR DELETE USING (auth.role() = 'authenticated');

-- Configurar Storage para logos da escola
-- Nota: Estas políticas devem ser executadas no Supabase Dashboard ou via API

-- Criar bucket para assets da escola (se não existir)
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES (
--   'escola-assets',
--   'escola-assets',
--   true,
--   5242880, -- 5MB
--   ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
-- ) ON CONFLICT (id) DO NOTHING;

-- Política para permitir upload de imagens (executar no Dashboard)
-- CREATE POLICY "Permitir upload de logos da escola" ON storage.objects
-- FOR INSERT WITH CHECK (
--   bucket_id = 'escola-assets' AND 
--   (storage.extension(name)) = ANY(ARRAY['jpg', 'jpeg', 'png', 'gif', 'webp']) AND
--   auth.role() = 'authenticated'
-- );

-- Política para permitir visualização pública dos logos
-- CREATE POLICY "Visualização pública dos logos da escola" ON storage.objects
-- FOR SELECT USING (bucket_id = 'escola-assets');

-- Política para permitir atualização de logos
-- CREATE POLICY "Permitir atualização de logos da escola" ON storage.objects
-- FOR UPDATE USING (
--   bucket_id = 'escola-assets' AND 
--   auth.role() = 'authenticated'
-- );

-- Política para permitir exclusão de logos
-- CREATE POLICY "Permitir exclusão de logos da escola" ON storage.objects
-- FOR DELETE USING (
--   bucket_id = 'escola-assets' AND 
--   auth.role() = 'authenticated'
-- );

-- Comentários para documentação
COMMENT ON TABLE escola_configuracao IS 'Configurações personalizadas de cada escola';
COMMENT ON COLUMN escola_configuracao.nome IS 'Nome da instituição escolar';
COMMENT ON COLUMN escola_configuracao.endereco IS 'Endereço completo da escola';
COMMENT ON COLUMN escola_configuracao.telefone IS 'Telefone de contato da escola';
COMMENT ON COLUMN escola_configuracao.email IS 'E-mail de contato da escola';
COMMENT ON COLUMN escola_configuracao.cor_primaria IS 'Cor primária da identidade visual (formato hex)';
COMMENT ON COLUMN escola_configuracao.cor_secundaria IS 'Cor secundária da identidade visual (formato hex)';
COMMENT ON COLUMN escola_configuracao.url_logo IS 'URL do logo da escola no storage';
COMMENT ON COLUMN escola_configuracao.criado_em IS 'Data de criação do registro';
COMMENT ON COLUMN escola_configuracao.atualizado_em IS 'Data da última atualização'; 