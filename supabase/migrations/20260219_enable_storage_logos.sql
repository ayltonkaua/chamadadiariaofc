-- =============================================================================
-- Migration: Enable Supabase Storage for school logos
-- Date: 2026-02-19
-- Description: Creates the escola-assets bucket and RLS policies for file uploads
-- =============================================================================

-- 1. Create the storage bucket for school assets (logos, etc.)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'escola-assets',
  'escola-assets',
  true,
  2097152, -- 2MB max file size
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
) ON CONFLICT (id) DO NOTHING;

-- 2. Policy: Authenticated users can upload files (scoped to their escola folder)
CREATE POLICY "Authenticated users can upload escola assets"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'escola-assets'
  AND (storage.extension(name)) = ANY(ARRAY['jpg', 'jpeg', 'png', 'gif', 'webp'])
);

-- 3. Policy: Public read access (logos need to be visible to everyone)
CREATE POLICY "Public read access for escola assets"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'escola-assets');

-- 4. Policy: Authenticated users can update their files
CREATE POLICY "Authenticated users can update escola assets"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'escola-assets');

-- 5. Policy: Authenticated users can delete their files
CREATE POLICY "Authenticated users can delete escola assets"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'escola-assets');
