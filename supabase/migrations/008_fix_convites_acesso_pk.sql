-- Migration: Fix convites_acesso PK for multi-tenant support
-- Problem: email alone as PK prevents same email across different schools
-- Solution: Composite PK (email, escola_id) + status field + UPSERT support

-- ==============================================================================
-- PART 1: Add status column and new fields
-- ==============================================================================

-- Add status column for tracking invite state
ALTER TABLE public.convites_acesso 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'aceito', 'expirado'));

-- Add reenviado_em for tracking resends
ALTER TABLE public.convites_acesso 
ADD COLUMN IF NOT EXISTS reenviado_em TIMESTAMP WITH TIME ZONE;

-- Add invited_by for audit
ALTER TABLE public.convites_acesso 
ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES auth.users(id);

-- ==============================================================================
-- PART 2: Change PRIMARY KEY to composite (email, escola_id)
-- ==============================================================================

-- Drop the current PK constraint
ALTER TABLE public.convites_acesso 
DROP CONSTRAINT IF EXISTS convites_acesso_pkey;

-- Create new composite PK
ALTER TABLE public.convites_acesso 
ADD CONSTRAINT convites_acesso_pkey PRIMARY KEY (email, escola_id);

-- ==============================================================================
-- PART 3: Create index for lookups
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_convites_acesso_escola 
ON public.convites_acesso(escola_id);

CREATE INDEX IF NOT EXISTS idx_convites_acesso_status 
ON public.convites_acesso(status);

-- ==============================================================================
-- PART 4: RLS Policies (if not exists)
-- ==============================================================================

-- Enable RLS
ALTER TABLE public.convites_acesso ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate
DROP POLICY IF EXISTS "Usuarios podem ver convites de sua escola" ON public.convites_acesso;
DROP POLICY IF EXISTS "Usuarios podem criar convites em sua escola" ON public.convites_acesso;
DROP POLICY IF EXISTS "Usuarios podem atualizar convites de sua escola" ON public.convites_acesso;

-- Allow users to view invites from their school
CREATE POLICY "Usuarios podem ver convites de sua escola" ON public.convites_acesso
    FOR SELECT USING (
        escola_id IN (
            SELECT escola_id FROM public.user_roles WHERE user_id = auth.uid()
        )
    );

-- Allow users to insert invites to their school
CREATE POLICY "Usuarios podem criar convites em sua escola" ON public.convites_acesso
    FOR INSERT WITH CHECK (
        escola_id IN (
            SELECT escola_id FROM public.user_roles WHERE user_id = auth.uid()
        )
    );

-- Allow users to update invites in their school
CREATE POLICY "Usuarios podem atualizar convites de sua escola" ON public.convites_acesso
    FOR UPDATE USING (
        escola_id IN (
            SELECT escola_id FROM public.user_roles WHERE user_id = auth.uid()
        )
    );

-- ==============================================================================
-- PART 5: Comments
-- ==============================================================================

COMMENT ON TABLE public.convites_acesso IS 'Convites de acesso para membros da equipe, com suporte multi-tenant';
COMMENT ON COLUMN public.convites_acesso.status IS 'Status do convite: pendente, aceito, expirado';
COMMENT ON COLUMN public.convites_acesso.reenviado_em IS 'Data/hora do último reenvio do convite';
