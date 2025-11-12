-- สร้าง bucket สำหรับเก็บรูปภาพในเนื้อหาการประชุม
INSERT INTO storage.buckets (id, name, public)
VALUES ('meeting-images', 'meeting-images', true)
ON CONFLICT (id) DO NOTHING;

-- RLS Policy: อนุญาตให้ authenticated users อัปโหลดได้
CREATE POLICY "Authenticated users can upload meeting images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'meeting-images');

-- RLS Policy: ทุกคนสามารถดูรูปภาพได้
CREATE POLICY "Anyone can view meeting images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'meeting-images');

-- RLS Policy: authenticated users สามารถลบรูปภาพของตัวเองได้
CREATE POLICY "Authenticated users can delete their meeting images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'meeting-images' AND auth.uid()::text = (storage.foldername(name))[1]);