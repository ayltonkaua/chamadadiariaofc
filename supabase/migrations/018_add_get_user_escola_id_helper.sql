-- ============================================================================
-- Migration: 018_add_get_user_escola_id_helper.sql
-- Purpose: Create unified helper function for escola_id extraction
-- ChamadaDiária v2.1.0
-- 
-- This centralizes escola_id extraction logic to avoid duplication across RPCs
-- ============================================================================

-- ============================================================================
-- 1. HELPER FUNCTION: GET USER ESCOLA ID
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_user_escola_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_escola_id UUID;
BEGIN
    -- Get authenticated user ID
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Get escola_id from user_roles
    SELECT escola_id INTO v_escola_id
    FROM user_roles
    WHERE user_id = v_user_id
    LIMIT 1;
    
    RETURN v_escola_id;
END;
$$;

COMMENT ON FUNCTION public.get_user_escola_id IS 
'Returns the escola_id for the currently authenticated user. Use in RPCs to enforce school-level access control.';

-- ============================================================================
-- 2. HELPER FUNCTION: GET USER ESCOLA ID WITH VALIDATION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.require_user_escola_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_escola_id UUID;
BEGIN
    v_escola_id := get_user_escola_id();
    
    IF v_escola_id IS NULL THEN
        RAISE EXCEPTION 'User escola_id not found'
            USING ERRCODE = 'P0001';
    END IF;
    
    RETURN v_escola_id;
END;
$$;

COMMENT ON FUNCTION public.require_user_escola_id IS 
'Returns the escola_id for the currently authenticated user or throws exception if not found.';

-- ============================================================================
-- 3. GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.get_user_escola_id TO authenticated;
GRANT EXECUTE ON FUNCTION public.require_user_escola_id TO authenticated;

-- ============================================================================
-- 4. EXAMPLE: HOW TO USE IN RPCs
-- ============================================================================
-- 
-- BEFORE (duplicated in each RPC):
--   SELECT escola_id INTO v_escola_id
--   FROM user_roles WHERE user_id = auth.uid() LIMIT 1;
-- 
-- AFTER (one line):
--   v_escola_id := get_user_escola_id();
--   -- OR with validation:
--   v_escola_id := require_user_escola_id();
-- 
-- ============================================================================
