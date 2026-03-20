-- Script de Criação das Tabelas: Comunicados e Estágios
-- Alinhado com o padrão do arquivo schemadomeubanco.sql

-- 1. Tabela de Comunicados
CREATE TABLE public.portal_comunicados (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL,
  titulo text NOT NULL,
  conteudo text NOT NULL,
  tipo text NOT NULL DEFAULT 'Aviso'::text CHECK (tipo = ANY (ARRAY['Importante'::text, 'Evento'::text, 'Aviso'::text])),
  ativo boolean DEFAULT true,
  data_publicacao timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  criado_por uuid,
  CONSTRAINT portal_comunicados_pkey PRIMARY KEY (id),
  CONSTRAINT portal_comunicados_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escola_configuracao(id),
  CONSTRAINT portal_comunicados_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES auth.users(id)
);

-- 2. Tabela de Oportunidades de Estágio
CREATE TABLE public.portal_estagios (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL,
  empresa text,
  cargo text NOT NULL,
  descricao text NOT NULL,
  bolsa numeric,
  requisitos text,
  link_inscricao text,
  ativo boolean DEFAULT true,
  data_publicacao timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  criado_por uuid,
  CONSTRAINT portal_estagios_pkey PRIMARY KEY (id),
  CONSTRAINT portal_estagios_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escola_configuracao(id),
  CONSTRAINT portal_estagios_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES auth.users(id)
);

-- Opcional (Boas práticas): Habilitar RLS
ALTER TABLE public.portal_comunicados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_estagios ENABLE ROW LEVEL SECURITY;

-- Como a API Backend do Portal do Aluno usa a SERVICE_ROLE, o RLS não vai bloquear as consultas dela, 
-- mas é bom ter uma política pública de leitura para admins caso você use pelo painel principal.
CREATE POLICY "Permitir leitura autenticada em comunicados" ON public.portal_comunicados FOR SELECT TO authenticated USING (true);
CREATE POLICY "Permitir leitura autenticada em estagios" ON public.portal_estagios FOR SELECT TO authenticated USING (true);
