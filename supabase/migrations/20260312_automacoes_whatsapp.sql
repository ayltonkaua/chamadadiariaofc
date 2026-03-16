-- Automação, Anti-Spam e Caixa de Entrada do WhatsApp

-- 1. Tabela whatsapp_bot_config
ALTER TABLE public.whatsapp_bot_config 
ADD COLUMN IF NOT EXISTS automacao_horario TIME,
ADD COLUMN IF NOT EXISTS automacao_dias JSONB;

-- 2. Tabela alunos (Opt-out)
ALTER TABLE public.alunos 
ADD COLUMN IF NOT EXISTS opt_out_whatsapp BOOLEAN DEFAULT false;

-- 3. Nova tabela whatsapp_respostas
CREATE TABLE IF NOT EXISTS public.whatsapp_respostas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id UUID NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  aluno_id UUID REFERENCES public.alunos(id) ON DELETE SET NULL,
  telefone TEXT NOT NULL,
  mensagem_recebida TEXT NOT NULL,
  data_recebimento TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  lida BOOLEAN DEFAULT false
);

-- Habilitar RLS
ALTER TABLE public.whatsapp_respostas ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "whatsapp_respostas_select" ON public.whatsapp_respostas
  FOR SELECT TO authenticated
  USING (escola_id = (SELECT escola_id FROM public.usuarios WHERE public.usuarios.id = auth.uid()));

CREATE POLICY "whatsapp_respostas_update" ON public.whatsapp_respostas
  FOR UPDATE TO authenticated
  USING (escola_id = (SELECT escola_id FROM public.usuarios WHERE public.usuarios.id = auth.uid()));

CREATE POLICY "whatsapp_respostas_delete" ON public.whatsapp_respostas
  FOR DELETE TO authenticated
  USING (escola_id = (SELECT escola_id FROM public.usuarios WHERE public.usuarios.id = auth.uid()));

-- Política especial para Service Role (para inserção via backend)
CREATE POLICY "whatsapp_respostas_service" ON public.whatsapp_respostas
  USING (true) WITH CHECK (true);
