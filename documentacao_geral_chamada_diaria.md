# 📋 Chamada Diária - Documentação e Contexto Geral do Ecossistema

O **Chamada Diária** é uma plataforma e ecossistema escolar *multi-tenant* (várias escolas na mesma base com dados isolados), focada no controle de frequência, comunicação automatizada e integração com alunos. O sistema possui arquitetura moderna (Supabase como BaaS) e recursos *offline-first*.

A arquitetura do sistema é dividida em **projetos independentes** para escalar diferentes contextos (Painel Principal, Portal do Aluno, Bot de Notificações via WhatsApp e Painel Super Admin).

---

## 🏛️ Visão Geral da Arquitetura

O ecossistema é formado por 5 frentes principais, além do banco de dados no Supabase:

1. **App Principal (Painel Gestor/Professor)** — React SPA / PWA (Offline-first)
2. **Bot API WhatsApp** — Node.js / Baileys
3. **Portal do Aluno REST API** — Node.js / Hono (Fast API)
4. **Portal do Aluno Frontend** — React SPA
5. **Super Admin API / Frontend** — Gestão multiescolas do sistema em si.

Todos se conectam através da plataforma centralizada do **Supabase** (PostgreSQL, Realtime, Auth, Storage, e Edge RPC Functions). Políticas de Segurança em Nível de Linha (RLS) garantem que dados não vazem entre diferentes escolas.

---

## 🧩 Modulos e Funcionalidades por Aplicação

### 1. App Principal (Gestor e Professores)
> **PWA com suporte Offline-First (`src/`)**

Este módulo é o coração da escola, utilizado por professores em sala de aula e pela coordenação/gestão. Possui robusto tratamento de cache e IndexedDB para permitir a realização de chamadas sem internet, sincronizando quando a conexão retorna.

**Funcionalidades:**
- **Chamada Offline-First:** Realização de chamadas via fluxo bidirecional (`SyncManager` + `dataProvider.ts`). A chamada fica salva localmente no IndexedDB e sobe silenciosamente pro Supabase via RPC (`salvar_chamada`).
- **Dashboard do Gestor Institucional:** Tela com *custom hooks* (`useDashboardGestor`) fornecendo dezenas de filtros em tempo real, monitoramento de turmas, alunos com faltas consecutivas ou em risco.
- **Gestão de Alunos e Turmas:** Sistema completo de matrículas e CRUD escolar.
- **Controle de Acessos & Convites:** Modulo para adicionar docentes e limitar acessos via RBAC (Role Based Access Control).
- **Relatórios:** Exportação e visualização de KPI's gerenciais.
- **Sincronização Bidirecional e Telemetria:** O app audita falhas e envia dados de sucesso/falha do offline-first para o banco (`sync_metrics`).

### 2. Portal do Aluno (Frontend e API)
> **API Serverless REST (`portal-aluno-api/`)** + **React Web App (`portal-aluno-frontend/`)**

Um portal focado no autoatendimento do estudante. Usufrui de uma API rápida feita em Hono.js, abstraindo lógicas complexas do Supabase.

**Funcionalidades:**
- **Login e Autenticação com Token JWT:** Sincronizado dinamicamente via backend Supabase.
- **Dashboard e Frequência:** Monitor visual do engajamento do aluno mostrando estatísticas (componente `AttendanceRing`).
- **Boletim e Avaliações:** Consulta ao histórico letivo, segmentado por semestres.
- **Gestão de Atestados / Justificativas:** Envio de atestados médicos (upload e registro no sistema) e elaboração de justificativas digitais pelos alunos.
- **Benefícios e Programas Sociais:** Acompanhamento dinâmico focado em programas sociais educacionais que exigem meta de frequência das famílias.
- **ID Digital (Carteirinha):** Acesso à credencial do estudante.
- **Update Cadastral:** Formulário para o aluno manter o e-mail, telefone e foto atualizados (`PATCH /api/v1/me/dados`).

### 3. Bot API de Notificações WhatsApp
> **Módulo NodeJS + Baileys (`bot-api/`)**

Motor de notificação responsável pela comunicação proativa com pais e responsáveis financeiros via WhatsApp. Possui fluxo bidirecional (URA / Atendimento de Secretaria).

**Funcionalidades:**
- **Sessões Isoladas por Colégio:** Sistema multitenant onde várias escolas rodam no mesmo servidor simultaneamente (`SessionStorage.js`).
- **Storage Persistente Cloud:** As sessões inteiras (auth keys) salvam em backup no bucket `whatsapp-sessions` (Supabase Storage), sobrevivendo a reboots do host/VPS sem precisar rescanear o QRCode.
- **Alertas de Risco (Risk Alert):** Verifica constantemente os totais contra o limite tolerável. Emite alerta se cair abaixo de 70%, por exemplo.
- **Aviso de Faltas Consecutivas:** Avisa a famílias em tempo real de reincidências (ex: faltou 2 dias seguidos).
- **Disparos Manuais & Grupos em Massa:** Possibilita enviar comunicados por turma ou importando os grupos do whats já existentes da instituição.
- **Fluxo de Atendimento de Secretaria:** Script inteligente (inbound.js) para multi-turn conversational que não solta o pai da conexão do ticket de suporte antes da gestão encerrar o caso (menu dinâmico com IA/regras e botões custom).
- **CRONs Agendados:** Envio automático do fechamento mensal no dia 25 (`sendMonthlySummary`).

### 4. Super Admin (Frontend e API)
> **Painel Retaguarda (`super-admin-api/` e `super-admin-frontend/`)**

Ambiente SaaS para administração raiz do produto Chamada Diária (acesso por criadores da plataforma).

**Funcionalidades:**
- **Atendimento de Instalações Multi-Tenant (Escolas):** Interface de super usuario para criar/deletar e modificar assinaturas e status das operantes na plataforma.
- **Logs e Monitoramento:** Visão de tráfego, status de estabilidade do bot, APIs, e instâncias conectadas.

---

## 🔒 Segurança e Tratativas Especiais

1. **Row Level Security (RLS)**: Fator basilar de segurança. Nenhuma API pode acidentalmente puxar dados de dois colégios, pois as policies PostgreSQL injetam regras no contexto JWT do request identificando a que instituição o usuário pertente.
2. **Design System**: A UI é predominantemente montada usando tailwindcss e `shadcn/ui`, favorecendo estética moderna nos portais.
3. **Erros Fallback Global**: A interface bloqueadores fatais via error boundaries e não perde o progresso de chamada que esteja gravado em Background/IndexedDB localmente.
4. **Proteção de Rotas API:** Implementação estrita de Auth (`x-api-key`, `x-escola-id`, origin rate limit) blindando ataques de DDos.
