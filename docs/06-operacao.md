# 📘 ChamadaDiária - Documentação Técnica

## 06 - Operação em Produção

---

## O que Monitorar

### Dashboard Supabase

| Métrica | Local | Alerta Se |
|---------|-------|-----------|
| Conexões ativas | Database → Connections | > 48 (80%) |
| Query latency P95 | Database → Performance | > 200ms |
| Rows read/s | Database → Metrics | > 1.000/s |
| Rows written/s | Database → Metrics | > 100/s |
| Auth requests | Auth → Logs | Muitos 401 |

### React Query DevTools

| Métrica | Alerta Se |
|---------|-----------|
| Cache hit rate | < 70% |
| Queries em loading | > 10 simultâneas |
| Stale queries | Muitas refetching |

---

## Sinais de Alerta

### 🔴 Crítico (Ação Imediata)

| Sinal | Causa Provável | Ação |
|-------|----------------|------|
| 500 errors em massa | DB down, RLS quebrado | Verificar Supabase status |
| Conexões 100% | Pool exhaustion | Verificar queries lentas |
| Latência > 5s | Query pesada sem índice | Identificar via logs |

### 🟡 Atenção (Monitorar)

| Sinal | Causa Provável | Ação |
|-------|----------------|------|
| Conexões > 80% | Pico de uso | Preparar upgrade |
| Latência > 200ms | Falta de índice | Analisar queries |
| Cache miss alto | staleTime curto | Ajustar React Query |

### 🟢 Normal

| Sinal | Status |
|-------|--------|
| Conexões < 50% | OK |
| Latência < 100ms | OK |
| Cache hit > 80% | OK |

---

## Horários de Pico

| Horário | Evento | Carga Esperada |
|---------|--------|----------------|
| 07:00 - 07:30 | Chamada manhã | Alta |
| 08:00 | Início aulas | Média |
| 12:00 - 12:30 | Chamada tarde | Alta |
| 13:00 | Troca de turno | Média |
| 18:00 - 18:30 | Chamada noite | Média |

### Recomendação

Não fazer deploy ou manutenção entre **06:45 - 07:45** e **12:45 - 13:15**.

---

## Checklist de Saúde

### Diário

- [ ] Verificar conexões no Supabase Dashboard
- [ ] Checar erros nos logs (Auth, Database)
- [ ] Confirmar sincronização offline funcionando

### Semanal

- [ ] Revisar query latency P95
- [ ] Verificar crescimento de storage
- [ ] Checar audit logs por anomalias

### Mensal

- [ ] Analisar tendência de uso
- [ ] Revisar necessidade de upgrade
- [ ] Limpar dados temporários/antigos

---

## Procedimentos de Emergência

### Lentidão Generalizada

```
1. Verificar Supabase Status (status.supabase.com)
2. Checar conexões ativas no Dashboard
3. Identificar queries lentas em Logs → Database
4. Se necessário, reiniciar conexões via Dashboard
5. Comunicar usuários se > 5 minutos
```

### Erros de Autenticação

```
1. Verificar Supabase Auth → Logs
2. Checar se JWT está expirando corretamente
3. Verificar RLS policies não quebraram
4. Testar login em nova aba anônima
```

### Dados Não Sincronizando (Offline)

```
1. Verificar console do navegador
2. Checar se IndexedDB tem dados
3. Verificar se está online (navigator.onLine)
4. Forçar sincronização manual
5. Limpar cache e tentar novamente
```

---

## Comandos Úteis

### Verificar Build

```bash
npm run build
```

### Verificar TypeScript

```bash
npx tsc --noEmit
```

### Verificar ESLint

```bash
npx eslint "src/**/*.tsx" --max-warnings=0
```

### Limpar Cache Local

```javascript
// No console do navegador
indexedDB.deleteDatabase('chamada-diaria-cache');
localStorage.clear();
location.reload();
```

---

## Contatos de Emergência

| Serviço | Contato |
|---------|---------|
| Supabase Status | status.supabase.com |
| Supabase Support | support@supabase.io (Pro plan) |
| Deploy (Vercel/Netlify) | Dashboard do provedor |

---

*Anterior: [05 - Boas Práticas](./05-boas-praticas.md) | Próximo: [07 - Limitações e Roadmap](./07-limitacoes-roadmap.md)*
