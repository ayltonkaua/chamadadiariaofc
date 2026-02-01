-- ============================================================================
-- Migration: 035_cascade_delete_turmas.sql
-- Purpose: Adicionar CASCADE DELETE para turmas e atualizar RPC de import
-- ============================================================================

-- ============================================================================
-- 0. ALTERAR FK DE TURMAS -> ANOS_LETIVOS PARA CASCADE
-- ============================================================================

-- Quando ano letivo for deletado, deletar turmas vinculadas (e CASCADE para alunos, etc)
ALTER TABLE public.turmas
    DROP CONSTRAINT IF EXISTS turmas_ano_letivo_id_fkey;
    
ALTER TABLE public.turmas
    ADD CONSTRAINT turmas_ano_letivo_id_fkey 
    FOREIGN KEY (ano_letivo_id) REFERENCES public.anos_letivos(id) ON DELETE CASCADE;

-- ============================================================================
-- 1. ALTERAR FOREIGN KEYS PARA CASCADE DELETE (TURMAS)
-- ============================================================================

-- Para ALUNOS: Quando turma for deletada, deletar alunos
ALTER TABLE public.alunos
    DROP CONSTRAINT IF EXISTS alunos_turma_id_fkey;
    
ALTER TABLE public.alunos
    ADD CONSTRAINT alunos_turma_id_fkey 
    FOREIGN KEY (turma_id) REFERENCES public.turmas(id) ON DELETE CASCADE;

-- Para PRESENCAS: Quando turma for deletada, deletar presenças
ALTER TABLE public.presencas
    DROP CONSTRAINT IF EXISTS presencas_turma_id_fkey;
    
ALTER TABLE public.presencas
    ADD CONSTRAINT presencas_turma_id_fkey 
    FOREIGN KEY (turma_id) REFERENCES public.turmas(id) ON DELETE CASCADE;

-- Para OBSERVACOES_ALUNOS: Quando turma for deletada, deletar observações
ALTER TABLE public.observacoes_alunos
    DROP CONSTRAINT IF EXISTS observacoes_alunos_turma_id_fkey;
    
ALTER TABLE public.observacoes_alunos
    ADD CONSTRAINT observacoes_alunos_turma_id_fkey 
    FOREIGN KEY (turma_id) REFERENCES public.turmas(id) ON DELETE CASCADE;

-- Para CHAMADAS_SYNC_LOG: Quando turma for deletada, deletar logs
ALTER TABLE public.chamadas_sync_log
    DROP CONSTRAINT IF EXISTS chamadas_sync_log_turma_id_fkey;
    
ALTER TABLE public.chamadas_sync_log
    ADD CONSTRAINT chamadas_sync_log_turma_id_fkey 
    FOREIGN KEY (turma_id) REFERENCES public.turmas(id) ON DELETE CASCADE;

-- Para GRADE_HORARIA: Quando turma for deletada, deletar grade
ALTER TABLE public.grade_horaria
    DROP CONSTRAINT IF EXISTS grade_horaria_turma_id_fkey;
    
ALTER TABLE public.grade_horaria
    ADD CONSTRAINT grade_horaria_turma_id_fkey 
    FOREIGN KEY (turma_id) REFERENCES public.turmas(id) ON DELETE CASCADE;

-- Para OBSERVACOES_SYNC_LOG
ALTER TABLE public.observacoes_sync_log
    DROP CONSTRAINT IF EXISTS observacoes_sync_log_turma_id_fkey;
    
ALTER TABLE public.observacoes_sync_log
    ADD CONSTRAINT observacoes_sync_log_turma_id_fkey 
    FOREIGN KEY (turma_id) REFERENCES public.turmas(id) ON DELETE CASCADE;

-- Para TRANSFERENCIAS_ALUNOS (origem)
ALTER TABLE public.transferencias_alunos
    DROP CONSTRAINT IF EXISTS transferencias_alunos_turma_origem_fkey;
    
ALTER TABLE public.transferencias_alunos
    ADD CONSTRAINT transferencias_alunos_turma_origem_fkey 
    FOREIGN KEY (turma_origem_id) REFERENCES public.turmas(id) ON DELETE CASCADE;

-- Para TRANSFERENCIAS_ALUNOS (destino)
ALTER TABLE public.transferencias_alunos
    DROP CONSTRAINT IF EXISTS transferencias_alunos_turma_destino_fkey;
    
