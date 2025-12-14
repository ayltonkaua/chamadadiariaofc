# 📘 ChamadaDiária - Documentação Técnica

## 01 - Visão Geral do Sistema

**Versão:** 2.0.0  
**Status:** Produção Ativa  
**Última Atualização:** 2025-12-14

---

## O que é o ChamadaDiária

ChamadaDiária é uma plataforma de gestão escolar focada em **presença, frequência e engajamento**. Desenvolvida para escolas públicas brasileiras, oferece:

- Registro de chamada diária com suporte offline
- Portal do aluno com histórico e benefícios
- Gestão de eventos escolares com check-in via QR
- Pesquisas e enquetes para alunos
- Relatórios de frequência e alertas

---

## Público-Alvo

| Perfil | Descrição | Funcionalidades Principais |
|--------|-----------|---------------------------|
| **Gestor** | Diretores, coordenadores, secretários | Dashboard completo, relatórios, gestão de acesso |
| **Professor** | Docentes vinculados a turmas | Realizar chamada, visualizar histórico da turma |
| **Aluno** | Estudantes com matrícula vinculada | Portal com faltas, benefícios, eventos |
| **Responsável** | (Futuro) Pais/guardiões | Acompanhamento do estudante |

---

## Problemas Resolvidos

### 1. Chamada Manual em Papel
**Antes:** Cadernos de chamada, digitação posterior, erros frequentes.  
**Agora:** Chamada digital em tempo real, sincronização automática.

### 2. Falta de Visibilidade do Aluno
**Antes:** Aluno não sabia quantas faltas tinha.  
**Agora:** Portal com histórico, atestados, frequência por bimestre.

### 3. Gestão Desconectada
**Antes:** Dados em planilhas Excel isoladas.  
**Agora:** Dashboard unificado por escola com métricas em tempo real.

### 4. Internet Instável
**Antes:** Sistema inacessível sem conexão.  
**Agora:** Funciona 100% offline, sincroniza quando reconecta.

---

## Diferenciais Técnicos Reais

| Diferencial | Implementação |
|-------------|---------------|
| **Offline-First** | IndexedDB com criptografia AES-256 |
| **Isolamento Multi-Tenant** | RLS por `escola_id` em todas as tabelas |
| **Arquitetura de Domínios** | 16 domain services desacoplados |
| **Tipagem Estrita** | TypeScript end-to-end |
| **Cache Inteligente** | React Query com staleTime 5min |
| **Segurança por Design** | ESLint bloqueia acesso direto ao Supabase em pages |

---

## Stack Tecnológica

```
┌─────────────────────────────────────────┐
│             FRONTEND                    │
│  React 18 + Vite + TypeScript          │
│  Tailwind CSS + Shadcn/UI              │
│  React Query (cache)                    │
│  IndexedDB + CryptoJS (offline)        │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│             BACKEND                     │
│  Supabase (PostgreSQL)                 │
│  Row Level Security (RLS)              │
│  RPCs para operações complexas         │
│  Auth com Magic Link                   │
└─────────────────────────────────────────┘
```

---

## Métricas Atuais

| Métrica | Valor |
|---------|-------|
| Domain Services | 16 |
| Páginas | 27 |
| Componentes | 50+ |
| Tabelas PostgreSQL | 15+ |
| Políticas RLS | 20+ |
| Cobertura TypeScript | 100% |

---

*Próximo: [02 - Arquitetura Técnica](./02-arquitetura.md)*
