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
  data_nascimento date,
  situacao text DEFAULT 'ativo'::text CHECK (situacao = ANY (ARRAY['ativo'::text, 'aprovado'::text, 'reprovado'::text, 'transferido'::text, 'abandono'::text, 'falecido'::text, 'cancelado'::text])),
  trabalha boolean DEFAULT false,
  recebe_pe_de_meia boolean DEFAULT false,
  mora_com_familia boolean DEFAULT true,
  usa_transporte boolean DEFAULT false,
  tem_passe_livre boolean DEFAULT false,
  latitude double precision,
  longitude double precision,
  telefone_aluno text,
  recebe_bolsa_familia boolean DEFAULT false,
  telefone_responsavel_2 text,
  CONSTRAINT alunos_pkey PRIMARY KEY (id),
  CONSTRAINT alunos_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escola_configuracao(id),
  CONSTRAINT alunos_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT alunos_turma_id_fkey FOREIGN KEY (turma_id) REFERENCES public.turmas(id)
);
CREATE TABLE public.analises_evasao (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL,
  escola_id uuid NOT NULL,
  score_risco integer NOT NULL DEFAULT 0 CHECK (score_risco >= 0 AND score_risco <= 100),
  nivel text NOT NULL DEFAULT 'verde'::text CHECK (nivel = ANY (ARRAY['verde'::text, 'amarelo'::text, 'vermelho'::text])),
  fatores_risco jsonb DEFAULT '[]'::jsonb,
  recomendacao_ia text,
  modelo_utilizado text CHECK (modelo_utilizado = ANY (ARRAY['groq'::text, 'gemini'::text, 'local'::text])),
  created_at timestamp with time zone DEFAULT now(),
  analisado_por uuid,
  CONSTRAINT analises_evasao_pkey PRIMARY KEY (id),
  CONSTRAINT analises_evasao_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id),
  CONSTRAINT analises_evasao_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escola_configuracao(id),
  CONSTRAINT analises_evasao_analisado_por_fkey FOREIGN KEY (analisado_por) REFERENCES auth.users(id)
);
CREATE TABLE public.anos_letivos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL,
  ano integer NOT NULL,
  nome text NOT NULL,
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  status text NOT NULL DEFAULT 'aberto'::text CHECK (status = ANY (ARRAY['planejamento'::text, 'aberto'::text, 'fechado'::text, 'arquivado'::text])),
  criado_por uuid,
  fechado_por uuid,
  fechado_em timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT anos_letivos_pkey PRIMARY KEY (id),
  CONSTRAINT anos_letivos_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escola_configuracao(id),
  CONSTRAINT anos_letivos_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES auth.users(id),
  CONSTRAINT anos_letivos_fechado_por_fkey FOREIGN KEY (fechado_por) REFERENCES auth.users(id)
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
  CONSTRAINT atestados_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escola_configuracao(id),
  CONSTRAINT atestados_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id)
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
  CONSTRAINT chamadas_sync_log_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escola_configuracao(id),
  CONSTRAINT chamadas_sync_log_synced_by_fkey FOREIGN KEY (synced_by) REFERENCES auth.users(id),
  CONSTRAINT chamadas_sync_log_turma_id_fkey FOREIGN KEY (turma_id) REFERENCES public.turmas(id)
);
CREATE TABLE public.change_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  escola_id uuid NOT NULL,
  operation text NOT NULL CHECK (operation = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])),
  changed_at timestamp with time zone NOT NULL DEFAULT now(),
  changed_by uuid,
  CONSTRAINT change_log_pkey PRIMARY KEY (id),
  CONSTRAINT change_log_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escola_configuracao(id),
  CONSTRAINT change_log_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES auth.users(id)
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
  tipo_chamada text DEFAULT 'diaria'::text CHECK (tipo_chamada = ANY (ARRAY['diaria'::text, 'disciplina'::text])),
  latitude double precision,
  longitude double precision,
  CONSTRAINT escola_configuracao_pkey PRIMARY KEY (id)
);
CREATE TABLE public.escola_rate_limit (
  escola_id uuid NOT NULL,
  window_start timestamp with time zone NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 0,
  last_request_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT escola_rate_limit_pkey PRIMARY KEY (escola_id),
  CONSTRAINT escola_rate_limit_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escola_configuracao(id)
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
  CONSTRAINT grade_horaria_disciplina_id_fkey FOREIGN KEY (disciplina_id) REFERENCES public.disciplinas(id),
  CONSTRAINT grade_horaria_turma_id_fkey FOREIGN KEY (turma_id) REFERENCES public.turmas(id)
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
  CONSTRAINT justificativas_faltas_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escola_configuracao(id),
  CONSTRAINT justificativas_faltas_presenca_id_fkey FOREIGN KEY (presenca_id) REFERENCES public.presencas(id),
  CONSTRAINT fk_aluno FOREIGN KEY (aluno_id) REFERENCES public.alunos(id)
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
  CONSTRAINT notas_disciplina_id_fkey FOREIGN KEY (disciplina_id) REFERENCES public.disciplinas(id),
  CONSTRAINT notas_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id)
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
  CONSTRAINT observacoes_alunos_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escola_configuracao(id),
  CONSTRAINT observacoes_alunos_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT observacoes_alunos_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id),
  CONSTRAINT observacoes_alunos_turma_id_fkey FOREIGN KEY (turma_id) REFERENCES public.turmas(id)
);
CREATE TABLE public.observacoes_sync_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL UNIQUE,
  escola_id uuid NOT NULL,
  aluno_id uuid NOT NULL,
  turma_id uuid NOT NULL,
  synced_at timestamp with time zone NOT NULL DEFAULT now(),
  synced_by uuid,
  client_timestamp bigint,
  CONSTRAINT observacoes_sync_log_pkey PRIMARY KEY (id),
  CONSTRAINT observacoes_sync_log_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id),
  CONSTRAINT observacoes_sync_log_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escola_configuracao(id),
  CONSTRAINT observacoes_sync_log_synced_by_fkey FOREIGN KEY (synced_by) REFERENCES auth.users(id),
  CONSTRAINT observacoes_sync_log_turma_id_fkey FOREIGN KEY (turma_id) REFERENCES public.turmas(id)
);
CREATE TABLE public.oportunidades_estagio (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  escola_id uuid,
  titulo text NOT NULL,
  empresa text,
  descricao text NOT NULL,
  link_inscricao text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT oportunidades_estagio_pkey PRIMARY KEY (id),
  CONSTRAINT oportunidades_estagio_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escola_configuracao(id)
);
CREATE TABLE public.pesquisa_destinatarios (
  pesquisa_id uuid NOT NULL,
  aluno_id uuid NOT NULL,
  status_resposta character varying NOT NULL DEFAULT 'pendente'::character varying,
  CONSTRAINT pesquisa_destinatarios_pkey PRIMARY KEY (pesquisa_id, aluno_id),
  CONSTRAINT pesquisa_destinatarios_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id)
);
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
CREATE TABLE public.presencas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL,
  turma_id uuid NOT NULL,
  data_chamada date NOT NULL,
  presente boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  falta_justificada boolean NOT NULL DEFAULT false,
  escola_id uuid NOT NULL,
  disciplina_id uuid,
  CONSTRAINT presencas_pkey PRIMARY KEY (id),
  CONSTRAINT presencas_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escola_configuracao(id),
  CONSTRAINT presencas_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id),
  CONSTRAINT presencas_disciplina_id_fkey FOREIGN KEY (disciplina_id) REFERENCES public.disciplinas(id),
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
  CONSTRAINT registros_atrasos_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escola_configuracao(id),
  CONSTRAINT fk_aluno FOREIGN KEY (aluno_id) REFERENCES public.alunos(id)
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
CREATE TABLE public.solicitacoes_aluno (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  aluno_id uuid,
  escola_id uuid,
  assunto text NOT NULL,
  mensagem text NOT NULL,
  telefone_contato text,
  status text DEFAULT 'aberto'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT solicitacoes_aluno_pkey PRIMARY KEY (id),
  CONSTRAINT solicitacoes_aluno_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id),
  CONSTRAINT solicitacoes_aluno_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escola_configuracao(id)
);
CREATE TABLE public.sync_metrics (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL,
  user_id uuid,
  event_type text NOT NULL CHECK (event_type = ANY (ARRAY['sync_start'::text, 'sync_success'::text, 'sync_error'::text, 'sync_partial'::text])),
  duration_ms integer,
  items_total integer,
  items_success integer,
  items_failed integer,
  error_code text,
  error_message text,
  client_version text,
  client_platform text,
  client_timestamp timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT sync_metrics_pkey PRIMARY KEY (id),
  CONSTRAINT sync_metrics_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escola_configuracao(id),
  CONSTRAINT sync_metrics_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
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
  CONSTRAINT transferencias_alunos_realizado_por_fkey FOREIGN KEY (realizado_por) REFERENCES auth.users(id),
  CONSTRAINT transferencias_alunos_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escola_configuracao(id),
  CONSTRAINT transferencias_alunos_turma_origem_fkey FOREIGN KEY (turma_origem_id) REFERENCES public.turmas(id),
  CONSTRAINT transferencias_alunos_turma_destino_fkey FOREIGN KEY (turma_destino_id) REFERENCES public.turmas(id)
);
CREATE TABLE public.turma_professores (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL,
  turma_id uuid NOT NULL,
  professor_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT turma_professores_pkey PRIMARY KEY (id),
  CONSTRAINT turma_professores_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escola_configuracao(id),
  CONSTRAINT turma_professores_professor_id_fkey FOREIGN KEY (professor_id) REFERENCES auth.users(id),
  CONSTRAINT turma_professores_turma_id_fkey FOREIGN KEY (turma_id) REFERENCES public.turmas(id)
);
CREATE TABLE public.turmas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  user_id uuid,
  numero_sala text NOT NULL DEFAULT ''::text,
  escola_id uuid NOT NULL,
  turno USER-DEFINED,
  ano_letivo_id uuid,
  CONSTRAINT turmas_pkey PRIMARY KEY (id),
  CONSTRAINT fk_turmas_escola FOREIGN KEY (escola_id) REFERENCES public.escola_configuracao(id),
  CONSTRAINT turmas_ano_letivo_id_fkey FOREIGN KEY (ano_letivo_id) REFERENCES public.anos_letivos(id)
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
CREATE TABLE public.uso_ia_diario (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  escola_id uuid NOT NULL,
  data date NOT NULL DEFAULT CURRENT_DATE,
  contagem integer NOT NULL DEFAULT 1,
  CONSTRAINT uso_ia_diario_pkey PRIMARY KEY (id),
  CONSTRAINT uso_ia_diario_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.whatsapp_bot_config (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL UNIQUE,
  template_risco text DEFAULT 'Olá {responsavel}, informamos que o(a) aluno(a) {nome} está em situação de risco com {faltas} faltas acumuladas. Por favor, entre em contato com a escola. Data: {data}'::text,
  template_consecutiva text DEFAULT 'Olá {responsavel}, o(a) aluno(a) {nome} possui {faltas} faltas consecutivas. Solicitamos atenção para evitar prejuízo no aprendizado. Data: {data}'::text,
  template_mensal text DEFAULT 'Olá {responsavel}, segue o resumo mensal de frequência do(a) aluno(a) {nome}: Total de faltas no mês: {faltas}. Data do relatório: {data}'::text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  template_falta_diaria text DEFAULT 'Prezado(a) {responsavel}, informamos que o(a) aluno(a) *{nome}* não compareceu à aula hoje ({data}). Caso haja algum motivo, por favor entre em contato com a escola.'::text,
  template_escalacao text DEFAULT 'Prezado(a) {responsavel}, o(a) aluno(a) *{nome}* acumula *{faltas} faltas consecutivas* sem justificativa. É fundamental que nos informe o motivo para que possamos acionar a Busca Ativa e garantir a permanência escolar. Entre em contato com urgência.'::text,
  grupo_busca_ativa_id text,
  auto_falta_diaria boolean DEFAULT false,
  auto_consecutiva boolean DEFAULT false,
  auto_mensal boolean DEFAULT false,
  horario_falta_diaria time without time zone DEFAULT '18:00:00'::time without time zone,
  grupos_favoritos jsonb DEFAULT '[]'::jsonb,
  CONSTRAINT whatsapp_bot_config_pkey PRIMARY KEY (id),
  CONSTRAINT whatsapp_bot_config_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escola_configuracao(id)
);
CREATE TABLE public.whatsapp_atendimentos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL,
  telefone_origem text NOT NULL,
  nome_contato text,
  setor text NOT NULL CHECK (setor = ANY (ARRAY['carteirinha'::text, 'boletim'::text, 'declaracao'::text, 'pe_de_meia'::text])),
  mensagem_inicial text,
  status text NOT NULL DEFAULT 'ABERTO'::text CHECK (status = ANY (ARRAY['ABERTO'::text, 'EM_ATENDIMENTO'::text, 'FINALIZADO'::text])),
  respostas jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT whatsapp_atendimentos_pkey PRIMARY KEY (id),
  CONSTRAINT whatsapp_atendimentos_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escola_configuracao(id)
);
CREATE TABLE public.whatsapp_justificativas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL,
  aluno_id uuid NOT NULL,
  data_falta date NOT NULL,
  telefone_origem character varying NOT NULL,
  mensagem_pai text NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'PENDENTE'::justificativa_status,
  data_recebimento timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  reviewer_id uuid,
  data_revisao timestamp with time zone,
  CONSTRAINT whatsapp_justificativas_pkey PRIMARY KEY (id),
  CONSTRAINT whatsapp_justificativas_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escola_configuracao(id),
  CONSTRAINT whatsapp_justificativas_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id),
  CONSTRAINT whatsapp_justificativas_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES auth.users(id)
);
CREATE TABLE public.whatsapp_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL,
  aluno_id uuid,
  telefone text NOT NULL,
  mensagem text NOT NULL,
  tipo text NOT NULL DEFAULT 'manual'::text CHECK (tipo = ANY (ARRAY['manual'::text, 'risco'::text, 'consecutiva'::text, 'mensal'::text, 'falta_diaria'::text, 'escalacao'::text, 'busca_ativa_grupo'::text, 'campanha'::text, 'atendimento'::text])),
  status text NOT NULL DEFAULT 'enviado'::text CHECK (status = ANY (ARRAY['enviado'::text, 'falha'::text, 'pendente'::text])),
  erro text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT whatsapp_logs_pkey PRIMARY KEY (id),
  CONSTRAINT whatsapp_logs_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escola_configuracao(id),
  CONSTRAINT whatsapp_logs_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id)
);