# Migração: Adicionar escola_id às tabelas turmas e presencas

## Descrição
Esta migração adiciona o campo `escola_id` às tabelas `turmas` e `presencas` para permitir que cada turma e presença seja associada a uma escola específica.

## Arquivos de Migração
- `supabase/migrations/003_add_escola_id_to_turmas.sql`
- `supabase/migrations/004_add_escola_id_to_presencas.sql`

## Como Aplicar

### 1. Via Supabase Dashboard
1. Acesse o Supabase Dashboard
2. Vá para a seção "SQL Editor"
3. Execute o conteúdo do arquivo `003_add_escola_id_to_turmas.sql`
4. Execute o conteúdo do arquivo `004_add_escola_id_to_presencas.sql`

### 2. Via Supabase CLI
```bash
supabase db push
```

## O que as migrações fazem:

### Migração 003 - Tabela turmas:
1. **Adiciona o campo `escola_id`** à tabela `turmas`
2. **Cria uma foreign key** para `escola_configuracao(id)`
3. **Adiciona um índice** para melhor performance
4. **Habilita Row Level Security (RLS)** na tabela
5. **Cria políticas de segurança** para todas as operações

### Migração 004 - Tabela presencas:
1. **Adiciona o campo `escola_id`** à tabela `presencas`
2. **Cria uma foreign key** para `escola_configuracao(id)`
3. **Adiciona um índice** para melhor performance
4. **Habilita Row Level Security (RLS)** na tabela
5. **Cria políticas de segurança** para todas as operações

## Políticas de Segurança Criadas:
- **SELECT**: Usuários veem apenas dados de sua escola
- **INSERT**: Usuários podem criar dados apenas em sua escola
- **UPDATE**: Usuários podem editar apenas dados de sua escola
- **DELETE**: Usuários podem deletar apenas dados de sua escola

## Impacto
- Todas as turmas e presenças existentes terão `escola_id` como NULL
- Novas turmas e presenças criadas precisarão ter `escola_id` definido
- Usuários só verão dados de sua própria escola
- InfoCards mostrarão dados corretos por escola

## Após a migração
1. Execute o deploy da aplicação
2. Teste a criação de novas turmas
3. Teste a realização de chamadas
4. Verifique se os InfoCards mostram dados corretos
5. Teste a consulta de alunos por escola

## Rollback (se necessário)
```sql
-- Remover políticas da tabela presencas
DROP POLICY IF EXISTS "Usuários podem ver presenças de sua escola" ON public.presencas;
DROP POLICY IF EXISTS "Usuários podem inserir presenças em sua escola" ON public.presencas;
DROP POLICY IF EXISTS "Usuários podem atualizar presenças de sua escola" ON public.presencas;
DROP POLICY IF EXISTS "Usuários podem deletar presenças de sua escola" ON public.presencas;

-- Remover políticas da tabela turmas
DROP POLICY IF EXISTS "Usuários podem ver turmas de sua escola" ON public.turmas;
DROP POLICY IF EXISTS "Usuários podem inserir turmas em sua escola" ON public.turmas;
DROP POLICY IF EXISTS "Usuários podem atualizar turmas de sua escola" ON public.turmas;
DROP POLICY IF EXISTS "Usuários podem deletar turmas de sua escola" ON public.turmas;

-- Desabilitar RLS
ALTER TABLE public.presencas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.turmas DISABLE ROW LEVEL SECURITY;

-- Remover índices
DROP INDEX IF EXISTS idx_presencas_escola_id;
DROP INDEX IF EXISTS idx_turmas_escola_id;

-- Remover colunas
ALTER TABLE public.presencas DROP COLUMN IF EXISTS escola_id;
ALTER TABLE public.turmas DROP COLUMN IF EXISTS escola_id;
``` 