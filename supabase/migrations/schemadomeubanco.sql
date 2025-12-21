-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.alunos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  matricula text NOT NULL,
  turma_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  user_id uuid UNIQUE,
  escola_id uuid NOT NULL,
  nome_responsavel text,
  telefone_responsavel text,
  endereco text,
  dados_atualizados_em timestamp with time zone,
  CONSTRAINT alunos_pkey PRIMARY KEY (id),
  CONSTRAINT alunos_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escola_configuracao(id),
  CONSTRAINT alunos_turma_id_fkey FOREIGN KEY (turma_id) REFERENCES public.turmas(id),
  CONSTRAINT alunos_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.atestados (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  aluno_id uuid,
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  descricao text NOT NULL,
  status text DEFAULT 'pendente'::text CHECK (status = ANY (ARRAY['pendente'::text, 'aprovado'::text, 'rejeitado'::text])),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  escola_id uuid,
  CONSTRAINT atestados_pkey PRIMARY KEY (id),
  CONSTRAINT atestados_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id),
  CONSTRAINT atestados_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escola_configuracao(id)
);
CREATE TABLE public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  action text NOT NULL,
  user_email text,
  details text,
  type text DEFAULT 'info'::text CHECK (type = ANY (ARRAY['info'::text, 'success'::text, 'warning'::text, 'destructive'::text, 'default'::text])),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id)
);
CREATE TABLE public.chamadas_sync_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL UNIQUE,
  turma_id uuid NOT NULL,
  escola_id uuid NOT NULL,
  data_chamada date NOT NULL,
  synced_at timestamp with time zone NOT NULL DEFAULT now(),
  synced_by uuid,
  registros_count integer NOT NULL DEFAULT 0,
  client_timestamp bigint,
  CONSTRAINT chamadas_sync_log_pkey PRIMARY KEY (id),
  CONSTRAINT chamadas_sync_log_turma_id_fkey FOREIGN KEY (turma_id) REFERENCES public.turmas(id),
  CONSTRAINT chamadas_sync_log_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escola_configuracao(id),
  CONSTRAINT chamadas_sync_log_synced_by_fkey FOREIGN KEY (synced_by) REFERENCES auth.users(id)
);
CREATE TABLE public.convites_acesso (
  email text NOT NULL,
  escola_id uuid NOT NULL,
  role text NOT NULL,
  criado_em timestamp with time zone DEFAULT now(),
  status text DEFAULT 'pendente'::text CHECK (status = ANY (ARRAY['pendente'::text, 'aceito'::text, 'expirado'::text])),
  reenviado_em timestamp with time zone,
  invited_by uuid,
  CONSTRAINT convites_acesso_pkey PRIMARY KEY (email, escola_id),
  CONSTRAINT convites_acesso_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escola_configuracao(id),
  CONSTRAINT convites_acesso_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id)
);
CREATE TABLE public.disciplinas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL,
  nome text NOT NULL,
  cor text DEFAULT '#E2E8F0'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT disciplinas_pkey PRIMARY KEY (id),
  CONSTRAINT disciplinas_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escola_configuracao(id)
);
CREATE TABLE public.escola_configuracao (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  endereco text,
  telefone character varying,
  email text NOT NULL UNIQUE,
  criado_em timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  atualizado_em timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  cor_primaria text DEFAULT '#6D28D9'::text,
  cor_secundaria text DEFAULT '#4F46E5'::text,
  url_logo text,
  status text DEFAULT 'aprovada'::text CHECK (status = ANY (ARRAY['pendente'::text, 'aprovada'::text, 'rejeitada'::text])),
  CONSTRAINT escola_configuracao_pkey PRIMARY KEY (id)
);
CREATE TABLE public.eventos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  data_evento date NOT NULL,
  ativo boolean DEFAULT true,
  escola_id uuid NOT NULL,
  CONSTRAINT eventos_pkey PRIMARY KEY (id),
  CONSTRAINT eventos_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escola_configuracao(id)
);
CREATE TABLE public.eventos_checkins (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  evento_id uuid,
  aluno_id uuid,
  data_entrada timestamp with time zone DEFAULT now(),
  controller_id uuid,
  controller_aluno_id uuid,
  CONSTRAINT eventos_checkins_pkey PRIMARY KEY (id),
  CONSTRAINT eventos_checkins_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id),
  CONSTRAINT eventos_checkins_controller_id_fkey FOREIGN KEY (controller_id) REFERENCES auth.users(id),
  CONSTRAINT eventos_checkins_controller_aluno_id_fkey FOREIGN KEY (controller_aluno_id) REFERENCES public.alunos(id),
  CONSTRAINT eventos_checkins_evento_id_fkey FOREIGN KEY (evento_id) REFERENCES public.eventos(id)
);
CREATE TABLE public.eventos_convidados (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  evento_id uuid,
  nome text NOT NULL,
  tipo text DEFAULT 'Convidado'::text,
  observacao text,
  criado_por uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT eventos_convidados_pkey PRIMARY KEY (id),
  CONSTRAINT eventos_convidados_evento_id_fkey FOREIGN KEY (evento_id) REFERENCES public.eventos(id),
  CONSTRAINT eventos_convidados_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES auth.users(id)
);
CREATE TABLE public.eventos_convidados_checkins (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  evento_id uuid,
  convidado_id uuid,
  data_entrada timestamp with time zone DEFAULT now(),
  controller_id uuid,
  CONSTRAINT eventos_convidados_checkins_pkey PRIMARY KEY (id),
  CONSTRAINT eventos_convidados_checkins_controller_id_fkey FOREIGN KEY (controller_id) REFERENCES auth.users(id),
  CONSTRAINT eventos_convidados_checkins_convidado_id_fkey FOREIGN KEY (convidado_id) REFERENCES public.eventos_convidados(id),
  CONSTRAINT eventos_convidados_checkins_evento_id_fkey FOREIGN KEY (evento_id) REFERENCES public.eventos(id)
);
CREATE TABLE public.eventos_staff (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  evento_id uuid,
  aluno_id uuid,
  user_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT eventos_staff_pkey PRIMARY KEY (id),
  CONSTRAINT eventos_staff_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id),
  CONSTRAINT eventos_staff_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT eventos_staff_evento_id_fkey FOREIGN KEY (evento_id) REFERENCES public.eventos(id)
);
CREATE TABLE public.grade_horaria (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL,
  turma_id uuid NOT NULL,
  disciplina_id uuid,
  dia_semana integer NOT NULL CHECK (dia_semana >= 0 AND dia_semana <= 6),
  horario_inicio time without time zone NOT NULL,
  horario_fim time without time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT grade_horaria_pkey PRIMARY KEY (id),
  CONSTRAINT grade_horaria_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escola_configuracao(id),
  CONSTRAINT grade_horaria_turma_id_fkey FOREIGN KEY (turma_id) REFERENCES public.turmas(id),
  CONSTRAINT grade_horaria_disciplina_id_fkey FOREIGN KEY (disciplina_id) REFERENCES public.disciplinas(id)
);
CREATE TABLE public.justificativas_faltas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  presenca_id uuid NOT NULL,
  motivo text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  aluno_id uuid,
  escola_id uuid NOT NULL,
  CONSTRAINT justificativas_faltas_pkey PRIMARY KEY (id),
  CONSTRAINT fk_aluno FOREIGN KEY (aluno_id) REFERENCES public.alunos(id),
  CONSTRAINT justificativas_faltas_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escola_configuracao(id),
  CONSTRAINT justificativas_faltas_presenca_id_fkey FOREIGN KEY (presenca_id) REFERENCES public.presencas(id)
);
CREATE TABLE public.notas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL,
  aluno_id uuid NOT NULL,
  disciplina_id uuid NOT NULL,
  semestre integer NOT NULL CHECK (semestre >= 1 AND semestre <= 3),
  valor numeric NOT NULL,
  tipo_avaliacao text DEFAULT 'media'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT notas_pkey PRIMARY KEY (id),
  CONSTRAINT notas_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escola_configuracao(id),
  CONSTRAINT notas_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id),
  CONSTRAINT notas_disciplina_id_fkey FOREIGN KEY (disciplina_id) REFERENCES public.disciplinas(id)
);
CREATE TABLE public.observacoes_alunos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL,
  titulo text NOT NULL,
  descricao text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  data_observacao date NOT NULL,
  user_id uuid,
  turma_id uuid,
  escola_id uuid NOT NULL,
  CONSTRAINT observacoes_alunos_pkey PRIMARY KEY (id),
  CONSTRAINT observacoes_alunos_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id),
  CONSTRAINT observacoes_alunos_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escola_configuracao(id),
  CONSTRAINT observacoes_alunos_turma_id_fkey FOREIGN KEY (turma_id) REFERENCES public.turmas(id),
  CONSTRAINT observacoes_alunos_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.pesquisa_destinatarios (
  pesquisa_id uuid NOT NULL,
  aluno_id uuid NOT NULL,
  status_resposta character varying NOT NULL DEFAULT 'pendente'::character varying,
  CONSTRAINT pesquisa_destinatarios_pkey PRIMARY KEY (pesquisa_id, aluno_id),
  CONSTRAINT pesquisa_destinatarios_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id),
  CONSTRAINT pesquisa_destinatarios_pesquisa_id_fkey FOREIGN KEY (pesquisa_id) REFERENCES public.pesquisas(id)
);
CREATE TABLE public.pesquisa_perguntas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pesquisa_id uuid NOT NULL,
  texto_pergunta text NOT NULL,
  tipo_pergunta character varying NOT NULL DEFAULT 'multipla_escolha'::character varying,
  opcoes jsonb,
  ordem integer NOT NULL DEFAULT 0,
  CONSTRAINT pesquisa_perguntas_pkey PRIMARY KEY (id),
  CONSTRAINT pesquisa_perguntas_pesquisa_id_fkey FOREIGN KEY (pesquisa_id) REFERENCES public.pesquisas(id)
);
CREATE TABLE public.pesquisa_respostas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pesquisa_id uuid NOT NULL,
  pergunta_id uuid NOT NULL,
  aluno_id uuid NOT NULL,
  resposta text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT pesquisa_respostas_pkey PRIMARY KEY (id),
  CONSTRAINT pesquisa_respostas_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id),
  CONSTRAINT pesquisa_respostas_pergunta_id_fkey FOREIGN KEY (pergunta_id) REFERENCES public.pesquisa_perguntas(id),
  CONSTRAINT pesquisa_respostas_pesquisa_id_fkey FOREIGN KEY (pesquisa_id) REFERENCES public.pesquisas(id)
);
CREATE TABLE public.pesquisas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  titulo text NOT NULL,
  descricao text,
  status character varying NOT NULL DEFAULT 'ativa'::character varying,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone,
  escola_id uuid,
  CONSTRAINT pesquisas_pkey PRIMARY KEY (id),
  CONSTRAINT pesquisas_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escola_configuracao(id),
  CONSTRAINT pesquisas_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.presencas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL,
  turma_id uuid NOT NULL,
  data_chamada date NOT NULL,
  presente boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  falta_justificada boolean NOT NULL DEFAULT false,
  escola_id uuid NOT NULL,
  CONSTRAINT presencas_pkey PRIMARY KEY (id),
  CONSTRAINT presencas_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id),
  CONSTRAINT presencas_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escola_configuracao(id),
  CONSTRAINT presencas_turma_id_fkey FOREIGN KEY (turma_id) REFERENCES public.turmas(id)
);
CREATE TABLE public.programas_registros (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  programa_id uuid,
  matricula_beneficiario text NOT NULL,
  dados_pagamento jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT programas_registros_pkey PRIMARY KEY (id),
  CONSTRAINT programas_registros_programa_id_fkey FOREIGN KEY (programa_id) REFERENCES public.programas_sociais(id)
);
CREATE TABLE public.programas_sociais (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  escola_id uuid,
  nome text NOT NULL,
  descricao text,
  ativo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT programas_sociais_pkey PRIMARY KEY (id),
  CONSTRAINT programas_sociais_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escola_configuracao(id)
);
CREATE TABLE public.registros_atrasos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL,
  data_atraso date NOT NULL,
  horario_registro time without time zone NOT NULL DEFAULT CURRENT_TIME,
  criado_em timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  escola_id uuid NOT NULL,
  CONSTRAINT registros_atrasos_pkey PRIMARY KEY (id),
  CONSTRAINT fk_aluno FOREIGN KEY (aluno_id) REFERENCES public.alunos(id),
  CONSTRAINT registros_atrasos_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escola_configuracao(id)
);
CREATE TABLE public.registros_contato_busca_ativa (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL,
  data_contato date NOT NULL,
  forma_contato text NOT NULL,
  justificativa_faltas text NOT NULL,
  link_arquivo text,
  monitor_responsavel text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  escola_id uuid NOT NULL,
  CONSTRAINT registros_contato_busca_ativa_pkey PRIMARY KEY (id),
  CONSTRAINT registros_contato_busca_ativa_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escola_configuracao(id)
);
CREATE TABLE public.transferencias_alunos (
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
  CONSTRAINT transferencias_alunos_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id),
  CONSTRAINT transferencias_alunos_turma_origem_fkey FOREIGN KEY (turma_origem_id) REFERENCES public.turmas(id),
  CONSTRAINT transferencias_alunos_turma_destino_fkey FOREIGN KEY (turma_destino_id) REFERENCES public.turmas(id),
  CONSTRAINT transferencias_alunos_realizado_por_fkey FOREIGN KEY (realizado_por) REFERENCES auth.users(id),
  CONSTRAINT transferencias_alunos_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escola_configuracao(id)
);
CREATE TABLE public.turma_professores (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL,
  turma_id uuid NOT NULL,
  professor_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT turma_professores_pkey PRIMARY KEY (id),
  CONSTRAINT turma_professores_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escola_configuracao(id),
  CONSTRAINT turma_professores_turma_id_fkey FOREIGN KEY (turma_id) REFERENCES public.turmas(id),
  CONSTRAINT turma_professores_professor_id_fkey FOREIGN KEY (professor_id) REFERENCES auth.users(id)
);
CREATE TABLE public.turmas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  user_id uuid,
  numero_sala text NOT NULL DEFAULT ''::text,
  escola_id uuid NOT NULL,
  turno USER-DEFINED,
  CONSTRAINT turmas_pkey PRIMARY KEY (id),
  CONSTRAINT fk_turmas_escola FOREIGN KEY (escola_id) REFERENCES public.escola_configuracao(id)
);
CREATE TABLE public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  escola_id uuid,
  role text NOT NULL CHECK (role = ANY (ARRAY['super_admin'::text, 'admin'::text, 'diretor'::text, 'coordenador'::text, 'professor'::text, 'secretario'::text, 'aluno'::text])),
  criado_em timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  atualizado_em timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT user_roles_pkey PRIMARY KEY (id),
  CONSTRAINT user_roles_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escola_configuracao(id),
  CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);