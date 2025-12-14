-- Migration: Fix turmas INSERT policy for ADMIN and add secure RPC
-- Esta migração corrige o problema de ADMIN não conseguir importar turmas

-- ==============================================================================
-- PARTE 1: POLICY ESPECÍFICA PARA ADMIN
-- ==============================================================================

-- Drop policy existente se houver conflito
DROP POLICY IF EXISTS "Admin pode inserir turmas" ON public.turmas;

-- Criar policy específica para ADMIN (permite inserção se for admin da mesma escola)
CREATE POLICY "Admin pode inserir turmas" ON public.turmas
    FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid()
            AND role = 'admin'
            AND escola_id = turmas.escola_id
        )
    );

-- Policy para ADMIN poder atualizar/deletar qualquer turma da escola
DROP POLICY IF EXISTS "Admin pode gerenciar turmas" ON public.turmas;

CREATE POLICY "Admin pode gerenciar turmas" ON public.turmas
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid()
            AND role = 'admin'
            AND escola_id = turmas.escola_id
        )
    );

-- ==============================================================================
-- PARTE 2: RPC SECURITY DEFINER (Alternativa mais segura)
-- ==============================================================================

-- Função para criar turma com validação de escola
CREATE OR REPLACE FUNCTION create_turma_for_escola(
    p_nome TEXT,
    p_numero_sala TEXT DEFAULT '',
    p_turno turno_enum DEFAULT NULL,
    p_escola_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_turma_id UUID;
    v_user_escola_id UUID;
    v_final_escola_id UUID;
BEGIN
    -- Se escola_id não foi passado, busca do user_roles
    IF p_escola_id IS NULL THEN
        SELECT escola_id INTO v_final_escola_id
        FROM user_roles
        WHERE user_id = auth.uid()
        LIMIT 1;
    ELSE
        v_final_escola_id := p_escola_id;
    END IF;
    
    -- Verificar se usuário pertence à escola
    SELECT escola_id INTO v_user_escola_id
    FROM user_roles
    WHERE user_id = auth.uid()
    AND escola_id = v_final_escola_id
    LIMIT 1;
    
    IF v_user_escola_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não pertence a esta escola';
    END IF;
    
    -- Validar nome
    IF p_nome IS NULL OR trim(p_nome) = '' THEN
        RAISE EXCEPTION 'Nome da turma é obrigatório';
    END IF;
    
    -- Inserir turma
    INSERT INTO turmas (nome, numero_sala, turno, escola_id, user_id)
    VALUES (trim(p_nome), COALESCE(p_numero_sala, ''), p_turno, v_final_escola_id, auth.uid())
    RETURNING id INTO v_turma_id;
    
    RETURN v_turma_id;
END;
$$;

-- Função para importar turma com alunos em batch
CREATE OR REPLACE FUNCTION import_turma_with_students(
    p_nome TEXT,
    p_numero_sala TEXT DEFAULT '',
    p_turno turno_enum DEFAULT NULL,
    p_escola_id UUID DEFAULT NULL,
    p_alunos JSONB DEFAULT '[]'::jsonb
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
    v_aluno JSONB;
    v_inseridos INT := 0;
    v_atualizados INT := 0;
    v_existente_id UUID;
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
    
    -- Criar turma
    INSERT INTO turmas (nome, numero_sala, turno, escola_id, user_id)
    VALUES (trim(p_nome), COALESCE(p_numero_sala, ''), p_turno, v_final_escola_id, auth.uid())
    RETURNING id INTO v_turma_id;
    
    -- Processar alunos
    FOR v_aluno IN SELECT * FROM jsonb_array_elements(p_alunos)
    LOOP
        -- Verificar se aluno já existe
        SELECT id INTO v_existente_id
        FROM alunos
        WHERE escola_id = v_final_escola_id
        AND matricula = v_aluno->>'matricula';
        
        IF v_existente_id IS NOT NULL THEN
            -- Atualizar existente
            UPDATE alunos 
            SET nome = v_aluno->>'nome', turma_id = v_turma_id
            WHERE id = v_existente_id;
            v_atualizados := v_atualizados + 1;
        ELSE
            -- Inserir novo
            INSERT INTO alunos (nome, matricula, turma_id, escola_id)
            VALUES (
                v_aluno->>'nome',
                v_aluno->>'matricula',
                v_turma_id,
                v_final_escola_id
            );
            v_inseridos := v_inseridos + 1;
        END IF;
    END LOOP;
    
    RETURN jsonb_build_object(
        'turma_id', v_turma_id,
        'inseridos', v_inseridos,
        'atualizados', v_atualizados
    );
END;
$$;

-- Comentários
COMMENT ON FUNCTION create_turma_for_escola IS 'Cria turma com validação de escola do usuário';
COMMENT ON FUNCTION import_turma_with_students IS 'Importa turma com alunos em batch';