ALTER TABLE public.transferencias_alunos
    ADD CONSTRAINT transferencias_alunos_turma_destino_fkey 
    FOREIGN KEY (turma_destino_id) REFERENCES public.turmas(id) ON DELETE CASCADE;

-- Para TURMA_PROFESSORES
ALTER TABLE public.turma_professores
    DROP CONSTRAINT IF EXISTS turma_professores_turma_id_fkey;
    
ALTER TABLE public.turma_professores
    ADD CONSTRAINT turma_professores_turma_id_fkey 
    FOREIGN KEY (turma_id) REFERENCES public.turmas(id) ON DELETE CASCADE;

-- ============================================================================
-- 1.5. ALTERAR FOREIGN KEYS DOS ALUNOS (PARA QUANDO ALUNO FOR DELETADO)
-- ============================================================================

-- ATESTADOS: Quando aluno for deletado, deletar atestados
ALTER TABLE public.atestados
    DROP CONSTRAINT IF EXISTS atestados_aluno_id_fkey;
    
ALTER TABLE public.atestados
    ADD CONSTRAINT atestados_aluno_id_fkey 
    FOREIGN KEY (aluno_id) REFERENCES public.alunos(id) ON DELETE CASCADE;

-- REGISTROS_ATRASOS: Quando aluno for deletado, deletar atrasos
ALTER TABLE public.registros_atrasos
    DROP CONSTRAINT IF EXISTS fk_aluno;
    
ALTER TABLE public.registros_atrasos
    ADD CONSTRAINT fk_aluno 
    FOREIGN KEY (aluno_id) REFERENCES public.alunos(id) ON DELETE CASCADE;

-- JUSTIFICATIVAS_FALTAS: Quando aluno for deletado, deletar justificativas
ALTER TABLE public.justificativas_faltas
    DROP CONSTRAINT IF EXISTS fk_aluno;
    
ALTER TABLE public.justificativas_faltas
    ADD CONSTRAINT fk_aluno 
    FOREIGN KEY (aluno_id) REFERENCES public.alunos(id) ON DELETE CASCADE;

-- NOTAS: Quando aluno for deletado, deletar notas
ALTER TABLE public.notas
    DROP CONSTRAINT IF EXISTS notas_aluno_id_fkey;
    
ALTER TABLE public.notas
    ADD CONSTRAINT notas_aluno_id_fkey 
    FOREIGN KEY (aluno_id) REFERENCES public.alunos(id) ON DELETE CASCADE;

-- PRESENCAS (por aluno): Quando aluno for deletado, deletar presenças
ALTER TABLE public.presencas
    DROP CONSTRAINT IF EXISTS presencas_aluno_id_fkey;
    
ALTER TABLE public.presencas
    ADD CONSTRAINT presencas_aluno_id_fkey 
    FOREIGN KEY (aluno_id) REFERENCES public.alunos(id) ON DELETE CASCADE;

-- OBSERVACOES_ALUNOS: Quando aluno for deletado, deletar observações
ALTER TABLE public.observacoes_alunos
    DROP CONSTRAINT IF EXISTS observacoes_alunos_aluno_id_fkey;
    
ALTER TABLE public.observacoes_alunos
    ADD CONSTRAINT observacoes_alunos_aluno_id_fkey 
    FOREIGN KEY (aluno_id) REFERENCES public.alunos(id) ON DELETE CASCADE;

-- TRANSFERENCIAS_ALUNOS (por aluno)
ALTER TABLE public.transferencias_alunos
    DROP CONSTRAINT IF EXISTS transferencias_alunos_aluno_id_fkey;
    
ALTER TABLE public.transferencias_alunos
    ADD CONSTRAINT transferencias_alunos_aluno_id_fkey 
    FOREIGN KEY (aluno_id) REFERENCES public.alunos(id) ON DELETE CASCADE;

-- OBSERVACOES_SYNC_LOG: Quando aluno for deletado
ALTER TABLE public.observacoes_sync_log
    DROP CONSTRAINT IF EXISTS observacoes_sync_log_aluno_id_fkey;
    
