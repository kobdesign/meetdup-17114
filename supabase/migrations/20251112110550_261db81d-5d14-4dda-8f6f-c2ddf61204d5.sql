-- Create RLS policies for tenant assets in avatars bucket

-- Allow Chapter Admin/Super Admin to upload tenant assets (logos, QR codes)
CREATE POLICY "Chapter admins can upload tenant assets"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' 
  AND (
    (storage.foldername(name))[1] = 'logos'
    OR (storage.foldername(name))[1] = 'qr-codes'
  )
  AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('chapter_admin', 'super_admin')
  )
);

-- Allow Chapter Admin/Super Admin to update tenant assets
CREATE POLICY "Chapter admins can update tenant assets"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' 
  AND (
    (storage.foldername(name))[1] = 'logos'
    OR (storage.foldername(name))[1] = 'qr-codes'
  )
  AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('chapter_admin', 'super_admin')
  )
)
WITH CHECK (
  bucket_id = 'avatars' 
  AND (
    (storage.foldername(name))[1] = 'logos'
    OR (storage.foldername(name))[1] = 'qr-codes'
  )
);

-- Allow Chapter Admin/Super Admin to delete tenant assets
CREATE POLICY "Chapter admins can delete tenant assets"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' 
  AND (
    (storage.foldername(name))[1] = 'logos'
    OR (storage.foldername(name))[1] = 'qr-codes'
  )
  AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('chapter_admin', 'super_admin')
  )
);