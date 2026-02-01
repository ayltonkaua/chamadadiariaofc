-- ============================================================================
-- Migration: 034_update_migracao_com_turno.sql
-- Purpose: Update migration RPC to support turno change
-- ============================================================================

-- Update executar_migracao_turmas to use novo_turno from JSON
CREATE OR REPLACE FUNCTION executar_migracao_turmas(
    p_escola_id uuid,
    p_ano_letivo_destino_id uuid,
    p_migracoes jsonb
    -- Format: [{"turma_origem_id": "uuid", "novo_nome": "7º Ano A", "novo_turno": "Tarde", "alunos_ids": ["uuid1", "uuid2"]}]
) RETURNS jsonb AS $$
DECLARE
    v_migracao jsonb;
    v_nova_turma_id uuid;
    v_turma_origem record;
    v_aluno_id uuid;
    v_turmas_criadas integer := 0;
    v_alunos_migrados integer := 0;
    v_user_id uuid;
    v_novo_turno text;
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
        
        -- Use novo_turno if provided, otherwise keep original
        v_novo_turno := COALESCE(v_migracao->>'novo_turno', v_turma_origem.turno::text);
        
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
            v_novo_turno::public.turno_enum,
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

COMMENT ON FUNCTION executar_migracao_turmas IS 'Executa a migração de turmas e alunos para novo ano letivo, com suporte a mudança de turno';
