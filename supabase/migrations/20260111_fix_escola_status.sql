-- Migration to fix default status for escola_configuracao

-- 1. Alter the default value for 'status' column
ALTER TABLE public.escola_configuracao 
  ALTER COLUMN status SET DEFAULT 'pendente'::text;

-- 2. (Optional) Update existing schools that were effectively created recently but should be pending?
-- Assuming we only want to fix FUTURE creations.
-- If we wanted to revert recent ones:
-- UPDATE public.escola_configuracao SET status = 'pendente' WHERE status = 'aprovada' AND criado_em > now() - interval '1 day';

-- 3. Verify constraint (already exists but good to document)
-- CHECK (status = ANY (ARRAY['pendente'::text, 'aprovada'::text, 'rejeitada'::text]))
