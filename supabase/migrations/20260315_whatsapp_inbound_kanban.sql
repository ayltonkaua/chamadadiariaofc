-- Migração: Kanban de Justificativas (WhatsApp Inbound)
-- Criação de tabela para armazenar as mensagens recebidas dos pais que precisam ser aprovadas pelo gestor

-- 1. Cria o ENUM para status da justificativa, se ainda não existir
DO $$ BEGIN
    CREATE TYPE justificativa_status AS ENUM ('PENDENTE', 'APROVADA', 'RECUSADA');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Cria a Tabela Principal (Justificativas Pendentes)
CREATE TABLE IF NOT EXISTS public.whatsapp_justificativas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    escola_id UUID NOT NULL REFERENCES public.escola_configuracao(id) ON DELETE CASCADE,
    aluno_id UUID NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
    data_falta DATE NOT NULL,
    telefone_origem VARCHAR(20) NOT NULL,
    mensagem_pai TEXT NOT NULL,
    status justificativa_status NOT NULL DEFAULT 'PENDENTE',
    data_recebimento TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    reviewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    data_revisao TIMESTAMP WITH TIME ZONE
);

-- Habilita RLS
ALTER TABLE public.whatsapp_justificativas ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de Acesso (CRUD baseado em escola_id)
CREATE POLICY "Gestores podem ver justificativas de suas escolas"
    ON public.whatsapp_justificativas FOR SELECT
    USING (
      escola_id IN (
        SELECT ur.escola_id FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'diretor', 'coordenador', 'secretario', 'professor')
      )
    );

CREATE POLICY "Bot/API pode inserir justificativas"
    ON public.whatsapp_justificativas FOR INSERT
    WITH CHECK (true); -- Segurança seria garantida pelo backend da bot-api que tem service_role

CREATE POLICY "Gestores podem atualizar status das justificativas"
    ON public.whatsapp_justificativas FOR UPDATE
    USING (
      escola_id IN (
        SELECT ur.escola_id FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'diretor', 'coordenador', 'secretario')
      )
    );

-- 4. Função RPC para processar o Kanban Drop Action (Aprovar/Recusar)
CREATE OR REPLACE FUNCTION processar_justificativa_kanban(
    p_justificativa_id UUID,
    p_novo_status justificativa_status,
    p_reviewer_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_justificativa RECORD;
    v_presenca_id UUID;
BEGIN
    -- 1. Busca a justificativa
    SELECT * INTO v_justificativa 
    FROM public.whatsapp_justificativas
    WHERE id = p_justificativa_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Justificativa não encontrada';
    END IF;

    -- 2. Se for para APROVAR, atualiza a presença do aluno naquele dia para "falta_justificada = true"
    IF p_novo_status = 'APROVADA' THEN
        -- Tenta achar a presença desse dia
        SELECT id INTO v_presenca_id
        FROM public.presencas
        WHERE aluno_id = v_justificativa.aluno_id
        AND data_chamada = v_justificativa.data_falta;

        IF FOUND THEN
            -- Se achou, atualiza a falta para justificada
            UPDATE public.presencas
            SET falta_justificada = TRUE, presente = FALSE
            WHERE id = v_presenca_id;
        ELSE
            -- Se não havia registro de falta no banco pra esse dia ainda (ex: presenca gerada só no fim do dia),
            -- insere já como falta justificada
            INSERT INTO public.presencas (escola_id, aluno_id, turma_id, data_chamada, presente, falta_justificada)
            SELECT v_justificativa.escola_id, v_justificativa.aluno_id, a.turma_id, v_justificativa.data_falta, FALSE, TRUE
            FROM public.alunos a WHERE a.id = v_justificativa.aluno_id;
        END IF;
    END IF;

    -- 3. Se for RECUSADA, não mexe nas presenças (mantém a falta pura).

    -- 4. Atualiza o status do card no Kanban
    UPDATE public.whatsapp_justificativas
    SET status = p_novo_status,
        reviewer_id = p_reviewer_id,
        data_revisao = timezone('utc'::text, now())
    WHERE id = p_justificativa_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
