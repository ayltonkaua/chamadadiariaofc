-- ATENÇÃO GESTOR:
-- O seu banco de dados tem uma restrição (CHECK CONSTRAINT) que só permitia abrir tickets
-- com os antigos setores ('carteirinha', 'boletim', 'declaracao', 'pe_de_meia').
-- Este script atualiza o banco para aceitar os novos setores de 'secretaria' e 'correcao_beneficio'.

-- 1. Remover a restrição atual da coluna setor na tabela whatsapp_atendimentos
ALTER TABLE public.whatsapp_atendimentos
DROP CONSTRAINT IF EXISTS whatsapp_atendimentos_setor_check;

-- 2. Recriar a restrição permitindo os novos setores inclusos
ALTER TABLE public.whatsapp_atendimentos
ADD CONSTRAINT whatsapp_atendimentos_setor_check 
CHECK (setor = ANY (ARRAY[
    'carteirinha'::text, 
    'boletim'::text, 
    'declaracao'::text, 
    'pe_de_meia'::text,
    'secretaria'::text,
    'correcao_beneficio'::text
]));

-- Pronto! Pode rodar isso no SQL Editor do Supabase.
