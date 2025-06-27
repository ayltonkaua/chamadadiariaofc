# Configuração da Tabela user_roles no Supabase

## Problema
A tabela `user_roles` precisa ter políticas de segurança (RLS) configuradas para que os usuários possam acessar seus próprios dados.

## Solução

### 1. Habilitar RLS na tabela user_roles

```sql
-- Habilitar Row Level Security
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
```

### 2. Criar política para usuários acessarem seus próprios dados

```sql
-- Política para usuários acessarem seus próprios dados
CREATE POLICY "Users can view their own roles" ON public.user_roles
    FOR SELECT
    USING (auth.uid() = user_id);
```

### 3. Política para administradores (opcional)

```sql
-- Política para administradores acessarem todos os dados
CREATE POLICY "Admins can view all roles" ON public.user_roles
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.role = 'admin'
        )
    );
```

### 4. Verificar se as políticas estão funcionando

```sql
-- Verificar políticas existentes
SELECT * FROM pg_policies WHERE tablename = 'user_roles';
```

## Teste

Após aplicar as políticas, teste fazendo login com um usuário que tem registro na tabela `user_roles`:

1. Faça login no sistema
2. Verifique no console do navegador se aparecem os logs:
   - `"Configuração carregada para escola: [Nome da Escola]"`
   - Ou `"Usuário não tem escola_id, usando configuração padrão"`

## Estrutura da Tabela

A tabela `user_roles` deve ter esta estrutura:

```sql
CREATE TABLE public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  escola_id uuid NOT NULL,
  role text NOT NULL,
  criado_em timestamp with time zone NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em timestamp with time zone NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT user_roles_pkey PRIMARY KEY (id),
  CONSTRAINT user_roles_user_id_escola_id_key UNIQUE (user_id, escola_id),
  CONSTRAINT user_roles_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES escola_configuracao (id) ON DELETE CASCADE,
  CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE,
  CONSTRAINT user_roles_role_check CHECK (
    role = ANY (ARRAY['admin'::text, 'diretor'::text, 'coordenador'::text, 'professor'::text, 'secretario'::text])
  )
);
```

## Dados de Exemplo

Para testar, insira um usuário de exemplo:

```sql
-- Substitua pelos IDs reais do seu banco
INSERT INTO public.user_roles (user_id, escola_id, role)
VALUES (
  'ID_DO_USUARIO_AUTH', -- ID do usuário em auth.users
  'ID_DA_ESCOLA',       -- ID da escola em escola_configuracao
  'admin'
);
```

## Troubleshooting

### Erro: "relation user_roles does not exist"
- Verifique se a tabela foi criada corretamente
- Execute: `\dt public.user_roles` no SQL Editor

### Erro: "permission denied"
- Verifique se as políticas RLS estão configuradas
- Execute: `SELECT * FROM pg_policies WHERE tablename = 'user_roles';`

### Usuário não aparece com escola_id
- Verifique se existe registro na tabela `user_roles`
- Execute: `SELECT * FROM public.user_roles WHERE user_id = 'ID_DO_USUARIO';` 