ALTER TABLE public.observacoes_sync_log
    ADD CONSTRAINT observacoes_sync_log_aluno_id_fkey 
    FOREIGN KEY (aluno_id) REFERENCES public.alunos(id) ON DELETE CASCADE;

-- PESQUISA_DESTINATARIOS (se existir): Quando aluno for deletado
ALTER TABLE IF EXISTS public.pesquisa_destinatarios
    DROP CONSTRAINT IF EXISTS pesquisa_destinatarios_aluno_id_fkey;
    
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pesquisa_destinatarios') THEN
        ALTER TABLE public.pesquisa_destinatarios
            ADD CONSTRAINT pesquisa_destinatarios_aluno_id_fkey 
            FOREIGN KEY (aluno_id) REFERENCES public.alunos(id) ON DELETE CASCADE;
    END IF;
END $$;

-- ============================================================================
-- 2. ATUALIZAR RPC IMPORT_TURMA_WITH_STUDENTS COM DATA NASCIMENTO
-- ============================================================================

-- Drop função antiga (especificando parâmetros para evitar ambiguidade)
DROP FUNCTION IF EXISTS import_turma_with_students(TEXT, TEXT, turno_enum, UUID, JSONB);
DROP FUNCTION IF EXISTS import_turma_with_students(TEXT, TEXT, TEXT, UUID, JSONB);
DROP FUNCTION IF EXISTS import_turma_with_students(TEXT, TEXT, TEXT, UUID, JSONB, UUID);

