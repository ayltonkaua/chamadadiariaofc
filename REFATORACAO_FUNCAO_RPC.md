# Refatoração: Uso da Função RPC para Criação de Escola

## Resumo da Implementação

A funcionalidade de criação de escola foi refatorada para usar a função RPC `criar_escola_e_associar_admin` em vez de fazer operações separadas de INSERT nas tabelas `escola_configuracao` e `user_roles`.

## Arquivos Modificados

### 1. `src/contexts/EscolaConfigContext.tsx`

**Antes:**
```typescript
// Código antigo com operações separadas
const { data: newEscola, error: insertError } = await supabase
  .from('escola_configuracao')
  .insert({...})
  .select()
  .single();

if (newEscola) {
  const { error: roleError } = await supabase
    .from('user_roles')
    .insert({
      user_id: user.id,
      escola_id: newEscola.id,
      role: 'admin'
    });
}
```

**Depois:**
```typescript
// Código novo usando função RPC
const { data: newSchoolId, error } = await supabase.rpc('criar_escola_e_associar_admin', {
  nome_escola: updates.nome || 'Nova Escola',
  endereco_escola: updates.endereco || 'Endereço da escola',
  telefone_escola: updates.telefone || '(11) 1234-5678',
  email_escola: updates.email || 'contato@escola.com',
  url_logo_escola: updates.url_logo || null,
  cor_primaria_escola: updates.cor_primaria || '#7c3aed',
  cor_secundaria_escola: updates.cor_secundaria || '#f3f4f6'
});
```

### 2. `src/integrations/supabase/types.ts`

**Adicionado:**
```typescript
Functions: {
  criar_escola_e_associar_admin: {
    Args: {
      nome_escola: string;
      endereco_escola: string;
      telefone_escola: string;
      email_escola: string;
      url_logo_escola?: string | null;
      cor_primaria_escola?: string | null;
      cor_secundaria_escola?: string | null;
    };
    Returns: string;
  };
}
```

## Benefícios da Refatoração

### 1. **Atomicidade**
- ✅ Todas as operações (criar escola + associar usuário) acontecem em uma única transação
- ✅ Se qualquer parte falhar, tudo é desfeito automaticamente
- ✅ Elimina o problema de "escolas órfãs" sem administrador

### 2. **Segurança**
- ✅ A função RPC executa no contexto do banco de dados
- ✅ Não há exposição de lógica de negócio no frontend
- ✅ Controle de acesso centralizado

### 3. **Manutenibilidade**
- ✅ Lógica de criação centralizada em uma função
- ✅ Mais fácil de testar e debugar
- ✅ Mudanças futuras só precisam ser feitas na função RPC

### 4. **Performance**
- ✅ Menos round-trips entre frontend e backend
- ✅ Transação otimizada no banco de dados

## Fluxo de Funcionamento

### 1. **Usuário submete formulário**
```typescript
const success = await updateConfig(formData);
```

### 2. **Verificação de escola_id**
```typescript
if (!user.escola_id) {
  // Usuário não tem escola, criar nova
}
```

### 3. **Chamada da função RPC**
```typescript
const { data: newSchoolId, error } = await supabase.rpc('criar_escola_e_associar_admin', {
  // Parâmetros mapeados do formulário
});
```

### 4. **Tratamento de resposta**
```typescript
if (error) {
  // Exibir erro para o usuário
  setError(`Ocorreu um erro ao criar a escola: ${error.message}`);
  return false;
}
```

### 5. **Atualização do contexto**
```typescript
// Buscar dados completos da escola criada
const { data: escolaData } = await supabase
  .from('escola_configuracao')
  .select('*')
  .eq('id', newSchoolId)
  .single();

// Atualizar contexto e autenticação
setConfig(escolaData);
refreshUserData();
```

## Tratamento de Erros

### 1. **Erro na função RPC**
```typescript
if (error) {
  console.error('Erro ao chamar a função RPC:', error);
  setError(`Ocorreu um erro ao criar a escola: ${error.message}`);
  return false;
}
```

### 2. **Erro ao buscar dados da escola**
```typescript
if (fetchError) {
  console.warn('Erro ao buscar dados da escola criada:', fetchError);
  setError('Escola criada, mas erro ao carregar dados. Recarregue a página.');
  return false;
}
```

### 3. **Exceção geral**
```typescript
catch (err) {
  console.error('Exceção na criação da escola:', err);
  setError('Ocorreu um erro inesperado. Por favor, contate o suporte.');
  return false;
}
```

## Mapeamento de Parâmetros

| Campo do Formulário | Parâmetro da Função RPC | Valor Padrão |
|-------------------|------------------------|--------------|
| `updates.nome` | `nome_escola` | 'Nova Escola' |
| `updates.endereco` | `endereco_escola` | 'Endereço da escola' |
| `updates.telefone` | `telefone_escola` | '(11) 1234-5678' |
| `updates.email` | `email_escola` | 'contato@escola.com' |
| `updates.url_logo` | `url_logo_escola` | `null` |
| `updates.cor_primaria` | `cor_primaria_escola` | '#7c3aed' |
| `updates.cor_secundaria` | `cor_secundaria_escola` | '#f3f4f6' |

## Testes Recomendados

### 1. **Criação de escola com dados completos**
- ✅ Preencher todos os campos do formulário
- ✅ Verificar se escola é criada corretamente
- ✅ Verificar se usuário é associado como admin

### 2. **Criação de escola com dados mínimos**
- ✅ Preencher apenas campos obrigatórios
- ✅ Verificar se valores padrão são aplicados
- ✅ Verificar se escola é criada corretamente

### 3. **Tratamento de erros**
- ✅ Simular erro de rede
- ✅ Verificar se mensagens de erro são exibidas
- ✅ Verificar se não há dados inconsistentes

### 4. **Verificação no banco**
```sql
-- Verificar se escola foi criada
SELECT * FROM escola_configuracao ORDER BY criado_em DESC LIMIT 1;

-- Verificar se usuário foi associado
SELECT * FROM user_roles WHERE user_id = 'seu_user_id';

-- Verificar se não há escolas órfãs
SELECT ec.* FROM escola_configuracao ec
LEFT JOIN user_roles ur ON ec.id = ur.escola_id
WHERE ur.escola_id IS NULL;
```

## Rollback (se necessário)

Se precisar reverter para o código anterior:

1. **Restaurar código antigo** em `EscolaConfigContext.tsx`
2. **Remover definição da função** em `types.ts`
3. **Manter função RPC no banco** (não causa problemas)

## Conclusão

A refatoração implementada resolve o problema de atomicidade na criação de escolas, garantindo que sempre que uma escola for criada, o usuário será automaticamente associado como administrador. A solução é mais robusta, segura e mantém a integridade dos dados. 🎉 