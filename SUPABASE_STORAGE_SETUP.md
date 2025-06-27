# Configuração do Supabase Storage para Logos da Escola

Este documento explica como configurar o Supabase Storage para permitir o upload e visualização dos logos das escolas.

## 1. Criar o Bucket

### Via Dashboard do Supabase:

1. Acesse o [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecione seu projeto
3. Vá para **Storage** no menu lateral
4. Clique em **New bucket**
5. Configure o bucket:
   - **Name**: `escola-assets`
   - **Public bucket**: ✅ Marque esta opção
   - **File size limit**: `5 MB`
   - **Allowed MIME types**: `image/jpeg, image/png, image/gif, image/webp`

### Via SQL (opcional):

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'escola-assets',
  'escola-assets',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
);
```

## 2. Configurar Políticas de Segurança

### Política 1: Permitir Upload de Logos

**Nome da Política**: `Permitir upload de logos da escola`

**Configuração**:
- **Target roles**: `authenticated`
- **Policy definition**:
```sql
(bucket_id = 'escola-assets' AND 
 (storage.extension(name)) = ANY(ARRAY['jpg', 'jpeg', 'png', 'gif', 'webp']))
```

### Política 2: Visualização Pública

**Nome da Política**: `Visualização pública dos logos da escola`

**Configuração**:
- **Target roles**: `anon, authenticated`
- **Policy definition**:
```sql
(bucket_id = 'escola-assets')
```

### Política 3: Atualização de Logos

**Nome da Política**: `Permitir atualização de logos da escola`

**Configuração**:
- **Target roles**: `authenticated`
- **Policy definition**:
```sql
(bucket_id = 'escola-assets')
```

### Política 4: Exclusão de Logos

**Nome da Política**: `Permitir exclusão de logos da escola`

**Configuração**:
- **Target roles**: `authenticated`
- **Policy definition**:
```sql
(bucket_id = 'escola-assets')
```

## 3. Configuração via Dashboard

### Passo a Passo:

1. **Acesse Storage > Policies**
2. **Clique em "New Policy"**
3. **Configure cada política**:

#### Para Upload:
- **Policy name**: `Permitir upload de logos da escola`
- **Allowed operation**: `INSERT`
- **Target roles**: `authenticated`
- **Policy definition**: Cole o SQL da Política 1

#### Para Visualização:
- **Policy name**: `Visualização pública dos logos da escola`
- **Allowed operation**: `SELECT`
- **Target roles**: `anon, authenticated`
- **Policy definition**: Cole o SQL da Política 2

#### Para Atualização:
- **Policy name**: `Permitir atualização de logos da escola`
- **Allowed operation**: `UPDATE`
- **Target roles**: `authenticated`
- **Policy definition**: Cole o SQL da Política 3

#### Para Exclusão:
- **Policy name**: `Permitir exclusão de logos da escola`
- **Allowed operation**: `DELETE`
- **Target roles**: `authenticated`
- **Policy definition**: Cole o SQL da Política 4

## 4. Verificação da Configuração

### Teste de Upload:

1. Acesse a página `/perfil-escola` no seu aplicativo
2. Tente fazer upload de uma imagem
3. Verifique se o upload foi bem-sucedido
4. Verifique se a imagem aparece no preview

### Teste de Visualização:

1. Após o upload, verifique se a imagem é exibida corretamente
2. Teste acessando a URL da imagem diretamente no navegador
3. Verifique se a imagem aparece no sidebar da aplicação

## 5. Troubleshooting

### Problema: "Upload failed"

**Possíveis causas**:
- Bucket não criado
- Política de upload não configurada
- Arquivo muito grande (>5MB)
- Tipo de arquivo não permitido

**Solução**:
1. Verifique se o bucket `escola-assets` existe
2. Confirme se a política de INSERT está configurada
3. Verifique o tamanho e tipo do arquivo

### Problema: "Image not loading"

**Possíveis causas**:
- Política de visualização não configurada
- URL incorreta
- Bucket não é público

**Solução**:
1. Verifique se a política de SELECT está configurada
2. Confirme se o bucket é público
3. Verifique a URL gerada

### Problema: "Permission denied"

**Possíveis causas**:
- Usuário não autenticado
- Políticas muito restritivas

**Solução**:
1. Verifique se o usuário está logado
2. Confirme se as políticas estão corretas
3. Teste com diferentes tipos de usuário

## 6. Configuração Avançada

### Limitar por Usuário (Opcional):

Se quiser que cada usuário só possa gerenciar seus próprios logos:

```sql
-- Política mais restritiva para upload
CREATE POLICY "Permitir upload de logos da escola por usuário" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'escola-assets' AND 
  (storage.extension(name)) = ANY(ARRAY['jpg', 'jpeg', 'png', 'gif', 'webp']) AND
  auth.uid()::text = (storage.foldername(name))[1]
);
```

### Organizar por Pastas:

Para organizar melhor os arquivos, você pode usar pastas:

```typescript
// No código do upload
const filePath = `logos/${auth.user.id}/${fileName}`;
```

### Backup e Limpeza:

Configure uma função para limpar logos antigos:

```sql
-- Função para limpar logos antigos (executar periodicamente)
CREATE OR REPLACE FUNCTION cleanup_old_logos()
RETURNS void AS $$
BEGIN
  DELETE FROM storage.objects 
  WHERE bucket_id = 'escola-assets' 
  AND created_at < NOW() - INTERVAL '30 days'
  AND name NOT IN (
    SELECT url_logo FROM escola_configuracao 
    WHERE url_logo IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql;
```

## 7. Monitoramento

### Verificar Uso do Storage:

```sql
-- Verificar tamanho total dos logos
SELECT 
  bucket_id,
  COUNT(*) as total_files,
  SUM(metadata->>'size')::bigint as total_size_bytes
FROM storage.objects 
WHERE bucket_id = 'escola-assets'
GROUP BY bucket_id;
```

### Logs de Upload:

```sql
-- Verificar uploads recentes
SELECT 
  name,
  created_at,
  metadata->>'size' as file_size,
  metadata->>'mimetype' as mime_type
FROM storage.objects 
WHERE bucket_id = 'escola-assets'
ORDER BY created_at DESC
LIMIT 10;
```

## 8. Segurança Adicional

### Validação de Arquivos:

No código da aplicação, sempre valide:

```typescript
// Verificar tipo de arquivo
if (!file.type.startsWith('image/')) {
  throw new Error('Apenas arquivos de imagem são permitidos');
}

// Verificar tamanho
if (file.size > 5 * 1024 * 1024) {
  throw new Error('Arquivo muito grande (máximo 5MB)');
}

// Verificar extensão
const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
const fileExtension = file.name.split('.').pop()?.toLowerCase();
if (!allowedExtensions.includes(fileExtension)) {
  throw new Error('Tipo de arquivo não permitido');
}
```

### Sanitização de Nomes:

```typescript
// Gerar nome seguro para o arquivo
const timestamp = Date.now();
const fileExtension = file.name.split('.').pop();
const safeFileName = `logo_${timestamp}.${fileExtension}`;
``` 