CREATE OR REPLACE FUNCTION import_turma_with_students(
    p_nome TEXT,
    p_numero_sala TEXT DEFAULT '',
    p_turno TEXT DEFAULT NULL,
    p_escola_id UUID DEFAULT NULL,
    p_alunos JSONB DEFAULT '[]'::jsonb,
    p_ano_letivo_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_turma_id UUID;
    v_user_escola_id UUID;
    v_final_escola_id UUID;
    v_final_ano_letivo_id UUID;
    v_aluno JSONB;
    v_inseridos INT := 0;
    v_atualizados INT := 0;
    v_existente_id UUID;
    v_data_nascimento DATE;
BEGIN
    -- Determinar escola_id
    IF p_escola_id IS NULL THEN
        SELECT escola_id INTO v_final_escola_id
        FROM user_roles WHERE user_id = auth.uid() LIMIT 1;
    ELSE
        v_final_escola_id := p_escola_id;
    END IF;
    
    -- Verificar permissão
    SELECT escola_id INTO v_user_escola_id
    FROM user_roles
    WHERE user_id = auth.uid() AND escola_id = v_final_escola_id
    LIMIT 1;
    
    IF v_user_escola_id IS NULL THEN
        RAISE EXCEPTION 'Sem permissão para esta escola';
    END IF;

    -- Determinar ano letivo (usar o ativo se não especificado)
    IF p_ano_letivo_id IS NULL THEN
        SELECT id INTO v_final_ano_letivo_id
        FROM anos_letivos
        WHERE escola_id = v_final_escola_id
        AND status = 'aberto'
        ORDER BY created_at DESC
        LIMIT 1;
        
        IF v_final_ano_letivo_id IS NULL THEN
            RAISE EXCEPTION 'Nenhum ano letivo aberto. Crie ou abra um ano letivo antes de importar turmas.';
        END IF;
    ELSE
        -- Verificar se o ano letivo existe e está aberto
        IF NOT EXISTS (
            SELECT 1 FROM anos_letivos 
            WHERE id = p_ano_letivo_id 
            AND escola_id = v_final_escola_id
            AND status = 'aberto'
        ) THEN
            RAISE EXCEPTION 'Ano letivo não encontrado ou não está aberto';
        END IF;
        v_final_ano_letivo_id := p_ano_letivo_id;
    END IF;
    
    -- Criar turma vinculada ao ano letivo
    INSERT INTO turmas (nome, numero_sala, turno, escola_id, user_id, ano_letivo_id)
    VALUES (
        trim(p_nome), 
        COALESCE(p_numero_sala, ''), 
        p_turno::turno_enum,  -- Cast para o enum
        v_final_escola_id, 
        auth.uid(), 
        v_final_ano_letivo_id
    )
    RETURNING id INTO v_turma_id;
    
    -- Processar alunos
    FOR v_aluno IN SELECT * FROM jsonb_array_elements(p_alunos)
    LOOP
        -- Parse data de nascimento (formato: YYYY-MM-DD ou DD/MM/YYYY)
        v_data_nascimento := NULL;
        BEGIN
            IF v_aluno->>'data_nascimento' IS NOT NULL AND v_aluno->>'data_nascimento' != '' THEN
                -- Tentar formato ISO primeiro (YYYY-MM-DD)
                v_data_nascimento := (v_aluno->>'data_nascimento')::DATE;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            -- Se falhar, tentar formato brasileiro (DD/MM/YYYY)
            BEGIN
                v_data_nascimento := TO_DATE(v_aluno->>'data_nascimento', 'DD/MM/YYYY');
            EXCEPTION WHEN OTHERS THEN
                v_data_nascimento := NULL;
            END;
        END;
        
        -- Verificar se aluno já existe na escola
        SELECT id INTO v_existente_id
        FROM alunos
        WHERE escola_id = v_final_escola_id
        AND LOWER(matricula) = LOWER(v_aluno->>'matricula');
        
        IF v_existente_id IS NOT NULL THEN
            -- Atualizar existente
            UPDATE alunos 
            SET nome = v_aluno->>'nome', 
                turma_id = v_turma_id,
                data_nascimento = COALESCE(v_data_nascimento, data_nascimento),
                situacao = 'ativo'
            WHERE id = v_existente_id;
            v_atualizados := v_atualizados + 1;
        ELSE
            -- Inserir novo
            INSERT INTO alunos (nome, matricula, turma_id, escola_id, data_nascimento, situacao)
            VALUES (
                v_aluno->>'nome',
                v_aluno->>'matricula',
                v_turma_id,
                v_final_escola_id,
                v_data_nascimento,
                'ativo'
            );
            v_inseridos := v_inseridos + 1;
        END IF;
    END LOOP;
    
    RETURN jsonb_build_object(
        'turma_id', v_turma_id,
        'ano_letivo_id', v_final_ano_letivo_id,
        'inseridos', v_inseridos,
        'atualizados', v_atualizados
    );
END;
$$;

COMMENT ON FUNCTION import_turma_with_students IS 
'Importa turma com alunos em batch. Requer ano letivo aberto. Suporta data_nascimento.';

-- ============================================================================
-- 3. RPC PARA DELETAR TURMA COM CONFIRMAÇÃO
-- ============================================================================

CREATE OR REPLACE FUNCTION delete_turma_cascade(
    p_turma_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_escola_id UUID;
    v_turma_nome TEXT;
    v_count_alunos INT;
    v_count_presencas INT;
    v_count_observacoes INT;
BEGIN
    -- Verificar permissão (deve ser admin/diretor/secretario da escola)
    SELECT t.escola_id, t.nome INTO v_escola_id, v_turma_nome
    FROM turmas t
    WHERE t.id = p_turma_id;
    
    IF v_escola_id IS NULL THEN
        RAISE EXCEPTION 'Turma não encontrada';
    END IF;
    
    -- Verificar se usuário tem permissão
    IF NOT EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = auth.uid()
        AND escola_id = v_escola_id
        AND role IN ('admin', 'diretor', 'secretario', 'super_admin')
    ) THEN
        RAISE EXCEPTION 'Sem permissão para deletar turmas';
    END IF;
    
    -- Contar registros que serão deletados
    SELECT COUNT(*) INTO v_count_alunos FROM alunos WHERE turma_id = p_turma_id;
    SELECT COUNT(*) INTO v_count_presencas FROM presencas WHERE turma_id = p_turma_id;
    SELECT COUNT(*) INTO v_count_observacoes FROM observacoes_alunos WHERE turma_id = p_turma_id;
    
    -- Deletar turma (CASCADE vai deletar o resto)
    DELETE FROM turmas WHERE id = p_turma_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'turma_nome', v_turma_nome,
        'deleted', jsonb_build_object(
            'alunos', v_count_alunos,
            'presencas', v_count_presencas,
            'observacoes', v_count_observacoes
        )
    );
END;
$$;

COMMENT ON FUNCTION delete_turma_cascade IS 
'Deleta turma e todos os dados relacionados (CASCADE). Retorna contagem de registros deletados.';

-- Grant permissions
GRANT EXECUTE ON FUNCTION delete_turma_cascade TO authenticated;
