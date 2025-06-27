# Correção do Erro de RLS na Tabela user_roles

## Problema
Ao tentar criar uma escola, o sistema apresenta o erro:
```
Erro ao criar role do usuário: Object
code: "42501"
message: "new row violates row-level security policy for table \"user_roles\""
```

## Causa
As políticas de Row Level Security (RLS) na tabela `user_roles` estão impedindo que usuários autenticados criem seus próprios registros.

## Solução

### 1. Aplicar a Migração Corretiva

Execute a migração `005_fix_user_roles_policies.sql` no Supabase:

#### Via Supabase Dashboard:
1. Acesse o Supabase Dashboard
2. Vá para a seção "SQL Editor"
3. Execute o conteúdo do arquivo `supabase/migrations/005_fix_user_roles_policies.sql`

#### Via Supabase CLI:
```bash
supabase db push
```

### 2. O que a migração faz:

1. **Remove políticas conflitantes** que podem estar causando o problema
2. **Cria políticas mais permissivas** para inserção de registros
3. **Adiciona política específica** para primeiro acesso do usuário
4. **Mantém segurança** permitindo apenas que usuários criem seus próprios registros

### 3. Políticas Criadas:

```sql
-- Usuários podem inserir seus próprios registros
CREATE POLICY "Users can insert their own roles" ON public.user_roles
    FOR INSERT
    WITH CHECK (auth.uid() = user_id AND auth.uid() IS NOT NULL);

-- Política específica para primeiro acesso
CREATE POLICY "Allow first time user registration" ON public.user_roles
    FOR INSERT
    WITH CHECK (
        auth.uid() = user_id 
        AND auth.uid() IS NOT NULL
        AND NOT EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid()
        )
    );
```

## Como Testar

### 1. Antes da Correção:
1. Tente criar uma escola
2. Verifique se aparece o erro de RLS
3. Confirme que a escola é criada mas o usuário não é associado

### 2. Após a Correção:
1. Aplique a migração
2. Tente criar uma escola novamente
3. Verifique se:
   - ✅ Escola é criada no `escola_configuracao`
   - ✅ Usuário é inserido em `user_roles` com role 'admin'
   - ✅ Não há erros de RLS
   - ✅ Configurações são carregadas automaticamente

### 3. Verificação no Banco:
```sql
-- Verificar se a escola foi criada
SELECT * FROM escola_configuracao ORDER BY criado_em DESC LIMIT 1;

-- Verificar se o usuário foi associado
SELECT * FROM user_roles WHERE user_id = 'seu_user_id';

-- Verificar políticas ativas
SELECT * FROM pg_policies WHERE tablename = 'user_roles';
```

## Tratamento de Erro no Código

O código foi atualizado para:
- ✅ Detectar erros de RLS (código 42501)
- ✅ Mostrar mensagem clara sobre a necessidade de aplicar migração
- ✅ Continuar funcionando após a correção

## Fluxo Corrigido

1. **Usuário cria escola** → Escola criada em `escola_configuracao`
2. **Sistema tenta associar usuário** → Inserção em `user_roles`
3. **Se erro de RLS** → Mensagem clara sobre migração
4. **Após aplicar migração** → Funcionamento normal

## Rollback (se necessário)

```sql
-- Remover políticas corrigidas
DROP POLICY IF EXISTS "Users can insert their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Allow first time user registration" ON public.user_roles;

-- Restaurar políticas originais (se necessário)
-- (Execute o conteúdo de 002_setup_user_roles_policies.sql)
```

## ⚠️ Importante

- **A migração deve ser aplicada** para resolver o problema
- **Usuários existentes** podem precisar fazer logout/login após a correção
- **Teste sempre** após aplicar migrações de segurança

Após aplicar esta migração, o sistema deve funcionar corretamente! 🎉 