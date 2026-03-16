-- Add second responsible phone number field
ALTER TABLE public.alunos
ADD COLUMN IF NOT EXISTS telefone_responsavel_2 text;
