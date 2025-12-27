-- ============================================================================
-- Migration: 025_add_sync_telemetry.sql
-- Purpose: Add observability for sync operations
-- ChamadaDiária v2.1.0
-- ============================================================================

-- ============================================================================
-- 1. SYNC METRICS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sync_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    escola_id UUID NOT NULL REFERENCES public.escola_configuracao(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    
    -- Event details
    event_type TEXT NOT NULL CHECK (event_type IN ('sync_start', 'sync_success', 'sync_error', 'sync_partial')),
    
    -- Performance metrics
    duration_ms INT,
    items_total INT,
    items_success INT,
    items_failed INT,
    
    -- Error details (if any)
    error_code TEXT,
    error_message TEXT,
    
    -- Client info
    client_version TEXT,
    client_platform TEXT,  -- 'web', 'android', 'ios'
    client_timestamp TIMESTAMPTZ,
    
    -- Server timestamp
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_metrics_escola_time 
    ON public.sync_metrics(escola_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sync_metrics_event_type 
    ON public.sync_metrics(event_type, created_at DESC);

COMMENT ON TABLE public.sync_metrics IS 
'Telemetry data for sync operations. Used for debugging and performance monitoring.';

-- ============================================================================
-- 2. RLS
-- ============================================================================

ALTER TABLE public.sync_metrics ENABLE ROW LEVEL SECURITY;

-- Users can read their own metrics
CREATE POLICY "sync_metrics_select_own" ON public.sync_metrics
    FOR SELECT USING (user_id = auth.uid());

-- Insert blocked directly, only via RPC
CREATE POLICY "sync_metrics_insert_rpc" ON public.sync_metrics
    FOR INSERT WITH CHECK (FALSE);

-- ============================================================================
-- 3. RPC: LOG SYNC METRICS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.log_sync_metrics(
    p_event_type TEXT,
    p_duration_ms INT DEFAULT NULL,
    p_items_total INT DEFAULT NULL,
    p_items_success INT DEFAULT NULL,
    p_items_failed INT DEFAULT NULL,
    p_error_code TEXT DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL,
    p_client_version TEXT DEFAULT NULL,
    p_client_platform TEXT DEFAULT NULL,
    p_client_timestamp TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_escola_id UUID;
BEGIN
    v_user_id := auth.uid();
    v_escola_id := get_user_escola_id();
    
    IF v_user_id IS NULL OR v_escola_id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'not_authenticated');
    END IF;

    INSERT INTO sync_metrics (
        escola_id,
        user_id,
        event_type,
        duration_ms,
        items_total,
        items_success,
        items_failed,
        error_code,
        error_message,
        client_version,
        client_platform,
        client_timestamp
    ) VALUES (
        v_escola_id,
        v_user_id,
        p_event_type,
        p_duration_ms,
        p_items_total,
        p_items_success,
        p_items_failed,
        p_error_code,
        p_error_message,
        p_client_version,
        p_client_platform,
        COALESCE(p_client_timestamp, NOW())
    );

    RETURN jsonb_build_object('success', TRUE);

EXCEPTION WHEN OTHERS THEN
    -- Don't fail the sync just because metrics logging failed
    RETURN jsonb_build_object('success', FALSE, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION public.log_sync_metrics IS 
'Logs sync metrics for observability. Failures are non-blocking.';

-- ============================================================================
-- 4. PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.log_sync_metrics TO authenticated;

-- ============================================================================
-- 5. CLEANUP OLD METRICS (keep 90 days)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_old_sync_metrics()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    DELETE FROM sync_metrics WHERE created_at < NOW() - INTERVAL '90 days';
$$;
