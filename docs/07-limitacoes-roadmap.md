# 📘 ChamadaDiária - Documentação Técnica

## 07 - Limitações Conhecidas e Roadmap Técnico

---

## Limitações Atuais Assumidas

### Arquitetura

| Limitação | Status | Por que Aceita |
|-----------|--------|----------------|
| Banco único multi-tenant | Assumida | Custo, simplicidade até 50 escolas |
| Sem read replica | Assumida | Custo, não necessário ainda |
| Conexões limitadas (60) | Assumida | Suficiente para 20 escolas |
| Tipos Supabase incompletos | Aceita | Gera warnings, não erros |

### Funcionalidades

| Limitação | Status | Futuro |
|-----------|--------|--------|
| Sem módulo de notas | Não implementado | Backlog |
| Sem comunicação pais | Não implementado | P1 |
| Sem app mobile nativo | Não implementado | PWA suficiente |
| Relatórios básicos | Parcial | Evoluir |

### Performance

| Limitação | Impacto | Mitigação |
|-----------|---------|-----------|
| RLS com subquery | +10-15ms por query | Migrar para JWT claim |
| Falta índices compostos | Queries lentas em escala | Criar quando necessário |
| Audit log síncrono | +5ms por operação | Aceitável por enquanto |

---

## O que Não Foi Feito (e Por Quê)

### 1. Cache Redis
**Por que não:** Custo adicional, React Query resolve 90% dos casos.  
**Quando fazer:** Acessos massivos simultâneos (5.000+).

### 2. Microserviços
**Por que não:** Complexidade desnecessária, escala atual é monolítica.  
**Quando fazer:** Provavelmente nunca para este produto.

### 3. App Mobile Nativo
**Por que não:** PWA funciona bem, custo de manutenção duplo.  
**Quando fazer:** Se App Store for requisito comercial.

### 4. Internacionalização (i18n)
**Por que não:** Foco em Brasil, português apenas.  
**Quando fazer:** Expansão internacional.

### 5. Testes E2E Completos
**Por que não:** Custo de manutenção, testes unitários cobrindo crítico.  
**Quando fazer:** Equipe maior.

---

## Quando Considerar Mudanças Estruturais

### Cache Distribuído (Redis/Upstash)

| Trigger | Ação |
|---------|------|
| 5.000+ usuários simultâneos | Implementar |
| Retrospectiva anual | Pré-gerar e cachear |
| Dashboard público | Cache de leitura |

**Custo estimado:** ~$10/mês (Upstash)

### Filas (Queue)

| Trigger | Ação |
|---------|------|
| Emails em massa | Implementar fila |
| Relatórios pesados | Gerar assíncrono |
| Imports grandes | Processar em background |

**Solução:** Supabase Edge Functions + pg_cron

### Read Replica

| Trigger | Ação |
|---------|------|
| 50+ escolas | Avaliar |
| Relatórios impactando produção | Separar leitura |

**Custo estimado:** +$50-100/mês

### Partitioning por Escola

| Trigger | Ação |
|---------|------|
| 100+ escolas | Implementar |
| Tabela presencas > 10M rows | Particionar |

**Complexidade:** Alta

---

## Roadmap Técnico

### Curto Prazo (1-4 semanas)

| Item | Prioridade | Esforço |
|------|------------|---------|
| Índices compostos em presencas | Alta | 1 dia |
| Otimizar RLS para JWT claim | Alta | 2 dias |
| Regenerar tipos Supabase | Média | 1 dia |
| Batch INSERT para chamada | Média | 2 dias |

### Médio Prazo (1-3 meses)

| Item | Prioridade | Esforço |
|------|------------|---------|
| Dark mode | Média | 3 dias |
| Paginação infinite scroll | Média | 5 dias |
| Testes para services críticos | Média | 1 semana |
| RPC agregada para dashboard | Baixa | 3 dias |

### Longo Prazo (3-6 meses)

| Item | Trigger | Esforço |
|------|---------|---------|
| Cache Redis | 5.000+ usuários | 1 semana |
| Comunicação escola-família | Demanda mercado | 2-3 semanas |
| Read replica | 50+ escolas | 1 semana |

---

## Resumo de Decisão

```
┌─────────────────────────────────────────────────────────┐
│                    AGORA (Seguro)                       │
│  20 escolas │ 10.000 alunos │ Monolito + Supabase Pro  │
├─────────────────────────────────────────────────────────┤
│                 EM BREVE (Ajustes)                      │
│  30 escolas │ 15.000 alunos │ + Índices + Team Plan    │
├─────────────────────────────────────────────────────────┤
│                  FUTURO (Evolução)                      │
│  50+ escolas │ 30.000+ alunos │ + Redis + Replica      │
└─────────────────────────────────────────────────────────┘
```

---

## Documentos Relacionados

- [01 - Visão Geral](./01-visao-geral.md)
- [02 - Arquitetura](./02-arquitetura.md)
- [03 - Segurança](./03-seguranca.md)
- [04 - Escalabilidade](./04-escalabilidade.md)
- [05 - Boas Práticas](./05-boas-praticas.md)
- [06 - Operação](./06-operacao.md)

---

*Fim da documentação técnica*
