# 📘 ChamadaDiária - Documentação Técnica

**Versão:** 2.0.0  
**Última Atualização:** 2025-12-14

---

## Índice da Documentação

| # | Documento | Descrição |
|---|-----------|-----------|
| 01 | [Visão Geral](./01-visao-geral.md) | O que é, público-alvo, diferenciais |
| 02 | [Arquitetura](./02-arquitetura.md) | Camadas, domínios, decisões |
| 03 | [Segurança](./03-seguranca.md) | RLS, roles, isolamento, offline |
| 04 | [Escalabilidade](./04-escalabilidade.md) | Capacidade, gargalos, limites |
| 05 | [Boas Práticas](./05-boas-praticas.md) | Padrões, anti-padrões, convenções |
| 06 | [Operação](./06-operacao.md) | Monitoramento, alertas, emergências |
| 07 | [Limitações e Roadmap](./07-limitacoes-roadmap.md) | O que não foi feito e quando fazer |

---

## Resumo Executivo

### Stack
- **Frontend:** React + Vite + TypeScript
- **Backend:** Supabase (PostgreSQL + RLS + RPCs)
- **Arquitetura:** 16 domain services
- **Offline:** IndexedDB + AES-256

### Capacidade Atual
- **Escolas:** 20 (seguro), 30 (máximo)
- **Alunos:** 10.000 (seguro), 20.000 (máximo)
- **Usuários simultâneos:** 150-300

### Segurança
- RLS por `escola_id` em todas as tabelas
- Controle de roles (admin, professor, aluno)
- ESLint bloqueando acesso direto ao Supabase

---

## Para Quem é Esta Documentação

| Leitor | Documentos Relevantes |
|--------|----------------------|
| **Desenvolvedor novo** | 01, 02, 05 |
| **Equipe de TI/GRE** | 01, 03, 04 |
| **Auditor de segurança** | 03 |
| **SRE/Ops** | 04, 06 |
| **Gestor de produto** | 01, 07 |

---

*Documentação gerada em 2025-12-14*
