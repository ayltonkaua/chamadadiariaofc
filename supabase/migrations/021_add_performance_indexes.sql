-- ============================================================================
-- Migration: 021_add_performance_indexes.sql
-- Purpose: Add optimized indexes for common query patterns
-- ChamadaDiária v2.1.0
-- ============================================================================

-- ============================================================================
-- 1. PRESENCAS INDEXES
-- ============================================================================

-- Most common query: attendance by turma and date (for chamada lists)
CREATE INDEX IF NOT EXISTS idx_presencas_turma_data 
    ON presencas(turma_id, data_chamada);

-- Dashboard queries: escola + date range
CREATE INDEX IF NOT EXISTS idx_presencas_escola_data 
    ON presencas(escola_id, data_chamada);

-- Risk detection: faltas count by aluno
CREATE INDEX IF NOT EXISTS idx_presencas_aluno_presente 
    ON presencas(aluno_id, presente) WHERE presente = FALSE;

-- ============================================================================
-- 2. ALUNOS INDEXES
-- ============================================================================

-- Lookup by matricula (case-insensitive login)
CREATE INDEX IF NOT EXISTS idx_alunos_matricula_lower 
    ON alunos(LOWER(matricula));

-- Lookup by turma (chamada loading)
CREATE INDEX IF NOT EXISTS idx_alunos_turma_escola 
    ON alunos(turma_id, escola_id);

-- ============================================================================
-- 3. TURMAS INDEXES
-- ============================================================================

-- Lookup by escola (dashboard, turma lists)
CREATE INDEX IF NOT EXISTS idx_turmas_escola 
    ON turmas(escola_id);

-- ============================================================================
-- 4. ATESTADOS INDEXES
-- ============================================================================

-- Atestados vigentes query
CREATE INDEX IF NOT EXISTS idx_atestados_vigentes 
    ON atestados(escola_id, data_inicio, data_fim) 
    WHERE status = 'aprovado';

-- ============================================================================
-- 5. OBSERVACOES_ALUNOS INDEXES (nome correto da tabela)
-- ============================================================================

-- Lookup by aluno
CREATE INDEX IF NOT EXISTS idx_observacoes_alunos_aluno 
    ON observacoes_alunos(aluno_id, created_at DESC);

-- ============================================================================
-- ANALYZE TABLES
-- ============================================================================

ANALYZE presencas;
ANALYZE alunos;
ANALYZE turmas;
ANALYZE atestados;
