-- RPC para evitar Race Conditions (Sobrescrita de mensagens)
-- ao atualizar o array JSONB `respostas` na tabela `whatsapp_atendimentos`.
CREATE OR REPLACE FUNCTION append_atendimento_resposta(
    p_ticket_id UUID,
    p_resposta JSONB,
    p_novo_status TEXT DEFAULT NULL
) 
RETURNS JSONB 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_respostas JSONB;
BEGIN
    UPDATE whatsapp_atendimentos
    SET respostas = COALESCE(respostas, '[]'::jsonb) || p_resposta,
        status = COALESCE(p_novo_status, status),
        updated_at = NOW()
    WHERE id = p_ticket_id
    RETURNING respostas INTO v_respostas;
    
    RETURN v_respostas;
END;
$$;
