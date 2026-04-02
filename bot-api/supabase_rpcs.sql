-- =============================================
-- WhatsApp Bot — RPCs e Tabelas Auxiliares
-- =============================================

-- Extensão para busca sem acentos
CREATE EXTENSION IF NOT EXISTS unaccent;

-- =============================================
-- Tabela: whatsapp_pre_cadastros
-- Pré-cadastros de responsáveis via WhatsApp Bot.
-- A secretaria valida no painel antes de gravar
-- os dados na tabela alunos.
-- =============================================
CREATE TABLE IF NOT EXISTS public.whatsapp_pre_cadastros (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL,
  aluno_id uuid NOT NULL,
  nome_responsavel text NOT NULL,
  telefone_responsavel text NOT NULL,
  status text NOT NULL DEFAULT 'PENDENTE'
    CHECK (status IN ('PENDENTE', 'APROVADO', 'REJEITADO')),
  created_at timestamptz DEFAULT now(),
  revisado_por uuid,
  revisado_em timestamptz,
  CONSTRAINT whatsapp_pre_cadastros_pkey PRIMARY KEY (id),
  CONSTRAINT whatsapp_pre_cadastros_escola_id_fkey
    FOREIGN KEY (escola_id) REFERENCES public.escola_configuracao(id),
  CONSTRAINT whatsapp_pre_cadastros_aluno_id_fkey
    FOREIGN KEY (aluno_id) REFERENCES public.alunos(id),
  CONSTRAINT whatsapp_pre_cadastros_revisado_por_fkey
    FOREIGN KEY (revisado_por) REFERENCES auth.users(id)
);

-- =============================================
-- RPC: buscar_aluno_por_nome
-- Busca fuzzy (sem acento, case-insensitive)
-- para o fluxo de auto-cadastro do bot.
-- =============================================
CREATE OR REPLACE FUNCTION buscar_aluno_por_nome(
    p_escola_id uuid,
    p_nome_busca text
) RETURNS TABLE(
    id uuid,
    nome text,
    turma_nome text,
    turma_id uuid,
    telefone_responsavel text,
    telefone_responsavel_2 text
) AS $$
BEGIN
    RETURN QUERY
    SELECT a.id, a.nome, COALESCE(t.nome, 'Sem turma') AS turma_nome,
           a.turma_id, a.telefone_responsavel, a.telefone_responsavel_2
    FROM alunos a
    LEFT JOIN turmas t ON t.id = a.turma_id
    WHERE a.escola_id = p_escola_id
      AND a.situacao = 'ativo'
      AND unaccent(lower(a.nome)) ILIKE '%' || unaccent(lower(trim(p_nome_busca))) || '%'
    ORDER BY a.nome
    LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
