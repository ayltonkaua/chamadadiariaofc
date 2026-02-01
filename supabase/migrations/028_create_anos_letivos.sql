-- ============================================================================
-- Migration: 028_create_anos_letivos.sql
-- Purpose: Create academic year management table
-- ChamadaDiária v2.1.0
-- ============================================================================

-- ============================================================================
-- 1. CREATE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.anos_letivos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    escola_id uuid NOT NULL REFERENCES public.escola_configuracao(id) ON DELETE CASCADE,
    ano integer NOT NULL,
    nome text NOT NULL,
    data_inicio date NOT NULL,
    data_fim date NOT NULL,
    status text NOT NULL DEFAULT 'aberto' 
        CHECK (status IN ('planejamento', 'aberto', 'fechado')),
    criado_por uuid REFERENCES auth.users(id),
    fechado_por uuid REFERENCES auth.users(id),
    fechado_em timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT uq_escola_ano UNIQUE (escola_id, ano),
    CONSTRAINT chk_datas CHECK (data_fim > data_inicio)
);

-- ============================================================================
-- 2. INDEXES
-- ============================================================================

-- Only one open year per school
CREATE UNIQUE INDEX IF NOT EXISTS idx_unico_ano_aberto 
ON public.anos_letivos(escola_id) 
WHERE status = 'aberto';

-- Performance index
CREATE INDEX IF NOT EXISTS idx_anos_letivos_escola_status 
ON public.anos_letivos(escola_id, status);

-- ============================================================================
-- 3. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.anos_letivos ENABLE ROW LEVEL SECURITY;

-- Users can view years from their school
CREATE POLICY "Usuarios podem ver anos da sua escola"
ON public.anos_letivos FOR SELECT
USING (
    escola_id IN (
        SELECT ur.escola_id FROM public.user_roles ur 
        WHERE ur.user_id = auth.uid()
    )
);

-- Only diretor/secretario/admin can manage years
CREATE POLICY "Diretor_Secretario podem gerenciar anos"
ON public.anos_letivos FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() 
        AND ur.escola_id = anos_letivos.escola_id
        AND ur.role IN ('diretor', 'secretario', 'admin', 'super_admin')
    )
);

-- ============================================================================
-- 4. HELPER FUNCTIONS
-- ============================================================================

-- Get active year for a school
CREATE OR REPLACE FUNCTION get_ano_letivo_ativo(p_escola_id uuid)
RETURNS uuid AS $$
BEGIN
    RETURN (
        SELECT id FROM public.anos_letivos 
        WHERE escola_id = p_escola_id 
        AND status = 'aberto'
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Check if school has an active year
CREATE OR REPLACE FUNCTION has_ano_letivo_ativo(p_escola_id uuid)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.anos_letivos 
        WHERE escola_id = p_escola_id 
        AND status = 'aberto'
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================================
-- 5. COMMENTS
-- ============================================================================

COMMENT ON TABLE public.anos_letivos IS 'Gerenciamento de anos letivos por escola';
COMMENT ON COLUMN public.anos_letivos.status IS 'planejamento: em preparação, aberto: ativo, fechado: encerrado';
