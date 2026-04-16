-- Adiciona a coluna status_funil na tabela registros_contato_busca_ativa se ela não existir
ALTER TABLE public.registros_contato_busca_ativa 
ADD COLUMN IF NOT EXISTS status_funil VARCHAR(50) DEFAULT 'EM_ACOMPANHAMENTO';

-- Garante que contatos antigos que foram criados recebam o status padrão
UPDATE public.registros_contato_busca_ativa 
SET status_funil = 'EM_ACOMPANHAMENTO' 
WHERE status_funil IS NULL;

-- Para o histórico ser ainda mais rápido, o ideal é que tenhamos a query puxando tudo
-- Em gestorService.ts, já vamos atualizar a query de select, então não precisamos obrigatoriamente
-- de uma view gigantesca a menos que a gente queira performance máxima global.
-- Como você pediu uma View/Endpoint, vamos criar uma View Materializada do Resumo pra ficar profissional.

CREATE OR REPLACE VIEW view_busca_ativa_resumos AS
SELECT 
    aluno_id,
    escola_id,
    MAX(data_contato) as ultima_data_contato,
    COUNT(*) as total_contatos,
    (
        SELECT status_funil 
        FROM public.registros_contato_busca_ativa r2 
        WHERE r2.aluno_id = r1.aluno_id 
        ORDER BY data_contato DESC 
        LIMIT 1
    ) AS ultimo_status
FROM public.registros_contato_busca_ativa r1
GROUP BY aluno_id, escola_id;

-- Damos permissões para a view
GRANT SELECT ON view_busca_ativa_resumos TO authenticated;
GRANT SELECT ON view_busca_ativa_resumos TO anon;
GRANT SELECT ON view_busca_ativa_resumos TO service_role;
