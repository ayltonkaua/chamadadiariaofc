-- =========================================================
-- Migration: Absence Messaging System
-- New templates, log types, and performance index
-- Date: 2026-03-07
-- =========================================================

-- 1. New templates in whatsapp_bot_config
ALTER TABLE public.whatsapp_bot_config
  ADD COLUMN IF NOT EXISTS template_falta_diaria text 
    DEFAULT 'Prezado(a) {responsavel}, informamos que o(a) aluno(a) *{nome}* não compareceu à aula hoje ({data}). Caso haja algum motivo, por favor entre em contato com a escola.',
  ADD COLUMN IF NOT EXISTS template_escalacao text 
    DEFAULT 'Prezado(a) {responsavel}, o(a) aluno(a) *{nome}* acumula *{faltas} faltas consecutivas* sem justificativa. É fundamental que nos informe o motivo para que possamos acionar a Busca Ativa e garantir a permanência escolar. Entre em contato com urgência.',
  ADD COLUMN IF NOT EXISTS grupo_busca_ativa_id text;

-- 2. Expand tipo check constraint on whatsapp_logs
ALTER TABLE public.whatsapp_logs 
  DROP CONSTRAINT IF EXISTS whatsapp_logs_tipo_check;
ALTER TABLE public.whatsapp_logs 
  ADD CONSTRAINT whatsapp_logs_tipo_check 
  CHECK (tipo IN ('manual','risco','consecutiva','mensal','falta_diaria','escalacao','busca_ativa_grupo'));

-- 3. Performance index for daily absence queries
CREATE INDEX IF NOT EXISTS idx_presencas_data_presente 
  ON public.presencas(escola_id, data_chamada, presente);

-- 4. Index for checking recent escalation messages (anti-spam)
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_tipo_aluno 
  ON public.whatsapp_logs(aluno_id, tipo, created_at DESC);
