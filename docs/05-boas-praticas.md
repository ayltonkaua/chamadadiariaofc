# 📘 ChamadaDiária - Documentação Técnica

## 05 - Boas Práticas de Desenvolvimento

---

## Padrões Obrigatórios

### 1. Sempre Usar Domain Services

```typescript
// ✅ CORRETO
import { alunoService } from '@/domains';
const alunos = await alunoService.listByTurma(id);

// ❌ ERRADO - ESLint vai bloquear
import { supabase } from '@/integrations/supabase/client';
const { data } = await supabase.from('alunos').select('*');
```

### 2. Tipagem Estrita

```typescript
// ✅ CORRETO
const aluno: Aluno = await alunoService.getById(id);

// ❌ ERRADO
const aluno: any = await alunoService.getById(id);
```

### 3. Tratamento de Erros

```typescript
// ✅ CORRETO
try {
  await service.save(data);
  toast({ title: 'Salvo com sucesso' });
} catch (error) {
  console.error('Erro:', error);
  toast({ title: 'Erro ao salvar', variant: 'destructive' });
}
```

### 4. React Query para Cache

```typescript
// ✅ CORRETO - Usa cache automático
const { data, isLoading } = useQuery({
  queryKey: ['turmas', escolaId],
  queryFn: () => turmaService.findByEscola(escolaId),
  staleTime: 5 * 60 * 1000, // 5 minutos
});
```

---

## Anti-Padrões Proibidos

| Anti-Padrão | Por que é Ruim | Alternativa |
|-------------|----------------|-------------|
| `supabase` em pages | Bypass de segurança | Usar services |
| `any` em tipos | Perde type-safety | Criar interface |
| `console.log` em produção | Poluição, dados expostos | Usar logger |
| Props drilling 5+ níveis | Manutenção difícil | Context ou state |
| Lógica em componentes | Difícil testar | Extrair para hook/service |

---

## Estrutura de Novo Domínio

### Passo 1: Criar Pasta

```
src/domains/novo-dominio/
├── types/
│   └── novo-dominio.types.ts
├── services/
│   └── novo-dominio.service.ts
└── index.ts
```

### Passo 2: Definir Tipos

```typescript
// types/novo-dominio.types.ts
export interface NovoDominio {
  id: string;
  nome: string;
  escola_id: string;
  created_at: string;
}

export interface NovoDominioInsert {
  nome: string;
  escola_id: string;
}
```

### Passo 3: Criar Service

```typescript
// services/novo-dominio.service.ts
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/core';
import type { NovoDominio, NovoDominioInsert } from '../types';

const log = logger.child('NovoDominioService');

export const novoDominioService = {
  async list(escolaId: string): Promise<NovoDominio[]> {
    log.debug('Listando', { escolaId });
    
    const { data, error } = await supabase
      .from('novo_dominio')
      .select('*')
      .eq('escola_id', escolaId);
    
    if (error) {
      log.error('Erro ao listar', error);
      throw new Error(error.message);
    }
    
    return data || [];
  },

  async create(item: NovoDominioInsert): Promise<NovoDominio> {
    const { data, error } = await supabase
      .from('novo_dominio')
      .insert(item)
      .select()
      .single();
    
    if (error) throw new Error(error.message);
    return data;
  }
};
```

### Passo 4: Exportar

```typescript
// index.ts
export { novoDominioService } from './services/novo-dominio.service';
export type { NovoDominio, NovoDominioInsert } from './types/novo-dominio.types';
```

### Passo 5: Adicionar ao Index Central

```typescript
// src/domains/index.ts
export { novoDominioService } from './novo-dominio';
export type { NovoDominio } from './novo-dominio';
```

---

## Convenções de Nomenclatura

| Tipo | Formato | Exemplo |
|------|---------|---------|
| Service | `camelCase + Service` | `alunoService` |
| Type | `PascalCase` | `Aluno` |
| Page | `PascalCase + Page` | `AlunoPage` |
| Hook | `use + PascalCase` | `useAlunos` |
| Pasta domínio | `kebab-case` | `novo-dominio` |
| Arquivo tipo | `nome.types.ts` | `aluno.types.ts` |
| Arquivo service | `nome.service.ts` | `aluno.service.ts` |

---

## Checklist de Novo Feature

- [ ] Definir tipos em `types/`
- [ ] Criar service com log
- [ ] Exportar em `index.ts` do domínio
- [ ] Exportar em `src/domains/index.ts`
- [ ] Usar React Query se tiver cache
- [ ] Tratar erros com toast
- [ ] Testar com diferentes roles

---

## Uso Correto de RPCs

### Quando Usar RPC

| Cenário | Usar |
|---------|------|
| Agregações complexas | ✅ RPC |
| Múltiplas tabelas em transação | ✅ RPC |
| CRUD simples | ❌ Query direta |
| SELECT com join simples | ❌ Query direta |

### Exemplo de RPC

```typescript
// Service
async getDashboardData(escolaId: string) {
  const { data, error } = await supabase
    .rpc('dashboard_escola', { escola_uuid: escolaId });
  
  if (error) throw new Error(error.message);
  return data;
}
```

---

*Anterior: [04 - Escalabilidade](./04-escalabilidade.md) | Próximo: [06 - Operação](./06-operacao.md)*
