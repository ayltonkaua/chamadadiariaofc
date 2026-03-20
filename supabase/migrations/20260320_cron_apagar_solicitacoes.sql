-- Habilita a extensão pg_cron (verifique permissões se rodar em hosted supabase)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Script para excluir diariamente solicitações concluídas há mais de 24 horas
-- Para rodar no painel SQL do Supabase.
SELECT cron.schedule(
    'apagar_solicitacoes_concluidas', -- Nome único do job
    '0 3 * * *', -- Executa às 3:00 da manhã todos os dias
    $$
    DELETE FROM public.solicitacoes_aluno
    WHERE status = 'concluído'
      AND created_at < NOW() - INTERVAL '24 hours';
    $$
);
