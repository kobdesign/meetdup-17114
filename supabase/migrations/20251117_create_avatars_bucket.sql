-- Create avatars storage bucket for user profile photos and chapter logos
-- This bucket is used by:
-- 1. Profile.tsx - user avatar uploads
-- 2. Settings.tsx - chapter logo uploads
-- 3. Participants.tsx - participant photo uploads

-- Insert bucket into storage.buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,  -- Public bucket so images can be accessed via URL
  2097152,  -- 2MB file size limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Note: RLS is already enabled on storage.objects by Supabase
-- No need to ALTER TABLE storage.objects

-- Policy: Allow authenticated users to upload their own avatars
-- Path format: {user_id}/{filename} or logos/{filename}
DROP POLICY IF EXISTS "Users can upload their own avatars" ON storage.objects;
CREATE POLICY "Users can upload their own avatars"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND
  (
    -- Allow upload to user's own folder
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    -- Allow upload to logos folder (for chapter logos)
    (storage.foldername(name))[1] = 'logos'
  )
);

-- Policy: Allow authenticated users to update their own avatars
DROP POLICY IF EXISTS "Users can update their own avatars" ON storage.objects;
CREATE POLICY "Users can update their own avatars"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    (storage.foldername(name))[1] = 'logos'
  )
)
WITH CHECK (
  bucket_id = 'avatars' AND
  (
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    (storage.foldername(name))[1] = 'logos'
  )
);

-- Policy: Allow authenticated users to delete their own avatars
DROP POLICY IF EXISTS "Users can delete their own avatars" ON storage.objects;
CREATE POLICY "Users can delete their own avatars"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    (storage.foldername(name))[1] = 'logos'
  )
);

-- Policy: Allow public read access to all avatars
DROP POLICY IF EXISTS "Public can view all avatars" ON storage.objects;
CREATE POLICY "Public can view all avatars"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'avatars');
