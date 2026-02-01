-- ============================================================================
-- Migration: 030_migrate_dados_ano_letivo.sql
-- Purpose: RPC to migrate existing data to academic year
-- ChamadaDiária v2.1.0
-- ============================================================================

-- ============================================================================
-- 1. MIGRATION FUNCTION
-- ============================================================================

-- Creates a new academic year and links all orphan classes to it
CREATE OR REPLACE FUNCTION migrar_para_ano_letivo(
    p_escola_id uuid,
    p_ano integer,
    p_nome text,
    p_data_inicio date,
    p_data_fim date
) RETURNS jsonb AS $$
DECLARE
    v_ano_id uuid;
    v_turmas_count integer;
    v_user_id uuid;
    v_user_email text;
BEGIN
    -- Get current user
    v_user_id := auth.uid();
    
    -- Verify permission
    IF NOT EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = v_user_id 
        AND escola_id = p_escola_id
        AND role IN ('diretor', 'secretario', 'admin', 'super_admin')
    ) THEN
        RAISE EXCEPTION 'Permissão negada. Apenas Diretor ou Secretário podem migrar dados.';
    END IF;
    
    -- Check if year already exists
    IF EXISTS (
        SELECT 1 FROM public.anos_letivos 
        WHERE escola_id = p_escola_id AND ano = p_ano
    ) THEN
        RAISE EXCEPTION 'Já existe um ano letivo % para esta escola.', p_ano;
    END IF;
    
    -- Create academic year
    INSERT INTO public.anos_letivos (
        escola_id, ano, nome, data_inicio, data_fim, 
        status, criado_por
    ) VALUES (
        p_escola_id, p_ano, p_nome, p_data_inicio, p_data_fim,
        'aberto', v_user_id
    ) RETURNING id INTO v_ano_id;
    
    -- Link all orphan classes to the new year
    UPDATE public.turmas 
    SET ano_letivo_id = v_ano_id
    WHERE escola_id = p_escola_id 
    AND ano_letivo_id IS NULL;
    
    GET DIAGNOSTICS v_turmas_count = ROW_COUNT;
    
    -- Get user email for audit
    SELECT email INTO v_user_email 
    FROM auth.users WHERE id = v_user_id;
    
    -- Audit log
    INSERT INTO public.audit_logs (action, user_email, details, type)
    VALUES (
        'MIGRACAO_ANO_LETIVO',
        v_user_email,
        format('Ano letivo "%s" (%s) criado. %s turmas migradas para escola %s.', 
               p_nome, p_ano, v_turmas_count, p_escola_id),
        'success'
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'ano_letivo_id', v_ano_id,
        'turmas_migradas', v_turmas_count,
        'message', format('%s turmas foram vinculadas ao ano letivo %s.', v_turmas_count, p_ano)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 2. CLOSE YEAR FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION fechar_ano_letivo(
    p_ano_letivo_id uuid
) RETURNS jsonb AS $$
DECLARE
    v_escola_id uuid;
    v_user_id uuid;
    v_ano integer;
BEGIN
    v_user_id := auth.uid();
    
    -- Get escola_id and ano
    SELECT escola_id, ano INTO v_escola_id, v_ano
    FROM public.anos_letivos 
    WHERE id = p_ano_letivo_id;
    
    IF v_escola_id IS NULL THEN
        RAISE EXCEPTION 'Ano letivo não encontrado.';
    END IF;
    
    -- Verify permission
    IF NOT EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = v_user_id 
        AND escola_id = v_escola_id
        AND role IN ('diretor', 'secretario', 'admin', 'super_admin')
    ) THEN
        RAISE EXCEPTION 'Permissão negada. Apenas Diretor ou Secretário podem fechar o ano.';
    END IF;
    
    -- Close the year
    UPDATE public.anos_letivos 
    SET 
        status = 'fechado',
        fechado_por = v_user_id,
        fechado_em = now(),
        updated_at = now()
    WHERE id = p_ano_letivo_id;
    
    -- Audit log
    INSERT INTO public.audit_logs (action, user_email, details, type)
    VALUES (
        'FECHAMENTO_ANO_LETIVO',
        (SELECT email FROM auth.users WHERE id = v_user_id),
        format('Ano letivo %s fechado para escola %s.', v_ano, v_escola_id),
        'success'
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'message', format('Ano letivo %s foi encerrado com sucesso.', v_ano)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 3. GET ANOS LETIVOS WITH STATS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_anos_letivos_com_stats(p_escola_id uuid)
RETURNS TABLE (
    id uuid,
    ano integer,
    nome text,
    data_inicio date,
    data_fim date,
    status text,
    created_at timestamptz,
    total_turmas bigint,
    total_alunos bigint
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        al.id,
        al.ano,
        al.nome,
        al.data_inicio,
        al.data_fim,
        al.status,
        al.created_at,
        (SELECT COUNT(*) FROM public.turmas t WHERE t.ano_letivo_id = al.id) as total_turmas,
        (SELECT COUNT(*) FROM public.alunos a 
         JOIN public.turmas t ON a.turma_id = t.id 
         WHERE t.ano_letivo_id = al.id) as total_alunos
    FROM public.anos_letivos al
    WHERE al.escola_id = p_escola_id
    ORDER BY al.ano DESC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
