# 📘 ChamadaDiária - Documentação Técnica

## 04 - Capacidade e Escalabilidade

---

## Infraestrutura Base

| Componente | Especificação (Supabase Pro) |
|------------|------------------------------|
| PostgreSQL | 2 vCPU / 4GB RAM |
| Conexões DB | 60 diretas + pooler |
| Storage | 8GB inclusos |
| Bandwidth | 50GB/mês |
| RLS | Ativo |

---

## Estimativas de Capacidade

### Limites Seguros Atuais

| Métrica | Limite Seguro | Limite Máximo |
|---------|---------------|---------------|
| **Escolas simultâneas** | 20 | 30 |
| **Alunos por escola** | 500 | 1.000 |
| **Total de alunos** | 10.000 | 20.000 |
| **Usuários online** | 150 | 300 |
| **INSERTs/segundo** | 50 | 100 |
| **Requisições/minuto** | 3.000 | 5.000 |

### Fórmula de Capacidade

```
Requisições práticas = (Conexões × Taxa) / (Latência × Overhead RLS)
                     = (60 × 100) / (15ms × 1.3)
                     ≈ 5.000 req/min com margem
```

---

## Cenários de Pico

### 📍 Início do Turno (7h)

> 1.000 professores fazendo chamada em 5 minutos

| Métrica | Valor |
|---------|-------|
| Inserções totais | 30.000 (30 alunos × 1.000 turmas) |
| Taxa | 100 INSERTs/segundo |
| Conexões | 20 |
| **Resultado** | 🟡 Viável com batch INSERT |

### 📍 Evento Escolar

> 2.000 check-ins em 10 minutos

| Métrica | Valor |
|---------|-------|
| Taxa | 3.3 INSERTs/segundo |
| **Resultado** | 🟢 Seguro |

### 📍 Acesso Massivo (Retrospectiva)

> 5.000 alunos simultâneos

| Métrica | Valor |
|---------|-------|
| Conexões necessárias | 100 |
| Queries | 15.000 |
| **Resultado** | 🔴 Requer cache |

---

## Gargalos Identificados

| Componente | Status | Ação Requerida |
|------------|--------|----------------|
| Índices em `presencas` | 🟡 Atenção | Criar índice composto |
| RLS com subquery | 🟡 Atenção | Usar JWT claim |
| Conexões (60) | 🟡 Atenção | Upgrade em 30+ escolas |
| Audit logs síncronos | 🟡 Atenção | Considerar async |
| React Query cache | 🟢 Seguro | Funcionando bem |

---

## Índices Recomendados

```sql
-- Executar no Supabase SQL Editor
CREATE INDEX CONCURRENTLY idx_presencas_turma_data 
  ON presencas(turma_id, data);

CREATE INDEX CONCURRENTLY idx_presencas_aluno_data 
  ON presencas(aluno_id, data DESC);

CREATE INDEX CONCURRENTLY idx_eventos_checkins_evento 
  ON eventos_checkins(evento_id, created_at);
```

---

## Thresholds de Ação

| Trigger | Ação |
|---------|------|
| 30 escolas | Criar índices compostos |
| 500 usuários simultâneos | Upgrade para Team Plan |
| 20.000 alunos | Considerar read replica |
| 50 escolas | Cache Redis necessário |
| 100 escolas | Avaliar partitioning |

---

## Até Onde Escala Sem Mudança

```
┌─────────────────────────────────────────────────────────┐
│  ZONA SEGURA: 20 escolas │ 10.000 alunos │ 150 usuários│
│  ZONA ATENÇÃO: 30-50 escolas │ Requer ajustes          │
│  REARQUITETURA: 50+ escolas │ Mudanças estruturais     │
└─────────────────────────────────────────────────────────┘
```

---

*Anterior: [03 - Segurança](./03-seguranca.md) | Próximo: [05 - Boas Práticas](./05-boas-praticas.md)*
