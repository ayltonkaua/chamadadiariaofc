-- =========================================================
-- Migration: WhatsApp Bot System
-- Tables: whatsapp_bot_config, whatsapp_logs
-- Date: 2026-02-26
-- =========================================================

-- 1. Table: whatsapp_bot_config
-- Stores WhatsApp bot configuration and message templates per escola
CREATE TABLE IF NOT EXISTS public.whatsapp_bot_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escola_configuracao(id) ON DELETE CASCADE,
  template_risco text DEFAULT 'Olá {responsavel}, informamos que o(a) aluno(a) {nome} está em situação de risco com {faltas} faltas acumuladas. Por favor, entre em contato com a escola. Data: {data}',
  template_consecutiva text DEFAULT 'Olá {responsavel}, o(a) aluno(a) {nome} possui {faltas} faltas consecutivas. Solicitamos atenção para evitar prejuízo no aprendizado. Data: {data}',
  template_mensal text DEFAULT 'Olá {responsavel}, segue o resumo mensal de frequência do(a) aluno(a) {nome}: Total de faltas no mês: {faltas}. Data do relatório: {data}',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT whatsapp_bot_config_escola_id_unique UNIQUE (escola_id)
);

-- 2. Table: whatsapp_logs
-- Stores log of every WhatsApp message sent
CREATE TABLE IF NOT EXISTS public.whatsapp_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escola_configuracao(id) ON DELETE CASCADE,
  aluno_id uuid REFERENCES public.alunos(id) ON DELETE SET NULL,
  telefone text NOT NULL,
  mensagem text NOT NULL,
  tipo text NOT NULL DEFAULT 'manual' CHECK (tipo IN ('manual', 'risco', 'consecutiva', 'mensal')),
  status text NOT NULL DEFAULT 'enviado' CHECK (status IN ('enviado', 'falha', 'pendente')),
  erro text,
  created_at timestamp with time zone DEFAULT now()
);

-- =========================================================
-- RLS Policies
-- =========================================================

ALTER TABLE public.whatsapp_bot_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_logs ENABLE ROW LEVEL SECURITY;

-- Helper: get escola_id from current authenticated user
-- (reuses existing pattern from other migrations)

-- whatsapp_bot_config policies
CREATE POLICY "whatsapp_bot_config_select" ON public.whatsapp_bot_config
  FOR SELECT USING (
    escola_id IN (
      SELECT ur.escola_id FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin', 'diretor', 'coordenador', 'secretario')
    )
  );

CREATE POLICY "whatsapp_bot_config_insert" ON public.whatsapp_bot_config
  FOR INSERT WITH CHECK (
    escola_id IN (
      SELECT ur.escola_id FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin', 'diretor')
    )
  );

CREATE POLICY "whatsapp_bot_config_update" ON public.whatsapp_bot_config
  FOR UPDATE USING (
    escola_id IN (
      SELECT ur.escola_id FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin', 'diretor')
    )
  );

-- whatsapp_logs policies
CREATE POLICY "whatsapp_logs_select" ON public.whatsapp_logs
  FOR SELECT USING (
    escola_id IN (
      SELECT ur.escola_id FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin', 'diretor', 'coordenador', 'secretario')
    )
  );

CREATE POLICY "whatsapp_logs_insert" ON public.whatsapp_logs
  FOR INSERT WITH CHECK (
    escola_id IN (
      SELECT ur.escola_id FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin', 'diretor', 'coordenador', 'secretario')
    )
  );

-- Service role bypass (for bot-api server using service key)
CREATE POLICY "whatsapp_bot_config_service" ON public.whatsapp_bot_config
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "whatsapp_logs_service" ON public.whatsapp_logs
  FOR ALL USING (auth.role() = 'service_role');

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_escola_id ON public.whatsapp_logs(escola_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_created_at ON public.whatsapp_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_aluno_id ON public.whatsapp_logs(aluno_id);
