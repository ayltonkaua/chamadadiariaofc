-- ============================================================================
-- Migration: 033_rpc_migrar_turmas.sql
-- Purpose: RPC functions for class migration to new academic year
-- ChamadaDiária v2.1.0
-- ============================================================================

-- ============================================================================
-- 1. GET TURMAS FOR MIGRATION (from closed year)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_turmas_para_migrar(
    p_escola_id uuid,
    p_ano_letivo_origem_id uuid
) RETURNS TABLE (
    turma_id uuid,
    turma_nome text,
    turma_numero_sala text,
    turma_turno text,
    total_alunos bigint,
    alunos_ativos bigint
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id as turma_id,
        t.nome as turma_nome,
        t.numero_sala as turma_numero_sala,
        t.turno::text as turma_turno,
        COUNT(a.id) as total_alunos,
        COUNT(a.id) FILTER (WHERE a.situacao = 'ativo' OR a.situacao = 'aprovado') as alunos_ativos
    FROM public.turmas t
    LEFT JOIN public.alunos a ON a.turma_id = t.id
    WHERE t.escola_id = p_escola_id
    AND t.ano_letivo_id = p_ano_letivo_origem_id
    GROUP BY t.id, t.nome, t.numero_sala, t.turno
    ORDER BY t.nome;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================================
-- 2. GET ALUNOS FROM TURMA FOR REVIEW
-- ============================================================================

CREATE OR REPLACE FUNCTION get_alunos_para_migrar(
    p_turma_id uuid
) RETURNS TABLE (
    aluno_id uuid,
    aluno_nome text,
    aluno_matricula text,
    situacao text,
    total_faltas bigint,
    frequencia_percentual numeric
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id as aluno_id,
        a.nome as aluno_nome,
        a.matricula as aluno_matricula,
        COALESCE(a.situacao, 'ativo') as situacao,
        (SELECT COUNT(*) FROM public.presencas p 
         WHERE p.aluno_id = a.id AND p.presente = false) as total_faltas,
        ROUND(
            (SELECT COUNT(*) FILTER (WHERE presente = true) * 100.0 / NULLIF(COUNT(*), 0)
             FROM public.presencas p WHERE p.aluno_id = a.id),
            1
        ) as frequencia_percentual
    FROM public.alunos a
    WHERE a.turma_id = p_turma_id
    ORDER BY a.nome;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================================
-- 3. EXECUTE MIGRATION
-- ============================================================================

CREATE OR REPLACE FUNCTION executar_migracao_turmas(
    p_escola_id uuid,
    p_ano_letivo_destino_id uuid,
    p_migracoes jsonb
    -- Format: [{"turma_origem_id": "uuid", "novo_nome": "7º Ano A", "alunos_ids": ["uuid1", "uuid2"]}]
) RETURNS jsonb AS $$
DECLARE
    v_migracao jsonb;
    v_nova_turma_id uuid;
    v_turma_origem record;
    v_aluno_id uuid;
    v_turmas_criadas integer := 0;
    v_alunos_migrados integer := 0;
    v_user_id uuid;
BEGIN
    v_user_id := auth.uid();
    
    -- Verify permission
    IF NOT EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = v_user_id 
        AND escola_id = p_escola_id
        AND role IN ('diretor', 'secretario', 'admin', 'super_admin')
    ) THEN
        RAISE EXCEPTION 'Permissão negada. Apenas Diretor ou Secretário podem migrar turmas.';
    END IF;
    
    -- Verify destination year is open
    IF NOT EXISTS (
        SELECT 1 FROM public.anos_letivos 
        WHERE id = p_ano_letivo_destino_id 
        AND status = 'aberto'
    ) THEN
        RAISE EXCEPTION 'O ano letivo de destino não está aberto.';
    END IF;
    
    -- Process each migration
    FOR v_migracao IN SELECT * FROM jsonb_array_elements(p_migracoes)
    LOOP
        -- Get source turma info
        SELECT * INTO v_turma_origem
        FROM public.turmas
        WHERE id = (v_migracao->>'turma_origem_id')::uuid;
        
        IF v_turma_origem IS NULL THEN
            CONTINUE;
        END IF;
        
        -- Create new turma
        INSERT INTO public.turmas (
            nome,
            numero_sala,
            turno,
            escola_id,
            ano_letivo_id,
            user_id
        ) VALUES (
            v_migracao->>'novo_nome',
            v_turma_origem.numero_sala,
            v_turma_origem.turno,
            p_escola_id,
            p_ano_letivo_destino_id,
            v_user_id
        ) RETURNING id INTO v_nova_turma_id;
        
        v_turmas_criadas := v_turmas_criadas + 1;
        
        -- Migrate selected students
        FOR v_aluno_id IN 
            SELECT (value)::uuid 
            FROM jsonb_array_elements_text(v_migracao->'alunos_ids')
        LOOP
            -- Update student's turma
            UPDATE public.alunos
            SET 
                turma_id = v_nova_turma_id,
                situacao = 'ativo',  -- Reset situation for new year
                dados_atualizados_em = now()
            WHERE id = v_aluno_id
            AND escola_id = p_escola_id;
            
            IF FOUND THEN
                v_alunos_migrados := v_alunos_migrados + 1;
                
                -- Log transfer
                INSERT INTO public.transferencias_alunos (
                    aluno_id,
                    turma_origem_id,
                    turma_destino_id,
                    motivo,
                    realizado_por,
                    escola_id
                ) VALUES (
                    v_aluno_id,
                    v_turma_origem.id,
                    v_nova_turma_id,
                    'Migração de ano letivo',
                    v_user_id,
                    p_escola_id
                );
            END IF;
        END LOOP;
    END LOOP;
    
    -- Audit log
    INSERT INTO public.audit_logs (action, user_email, details, type)
    VALUES (
        'MIGRACAO_TURMAS',
        (SELECT email FROM auth.users WHERE id = v_user_id),
        format('Migração concluída: %s turmas criadas, %s alunos migrados para ano letivo %s.',
               v_turmas_criadas, v_alunos_migrados, p_ano_letivo_destino_id),
        'success'
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'turmas_criadas', v_turmas_criadas,
        'alunos_migrados', v_alunos_migrados,
        'message', format('%s turmas criadas e %s alunos migrados com sucesso!', 
                         v_turmas_criadas, v_alunos_migrados)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. UPDATE STUDENT SITUATION
-- ============================================================================

CREATE OR REPLACE FUNCTION atualizar_situacao_aluno(
    p_aluno_id uuid,
    p_situacao text
) RETURNS boolean AS $$
BEGIN
    -- Validate situation
    IF p_situacao NOT IN ('ativo', 'aprovado', 'reprovado', 'transferido', 'abandono', 'falecido', 'cancelado') THEN
        RAISE EXCEPTION 'Situação inválida: %', p_situacao;
    END IF;
    
    UPDATE public.alunos
    SET situacao = p_situacao,
        dados_atualizados_em = now()
    WHERE id = p_aluno_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. COMMENTS
-- ============================================================================

COMMENT ON FUNCTION get_turmas_para_migrar IS 'Retorna turmas de um ano letivo com contagem de alunos';
COMMENT ON FUNCTION get_alunos_para_migrar IS 'Retorna alunos de uma turma com estatísticas para revisão';
COMMENT ON FUNCTION executar_migracao_turmas IS 'Executa a migração de turmas e alunos para novo ano letivo';
COMMENT ON FUNCTION atualizar_situacao_aluno IS 'Atualiza a situação de um aluno (aprovado, reprovado, etc)';
