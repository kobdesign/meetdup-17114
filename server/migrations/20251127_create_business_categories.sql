-- Create business_categories table (global, not tenant-specific)
-- These are standard BNI-style business categories

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

-- Insert standard business categories
INSERT INTO business_categories (category_code, name_th, name_en, sort_order) VALUES
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
ON CONFLICT (category_code) DO NOTHING;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_business_categories_sort ON business_categories(sort_order);
CREATE INDEX IF NOT EXISTS idx_business_categories_active ON business_categories(is_active);

-- Add RLS policy (public read access)
ALTER TABLE business_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to business_categories"
  ON business_categories
  FOR SELECT
  USING (true);
