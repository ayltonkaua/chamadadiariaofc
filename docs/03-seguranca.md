# 📘 ChamadaDiária - Documentação Técnica

## 03 - Segurança e Isolamento

---

## Modelo de Segurança

```
┌─────────────────────────────────────────────────────────┐
│                    CAMADA 1: AUTH                        │
│  Supabase Auth (JWT) - Identidade do usuário            │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                    CAMADA 2: RLS                         │
│  Row Level Security - Filtro por escola_id + role       │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                    CAMADA 3: UI                          │
│  Frontend - Controle de visibilidade por role           │
└─────────────────────────────────────────────────────────┘
```

---

## Row Level Security (RLS)

### Como Funciona

Cada tabela sensível tem políticas que filtram dados automaticamente:

```sql
-- Exemplo: Política em 'alunos'
CREATE POLICY alunos_escola_policy ON alunos
  FOR ALL
  USING (
    escola_id = (
      SELECT escola_id FROM user_roles 
      WHERE user_id = auth.uid()
    )
  );
```

### Tabelas com RLS Ativo

| Tabela | Política | Descrição |
|--------|----------|-----------|
| `alunos` | `escola_id` | Só vê alunos da própria escola |
| `turmas` | `escola_id` | Só vê turmas da própria escola |
| `presencas` | `escola_id` | Só vê presenças da própria escola |
| `eventos` | `escola_id` | Eventos isolados por escola |
| `user_roles` | `escola_id` | Usuários isolados por escola |

### Verificação de Escola

O `escola_id` é obtido do JWT claim ou da tabela `user_roles`:

```sql
-- Via JWT (mais performático)
auth.jwt() ->> 'escola_id'

-- Via subquery (fallback)
(SELECT escola_id FROM user_roles WHERE user_id = auth.uid())
```

---

## Isolamento Entre Escolas

### Garantia Absoluta

Mesmo que um usuário tente acessar dados de outra escola via API:

```javascript
// Tentativa maliciosa
await supabase.from('alunos').select('*').eq('escola_id', 'OUTRA_ESCOLA');

// Resultado: [] (array vazio)
// RLS filtra ANTES de retornar dados
```

### Multi-Tenancy Lógico

| Aspecto | Implementação |
|---------|---------------|
| Banco de dados | Único (compartilhado) |
| Isolamento | Por `escola_id` em cada tabela |
| Custo | Baixo (sem infra separada) |
| Escalabilidade | Até ~50 escolas sem mudança |

---

## Controle de Roles

### Roles Existentes

| Role | Código | Nível de Acesso |
|------|--------|-----------------|
| Super Admin | `super_admin` | Acesso total, cross-escola |
| Admin | `admin` | Gestão completa da escola |
| Diretor | `diretor` | Igual ao admin |
| Coordenador | `coordenador` | Gestão pedagógica |
| Secretário | `secretario` | Gestão administrativa |
| Gestor | `gestor` | Acesso de gestão |
| Professor | `professor` | Apenas turmas vinculadas |
| Aluno | `aluno` | Apenas próprios dados |

### Hierarquia de Permissões

```
super_admin
    │
    ▼
admin / diretor / coordenador / secretario / gestor
    │
    ▼
professor (turmas vinculadas)
    │
    ▼
aluno (self-service)
```

---

## Matriz de Acesso

### O que Cada Role Pode Acessar

| Recurso | Aluno | Professor | Gestor | Admin |
|---------|-------|-----------|--------|-------|
| **Próprias faltas** | ✅ | ❌ | ❌ | ❌ |
| **Chamada da turma** | ❌ | ✅ | ✅ | ✅ |
| **Dashboard escola** | ❌ | ❌ | ✅ | ✅ |
| **Importar turmas** | ❌ | ❌ | ✅ | ✅ |
| **Gerenciar acesso** | ❌ | ❌ | ❌ | ✅ |
| **Ver outras escolas** | ❌ | ❌ | ❌ | ❌* |

> *Apenas `super_admin` pode ver múltiplas escolas

### O que Cada Role NÃO Pode Fazer

| Role | Proibições |
|------|------------|
| **Aluno** | Ver outros alunos, editar dados, fazer chamada |
| **Professor** | Ver turmas não vinculadas, gerenciar usuários |
| **Gestor** | Promover para admin, deletar escola |
| **Admin** | Acessar outras escolas, alterar RLS |

---

## Riscos Conhecidos e Mitigações

| Risco | Severidade | Mitigação |
|-------|------------|-----------|
| **Bypass de RLS** | 🔴 Crítico | ESLint bloqueia Supabase em pages |
| **Token exposto** | 🟡 Médio | JWT com expiração curta (1h) |
| **Dados offline** | 🟡 Médio | IndexedDB criptografado AES-256 |
| **Escalação de role** | 🟢 Baixo | Apenas admin pode alterar roles |
| **Injeção SQL** | 🟢 Baixo | Supabase usa prepared statements |

---

## Segurança Offline

### Criptografia de Dados Locais

```typescript
// Chave derivada do user ID
const key = CryptoJS.PBKDF2(userId, salt, { keySize: 256/32 });

// Dados criptografados antes de salvar
const encrypted = CryptoJS.AES.encrypt(data, key);
await set('offline_data', encrypted.toString());

// Decriptografia na leitura
const decrypted = CryptoJS.AES.decrypt(stored, key);
```

### Proteções Implementadas

| Aspecto | Implementação |
|---------|---------------|
| Algoritmo | AES-256-CBC |
| Chave | Derivada do user ID |
| Armazenamento | IndexedDB |
| Validade | 24 horas |
| Limpeza | No logout |

---

## Checklist de Segurança

✅ RLS ativo em todas as tabelas sensíveis  
✅ ESLint bloqueando acesso direto ao Supabase  
✅ Roles validados no backend (RLS)  
✅ Dados offline criptografados  
✅ JWT com expiração curta  
✅ Sem credenciais hardcoded  
✅ HTTPS obrigatório  

---

*Anterior: [02 - Arquitetura](./02-arquitetura.md) | Próximo: [04 - Escalabilidade](./04-escalabilidade.md)*
