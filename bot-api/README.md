# 🤖 Chamada Diária — Bot API WhatsApp

Backend Node.js para envio automatizado de alertas via WhatsApp com **isolamento completo de sessão por escola** (multi-tenant).

## 📋 Funcionalidades

- ✅ Sessão WhatsApp isolada por escola (`sessions/{escola_id}/`)
- ✅ **Persistência de sessão no Supabase Storage** (sobrevive reinícios do servidor)
- ✅ QR Code individual por escola
- ✅ Envio manual de mensagens
- ✅ Envio para grupos do WhatsApp (busca grupos da conta conectada)
- ✅ Envio por turma (mensagem personalizada para cada responsável)
- ✅ Alerta automático: alunos com 2+ faltas consecutivas
- ✅ Alerta automático: alunos em risco (>30% faltas)
- ✅ Resumo mensal de faltas para responsáveis
- ✅ Templates personalizáveis com variáveis dinâmicas
- ✅ CRON diário (18:00) e mensal (dia 25)
- ✅ Rate limiting e API Key
- ✅ Logs de envio no Supabase
- ✅ Desconectar WhatsApp pelo painel

## 🛠️ Tecnologias

- **Node.js** ≥ 18
- **Express** — Servidor HTTP
- **@whiskeysockets/baileys** — WhatsApp Web API
- **node-cron** — Agendamento de tarefas
- **@supabase/supabase-js** — Banco de dados + Storage
- **qrcode** — Geração de QR Code

---

## 🚀 Deploy no Render (Passo a Passo)

### Pré-requisitos

- Conta no [Render](https://render.com)
- Repositório no GitHub com o código do bot-api
- Projeto Supabase configurado

---

### 1. Configurar Supabase Storage

> ⚠️ **Este passo é obrigatório!** As sessões do WhatsApp são salvas no Supabase Storage para persistir entre reinícios do servidor no Render.

1. Acesse o **Supabase Dashboard** → seu projeto
2. Vá em **Storage** (menu lateral)
3. O bucket `whatsapp-sessions` será **criado automaticamente** na primeira execução do bot
4. **Alternativa manual:** Clique em "New Bucket" → nome: `whatsapp-sessions` → **Private** → Create

> 💡 O bot faz backup automático a cada reconexão e atualização de credenciais. Ao reiniciar o servidor, ele restaura a sessão automaticamente — **sem precisar escanear o QR Code novamente!**

---

### 2. Obter a Service Role Key do Supabase

1. No Supabase Dashboard → **Settings** → **API**
2. Copie a **service_role key** (⚠️ nunca exponha no frontend!)
3. Copie também a **URL** do projeto

---

### 3. Criar Web Service no Render

1. Acesse [render.com](https://render.com) → **Dashboard**
2. Clique **New** → **Web Service**
3. Conecte o repositório GitHub: `ayltonkaua/chamadadiariaofc`
4. Configure:

| Campo | Valor |
|-------|-------|
| **Name** | `chamada-diaria-bot` |
| **Region** | Escolha a mais próxima (ex: Oregon) |
| **Root Directory** | `bot-api` |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `node server.js` |
| **Instance Type** | **Starter** ($7/mês) ou **Standard** |

> ⚠️ **NÃO use o plano Free** — ele suspende o serviço após 15 min de inatividade, desconectando o WhatsApp.

---

### 4. Variáveis de Ambiente

No Render Dashboard → seu serviço → **Environment** → **Add Environment Variable**:

| Variável | Valor | Descrição |
|----------|-------|-----------|
| `SUPABASE_URL` | `https://hacgnwgpevlerwzcoawu.supabase.co` | URL do projeto Supabase |
| `SUPABASE_SERVICE_KEY` | `eyJhbGci...` | Service Role Key (Settings → API) |
| `API_KEY` | Gere com `openssl rand -hex 32` | Chave para autenticação do bot |
| `PORT` | `3002` | Porta (Render pode sobrescrever) |
| `NODE_ENV` | `production` | Ambiente |

---

### 5. Deploy

1. Clique **Create Web Service**
2. Aguarde o build (1-2 min)
3. O bot iniciará e criará o bucket `whatsapp-sessions` automaticamente
4. Copie a **URL** do serviço (ex: `https://chamada-diaria-bot.onrender.com`)

---

### 6. Configurar o Frontend

No arquivo `.env` do frontend React, adicione:

```env
VITE_BOT_API_URL=https://chamada-diaria-bot.onrender.com
VITE_BOT_API_KEY=mesma_api_key_do_render
```

---

### 7. Conectar o WhatsApp

1. Abra o painel do Chamada Diária → menu **Bot WhatsApp**
2. Na aba **Status**, clique **Gerar QR Code**
3. Escaneie com o WhatsApp do celular da escola
4. Pronto! A sessão será salva no Supabase Storage automaticamente ☁️

---

## 📡 Endpoints

### Públicos (sem auth)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/health` | Health check |

### Protegidos (requer `x-api-key` + `x-escola-id`)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/status` | Status da conexão WhatsApp |
| GET | `/generate-qr` | Gerar QR Code para conectar |
| POST | `/disconnect` | Desconectar WhatsApp |
| POST | `/sendManual` | Enviar mensagem individual |
| GET | `/whatsapp-groups` | Listar grupos do WhatsApp |
| POST | `/sendToWhatsAppGroup` | Enviar mensagem para grupo |
| POST | `/sendToGroup` | Enviar para turma (por responsável) |
| POST | `/sendRiskAlert` | Alerta para alunos em risco |
| POST | `/sendConsecutiveAlert` | Alerta para faltas consecutivas |
| POST | `/sendMonthlySummary` | Resumo mensal de faltas |

### Headers obrigatórios

```
x-api-key: sua_api_key
x-escola-id: uuid_da_escola
```

---

## 🏗️ Arquitetura

```
bot-api/
  server.js              ← Servidor Express
  whatsapp.js            ← Gerenciador de sessões Baileys
  sessionStorage.js      ← Backup/restore no Supabase Storage
  supabase.js            ← Cliente Supabase (service role)
  routes/
    manual.js            ← Rotas manuais + grupos + disconnect
    alerts.js            ← Rotas de alertas automáticos
  cron/
    scheduler.js         ← CRON jobs (diário + mensal)
  utils/
    formatMessage.js     ← Template engine + sanitização
  sessions/              ← Sessões locais (gitignored)
    {escola_uuid}/
```

### Fluxo de Persistência de Sessão

```
Servidor inicia
  → restoreSession() — baixa sessão do Supabase Storage
  → useMultiFileAuthState() — Baileys carrega credenciais
  → Conecta automaticamente (sem QR Code!)

Credenciais atualizam
  → saveCreds() — salva localmente
  → backupSession() — faz upload para Supabase Storage

Logout / Desconectar
  → Limpa sessão local
  → deleteSessionBackup() — remove do Supabase Storage
```

---

## 🔧 Desenvolvimento Local

```bash
cd bot-api
cp .env.example .env
# Edite .env com suas credenciais
npm install
node server.js
```

O servidor iniciará em `http://localhost:3002`.
