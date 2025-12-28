# 📋 Chamada Diária - Documentação Técnica v2.2

> Sistema de controle de frequência escolar com suporte offline-first, PWA-ready.

---

## 📑 Índice

1. [Visão Geral da Arquitetura](#-visão-geral-da-arquitetura)
2. [Estrutura de Pastas](#-estrutura-de-pastas)
3. [Padrão UI x Lógica x Dados](#-padrão-ui-x-lógica-x-dados)
4. [Custom Hooks](#-custom-hooks)
5. [Motor de Sincronização Offline-First](#-motor-de-sincronização-offline-first)
6. [Tratamento de Erros](#-tratamento-de-erros)
7. [Segurança e Acesso](#-segurança-e-acesso)
8. [Guia de Contribuição](#-guia-de-contribuição)

---

## 🏗️ Visão Geral da Arquitetura

A aplicação segue uma **arquitetura em camadas** com clara separação de responsabilidades:

```
┌─────────────────────────────────────────────────────────┐
│                     📱 UI Layer                         │
│           (Pages, Components, Dialogs)                  │
├─────────────────────────────────────────────────────────┤
│                   🎣 Hooks Layer                        │
│    (usePortalAluno, useDashboardGestor, etc.)          │
├─────────────────────────────────────────────────────────┤
│                  📦 Domain Services                     │
│   (gestorService, portalAlunoService, acessoService)   │
├─────────────────────────────────────────────────────────┤
│                  💾 Data Layer                          │
│   (DataProvider, SyncManager, OfflineStorage)          │
├─────────────────────────────────────────────────────────┤
│                  ☁️ Supabase (Backend)                  │
│         (PostgreSQL + RPC + Realtime + Auth)           │
└─────────────────────────────────────────────────────────┘
```

### Princípios de Design

| Princípio | Implementação |
|-----------|---------------|
| **Offline-First** | Dados salvos em IndexedDB, sync quando online |
| **Separation of Concerns** | UI ⇄ Hooks ⇄ Services ⇄ Data |
| **Type-Safe** | TypeScript em todo o projeto |
| **Fail-Safe** | ErrorBoundary global + graceful degradation |

---

## 📁 Estrutura de Pastas

```
src/
├── 📱 pages/                    # Páginas (apenas UI, sem lógica pesada)
│   ├── PortalAlunoPage.tsx     # Usa usePortalAluno hook
│   ├── DashboardGestorPage.tsx # Usa useDashboardGestor hook
│   └── GerenciarAcessoPage.tsx # Usa acessoService
│
├── 🎣 hooks/                    # Custom Hooks (lógica de negócio)
│   ├── usePortalAluno.ts       # Estado e dados do portal
│   ├── useDashboardGestor.ts   # Dashboard com filtros memoizados
│   ├── useHistoricoChamada.ts  # Histórico de chamadas
│   └── index.ts                # Exports centralizados
│
├── 📦 domains/                  # Domínios de negócio
│   ├── acesso/                 # Gestão de acesso e convites
│   ├── alunos/                 # CRUD de alunos
│   ├── chamada/                # Realizar chamada
│   ├── gestor/                 # Dashboard do gestor
│   ├── portalAluno/            # Portal do aluno
│   └── index.ts                # Barrel exports
│
├── 💾 lib/                      # Core infrastructure
│   ├── dataProvider.ts         # Cache + Network requests
│   ├── SyncManager.ts          # Sincronização offline → online
│   └── offlineStorage.ts       # IndexedDB abstraction
│
├── 🧩 components/               # Componentes reutilizáveis
│   ├── features/               # Componentes de features
│   │   └── portal-aluno/       # AttendanceRing, etc.
│   ├── error/                  # ErrorBoundary
│   └── ui/                     # shadcn/ui components
│
├── 🔐 contexts/                 # React Contexts
│   ├── AuthContext.tsx         # Autenticação e user state
│   └── EscolaConfigContext.tsx # Configurações da escola
│
└── 🔌 integrations/             # Integrações externas
    └── supabase/               # Supabase client
```

### ⚠️ Módulos Removidos (v2.2)

Os seguintes módulos foram **depreciados e removidos**:

- ~~`domains/eventos/`~~ - Sistema de eventos/scanner
- ~~`domains/pesquisas/`~~ - Sistema de pesquisas
- ~~`domains/ingresso/`~~ - Ingressos digitais
- ~~`pages/gestor/GerenciarEventosPage.tsx`~~
- ~~`pages/PesquisasListPage.tsx`~~

---

## 🎯 Padrão UI x Lógica x Dados

### ❌ Antes (God Components)

```tsx
// Página com 600+ linhas, lógica misturada com UI
const PortalAlunoPage = () => {
  const [studentData, setStudentData] = useState(...);
  const [beneficios, setBeneficios] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // 50+ linhas de useEffects
  useEffect(() => {
    const fetchData = async () => {
      const data = await supabase.from('alunos')... // ❌ Supabase direto na página
      setStudentData(data);
    };
  }, []);
  
  // 100+ linhas de funções de manipulação
  // 300+ linhas de JSX
};
```

### ✅ Depois (Clean Architecture)

```tsx
// Página com ~200 linhas, apenas UI
const PortalAlunoPage = () => {
  const { 
    studentData, 
    beneficios, 
    loadingData,
    refreshData 
  } = usePortalAluno();  // ✅ Toda lógica no hook
  
  if (loadingData) return <Skeleton />;
  
  return (
    <div>
      <AttendanceRing percentage={studentData.frequencia} />
      {/* UI limpa, sem lógica de negócio */}
    </div>
  );
};
```

---

## 🎣 Custom Hooks

### `usePortalAluno`

Hook que encapsula toda a lógica do portal do aluno.

```typescript
import { usePortalAluno } from '@/hooks';

const {
  // Dados
  studentData,       // StudentData - dados do aluno
  beneficios,        // any[] - programas sociais
  meusAtestados,     // MeusAtestados[] - atestados enviados
  
  // Loading
  loadingData,       // boolean
  loadingAtestados,  // boolean
  
  // Dialog states
  showCarteirinha, setShowCarteirinha,
  isJustifyDialogOpen, setIsJustifyDialogOpen,
  isBoletimOpen, setIsBoletimOpen,
  isMeusAtestadosOpen, setIsMeusAtestadosOpen,
  isMeusDadosOpen, setIsMeusDadosOpen,
  showUpdateAlert, setShowUpdateAlert,
  
  // Actions
  refreshData        // () => Promise<void>
} = usePortalAluno();
```

### `useDashboardGestor`

Hook com filtros memoizados para o dashboard do gestor.

```typescript
import { useDashboardGestor } from '@/hooks';

const {
  // KPIs
  kpis,              // KpiData - indicadores principais
  kpisAdmin,         // KpiAdminData - indicadores admin
  
  // Dados filtrados (memoizados)
  filteredTurmaData,
  filteredAlunosRisco,
  filteredAlunosConsecutivos,
  chartAusenciasSemana,
  paginatedRisco,
  paginatedConsecutivos,
  
  // Filtros
  turmasDisponiveis,
  filtroTurno, setFiltroTurno,
  turmasSelecionadas, setTurmasSelecionadas,
  filtroAno, setFiltroAno,
  activeTurmaIds,
  
  // Paginação
  riscoCurrentPage, setRiscoCurrentPage,
  consecutivasCurrentPage, setConsecutivasCurrentPage,
  
  // Estado
  loading,
  statusMsg,
  
  // Actions
  refresh            // () => Promise<void>
} = useDashboardGestor();
```

---

## 🔄 Motor de Sincronização Offline-First

### Arquitetura

```
┌────────────────┐     ┌──────────────────┐     ┌─────────────┐
│   UI Action    │────▶│  offlineStorage  │────▶│  IndexedDB  │
│  (Fazer chamada)     │  (saveChamadaAtom)│     │  (Local)    │
└────────────────┘     └──────────────────┘     └─────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │   SyncManager    │
                       │  (processQueue)  │
                       └──────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │  Supabase RPC    │
                       │ (salvar_chamada) │
                       └──────────────────┘
```

### DataProvider

O `dataProvider.ts` implementa o padrão **Cache-First**:

```typescript
// Buscar turmas - tenta cache local primeiro
const { data, source, stale } = await getTurmasByEscola(escolaId);
// source: 'cache' | 'network'
// stale: boolean - se dados podem estar desatualizados
```

### Sincronização Bidirecional

```typescript
// 1. Buscar mudanças do servidor
const changes = await fetchServerChanges(escolaId, lastSyncTime);

// 2. Aplicar mudanças localmente
await applyServerChanges(escolaId, changes);

// changes contém:
// - entity_type: 'alunos' | 'turmas'
// - operation: 'INSERT' | 'UPDATE' | 'DELETE'
// - entity_id: UUID
```

### Versionamento de Cache

```typescript
// Verificar se cache precisa ser invalidado
const { needsRefresh, serverVersion } = await checkAndInvalidateCache(escolaId);

if (needsRefresh) {
  await syncSchoolCache(escolaId);
}
```

### Telemetria de Sync

Métricas de sincronização são enviadas ao backend:

```typescript
// sync_metrics table
{
  event_type: 'sync_success' | 'sync_error' | 'sync_partial',
  duration_ms: number,
  items_total: number,
  items_success: number,
  items_failed: number,
  client_version: string,
  client_platform: string
}
```

---

## 🛡️ Tratamento de Erros

### ErrorBoundary Global

```tsx
// App.tsx
<ErrorBoundary>
  <QueryClientProvider>
    <AuthProvider>
      {/* Toda a aplicação */}
    </AuthProvider>
  </QueryClientProvider>
</ErrorBoundary>
```

**Funcionalidades:**
- ✅ Captura erros não tratados em qualquer componente
- ✅ Exibe página de fallback amigável
- ✅ Botões de "Recarregar" e "Voltar ao Início"
- ✅ Log de erros para debugging (console)
- 🔜 Integração com telemetria (preparado)

### Tratamento em Hooks

```typescript
// usePortalAluno.ts
try {
  const data = await portalAlunoService.getStudentData(userId);
  setStudentData(data);
} catch (error) {
  console.error("Erro ao carregar dados:", error);
  toast({ 
    title: "Erro", 
    description: "Não foi possível carregar seus dados.",
    variant: "destructive" 
  });
}
```

---

## 🔐 Segurança e Acesso

### Centralização de Chamadas Supabase

| ❌ Antes | ✅ Depois |
|----------|-----------|
| `supabase.auth.resetPasswordForEmail(email)` na página | `acessoService.sendPasswordReset(email)` |
| `supabase.from('alunos').update(...)` na página | `acessoService.unlinkStudentAccount(userId)` |

### Row Level Security (RLS)

Todas as tabelas possuem RLS ativado:

```sql
-- Exemplo: usuários só veem dados da própria escola
CREATE POLICY "Users can only see their school data"
ON alunos FOR SELECT
USING (escola_id = get_user_escola_id());
```

### Funções RPC com SECURITY DEFINER

```sql
CREATE OR REPLACE FUNCTION salvar_chamada(...)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER  -- Executa com permissões elevation
AS $$
  -- Validações de acesso
  -- Operações no banco
$$;
```

---

## 🤝 Guia de Contribuição

### Adicionando uma Nova Feature

1. **Criar Service** em `domains/[feature]/services/`
2. **Criar Types** em `domains/[feature]/types/`
3. **Criar Hook** em `hooks/use[Feature].ts` (se necessário)
4. **Criar Página** em `pages/[Feature]Page.tsx`
5. **Adicionar Rota** em `App.tsx`

### Padrões de Código

```typescript
// ✅ Services usam logger estruturado
import { logger } from '@/core';
const log = logger.child('MyService');
log.info('Operação realizada', { userId, data });

// ✅ Erros são tratados e logados com contexto
if (error) {
  log.error('Falha na operação', { message: error.message });
  throw new Error(error.message);
}

// ✅ Hooks exportam interface tipada
interface UseMyFeatureReturn {
  data: MyData | null;
  loading: boolean;
  refresh: () => Promise<void>;
}
```

### Comandos Úteis

```bash
# Desenvolvimento
npm run dev

# Type check
npx tsc --noEmit

# Build produção
npm run build

# Gerar tipos Supabase (requer CLI)
supabase gen types typescript --project-id <id> > src/integrations/supabase/types.ts
```

---

## 📊 Stack Tecnológica

| Categoria | Tecnologia |
|-----------|------------|
| **Framework** | React 18 + TypeScript |
| **Build** | Vite |
| **UI** | shadcn/ui + Tailwind CSS |
| **State** | React Query + Context |
| **Backend** | Supabase (PostgreSQL + Auth + Realtime) |
| **Offline** | IndexedDB (via abstração própria) |
| **Charts** | Recharts |
| **Icons** | Lucide React |

---

## 📝 Changelog v2.2

### Adicionado
- ✨ Custom Hooks (`usePortalAluno`, `useDashboardGestor`)
- ✨ ErrorBoundary global
- ✨ Sincronização bidirecional (`change_log` + RPC)
- ✨ Telemetria de sync (`sync_metrics`)
- ✨ Componentes extraídos (`AttendanceRing`)

### Alterado
- ♻️ Lógica movida de páginas para hooks (-226 linhas)
- ♻️ Filtros refatorados com `useMemo`
- ♻️ Supabase calls centralizados em services

### Removido
- 🗑️ Módulo Eventos/Scanner
- 🗑️ Módulo Pesquisas
- 🗑️ Módulo Ingressos

---

*Documentação atualizada em: 28/12/2024*
*Versão: 2.2.0*
