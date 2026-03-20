-- RLS Policies para as novas funcionalidades (Executar no SQL Editor do Supabase)

-- 1. Políticas para solicitacoes_aluno
ALTER TABLE public.solicitacoes_aluno ENABLE ROW LEVEL SECURITY;

-- Alunos podem ver suas próprias solicitações
CREATE POLICY "Alunos podem ver suas proprias solicitacoes" 
ON public.solicitacoes_aluno FOR SELECT
USING (aluno_id IN (
  SELECT id FROM public.alunos WHERE user_id = auth.uid()
));

-- Alunos podem criar solicitações para si mesmos
CREATE POLICY "Alunos podem criar solicitacoes"
ON public.solicitacoes_aluno FOR INSERT
WITH CHECK (aluno_id IN (
  SELECT id FROM public.alunos WHERE user_id = auth.uid()
));

-- Usuários da escola (admin, gestores) podem ver as solicitações da sua escola
CREATE POLICY "Escola pode ver e editar solicitacoes"
ON public.solicitacoes_aluno FOR ALL
USING (escola_id IN (
  SELECT escola_id FROM public.user_roles WHERE user_id = auth.uid()
));

-- 2. Políticas para portal_comunicados
ALTER TABLE public.portal_comunicados ENABLE ROW LEVEL SECURITY;

-- Qualquer pessoa logada (incluindo alunos associados à escola) pode ver avisos ativos
CREATE POLICY "Alunos podem ver comunicados ativos"
ON public.portal_comunicados FOR SELECT
USING (
  ativo = true 
  AND escola_id IN (
    SELECT escola_id FROM public.alunos WHERE user_id = auth.uid()
  )
);

-- Usuários da escola podem gerenciar comunicados
CREATE POLICY "Escola pode gerenciar comunicados"
ON public.portal_comunicados FOR ALL
USING (escola_id IN (
  SELECT escola_id FROM public.user_roles WHERE user_id = auth.uid()
));

-- 3. Políticas para portal_estagios
ALTER TABLE public.portal_estagios ENABLE ROW LEVEL SECURITY;

-- Alunos podem ver estágios ativos da sua escola
CREATE POLICY "Alunos podem ver estagios ativos"
ON public.portal_estagios FOR SELECT
USING (
  ativo = true 
  AND escola_id IN (
    SELECT escola_id FROM public.alunos WHERE user_id = auth.uid()
  )
);

-- Usuários da escola podem gerenciar estágios
CREATE POLICY "Escola pode gerenciar estagios"
ON public.portal_estagios FOR ALL
USING (escola_id IN (
  SELECT escola_id FROM public.user_roles WHERE user_id = auth.uid()
));
