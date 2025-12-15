-- Migration: 009_create_transferencias_alunos.sql
-- Cria tabela para registrar histórico de transferências de alunos entre turmas

CREATE TABLE IF NOT EXISTS public.transferencias_alunos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL,
  turma_origem_id uuid NOT NULL,
  turma_destino_id uuid NOT NULL,
  data_transferencia timestamp with time zone NOT NULL DEFAULT now(),
  motivo text,
  realizado_por uuid,
  escola_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT transferencias_alunos_pkey PRIMARY KEY (id),
  CONSTRAINT transferencias_alunos_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id) ON DELETE CASCADE,
  CONSTRAINT transferencias_alunos_turma_origem_fkey FOREIGN KEY (turma_origem_id) REFERENCES public.turmas(id),
  CONSTRAINT transferencias_alunos_turma_destino_fkey FOREIGN KEY (turma_destino_id) REFERENCES public.turmas(id),
  CONSTRAINT transferencias_alunos_realizado_por_fkey FOREIGN KEY (realizado_por) REFERENCES auth.users(id),
  CONSTRAINT transferencias_alunos_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escola_configuracao(id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_transferencias_aluno ON public.transferencias_alunos(aluno_id);
CREATE INDEX IF NOT EXISTS idx_transferencias_escola ON public.transferencias_alunos(escola_id);
CREATE INDEX IF NOT EXISTS idx_transferencias_data ON public.transferencias_alunos(data_transferencia DESC);

-- RLS (Row Level Security)
ALTER TABLE public.transferencias_alunos ENABLE ROW LEVEL SECURITY;

-- Policy: Usuários podem ver transferências da sua escola
CREATE POLICY "Users can view transfers from their school" ON public.transferencias_alunos
  FOR SELECT USING (
    escola_id IN (
      SELECT escola_id FROM public.user_roles WHERE user_id = auth.uid()
    )
  );

-- Policy: Gestores podem inserir transferências
CREATE POLICY "Managers can insert transfers" ON public.transferencias_alunos
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND escola_id = transferencias_alunos.escola_id
      AND role IN ('admin', 'diretor', 'coordenador', 'secretario')
    )
  );

-- Comentário na tabela
COMMENT ON TABLE public.transferencias_alunos IS 'Histórico de transferências de alunos entre turmas da mesma escola';
