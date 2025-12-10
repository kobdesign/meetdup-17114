-- Migration: Enable Admin Management for Business Categories
-- Date: 2024-12-10
-- Purpose: Allow Super Admins to manage business categories via the admin UI

-- Ensure the business_categories table exists with all required columns
-- (The table should already exist from 20251127_create_business_categories.sql)

-- Step 1: Verify table exists, if not create it
CREATE TABLE IF NOT EXISTS business_categories (
  category_code VARCHAR(10) PRIMARY KEY,
  name_th VARCHAR(255) NOT NULL,
  name_en VARCHAR(255),
  description_th TEXT,
  description_en TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Insert default categories if table is empty
INSERT INTO business_categories (category_code, name_th, name_en, sort_order) 
SELECT * FROM (VALUES
  ('01', 'อสังหาริมทรัพย์', 'Real Estate', 1),
  ('02', 'ไอที', 'IT / Technology', 2),
  ('03', 'อุปกรณ์อิเล็กทรอนิกส์และเครื่องมือสื่อสาร', 'Electronics & Communications', 3),
  ('04', 'การตลาด', 'Marketing', 4),
  ('05', 'อาหารและเครื่องดื่ม', 'Food & Beverage', 5),
  ('06', 'วัสดุก่อสร้าง', 'Construction Materials', 6),
  ('07', 'การเงินและการธนาคาร', 'Finance & Banking', 7),
  ('08', 'ประกันภัย', 'Insurance', 8),
  ('09', 'สุขภาพและความงาม', 'Health & Beauty', 9),
  ('10', 'การแพทย์', 'Medical', 10),
  ('11', 'การศึกษา', 'Education', 11),
  ('12', 'ท่องเที่ยวและโรงแรม', 'Travel & Hospitality', 12),
  ('13', 'ยานยนต์', 'Automotive', 13),
  ('14', 'กฎหมาย', 'Legal', 14),
  ('15', 'บัญชีและภาษี', 'Accounting & Tax', 15),
  ('16', 'โลจิสติกส์และขนส่ง', 'Logistics & Transportation', 16),
  ('17', 'สิ่งพิมพ์และสื่อ', 'Printing & Media', 17),
  ('18', 'ออกแบบและตกแต่งภายใน', 'Design & Interior', 18),
  ('19', 'เสื้อผ้าและแฟชั่น', 'Fashion & Apparel', 19),
  ('20', 'อัญมณีและเครื่องประดับ', 'Jewelry & Accessories', 20),
  ('21', 'บริการทำความสะอาด', 'Cleaning Services', 21),
  ('22', 'รักษาความปลอดภัย', 'Security Services', 22),
  ('23', 'การเกษตร', 'Agriculture', 23),
  ('24', 'พลังงาน', 'Energy', 24),
  ('25', 'อื่นๆ', 'Others', 99)
) AS t(category_code, name_th, name_en, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM business_categories LIMIT 1)
ON CONFLICT (category_code) DO NOTHING;

-- Step 3: Create indexes if not exists
CREATE INDEX IF NOT EXISTS idx_business_categories_sort ON business_categories(sort_order);
CREATE INDEX IF NOT EXISTS idx_business_categories_active ON business_categories(is_active);

-- Step 4: Enable RLS
ALTER TABLE business_categories ENABLE ROW LEVEL SECURITY;

-- Step 5: Drop existing policies to recreate them
DROP POLICY IF EXISTS "Allow public read access to business_categories" ON business_categories;
DROP POLICY IF EXISTS "Allow super_admin to insert business_categories" ON business_categories;
DROP POLICY IF EXISTS "Allow super_admin to update business_categories" ON business_categories;
DROP POLICY IF EXISTS "Allow super_admin to delete business_categories" ON business_categories;

-- Step 6: Create RLS policies

-- Public read access (everyone can read active categories)
CREATE POLICY "Allow public read access to business_categories"
  ON business_categories
  FOR SELECT
  USING (true);

-- Super Admin can insert new categories
CREATE POLICY "Allow super_admin to insert business_categories"
  ON business_categories
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'super_admin'
    )
  );

-- Super Admin can update categories
CREATE POLICY "Allow super_admin to update business_categories"
  ON business_categories
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'super_admin'
    )
  );

-- Super Admin can delete categories
CREATE POLICY "Allow super_admin to delete business_categories"
  ON business_categories
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'super_admin'
    )
  );

-- NOTE: This migration should be run on Supabase Production via the SQL Editor
-- The backend uses supabaseAdmin (service role) which bypasses RLS
-- RLS policies are for direct database access via Supabase client
