export interface BusinessCategory {
  code: string;
  name_th: string;
  name_en: string;
}

export const BUSINESS_CATEGORIES: BusinessCategory[] = [
  { code: "01", name_th: "อสังหาริมทรัพย์", name_en: "Real Estate" },
  { code: "02", name_th: "ไอที", name_en: "IT / Technology" },
  { code: "03", name_th: "อุปกรณ์อิเล็กทรอนิกส์และเครื่องมือสื่อสาร", name_en: "Electronics & Communications" },
  { code: "04", name_th: "การตลาด", name_en: "Marketing" },
  { code: "05", name_th: "อาหารและเครื่องดื่ม", name_en: "Food & Beverage" },
  { code: "06", name_th: "วัสดุก่อสร้าง", name_en: "Construction Materials" },
  { code: "07", name_th: "การเงินและการธนาคาร", name_en: "Finance & Banking" },
  { code: "08", name_th: "ประกันภัย", name_en: "Insurance" },
  { code: "09", name_th: "สุขภาพและความงาม", name_en: "Health & Beauty" },
  { code: "10", name_th: "การแพทย์", name_en: "Medical" },
  { code: "11", name_th: "การศึกษา", name_en: "Education" },
  { code: "12", name_th: "ท่องเที่ยวและโรงแรม", name_en: "Travel & Hospitality" },
  { code: "13", name_th: "ยานยนต์", name_en: "Automotive" },
  { code: "14", name_th: "กฎหมาย", name_en: "Legal" },
  { code: "15", name_th: "บัญชีและภาษี", name_en: "Accounting & Tax" },
  { code: "16", name_th: "โลจิสติกส์และขนส่ง", name_en: "Logistics & Transportation" },
  { code: "17", name_th: "สิ่งพิมพ์และสื่อ", name_en: "Printing & Media" },
  { code: "18", name_th: "ออกแบบและตกแต่งภายใน", name_en: "Design & Interior" },
  { code: "19", name_th: "เสื้อผ้าและแฟชั่น", name_en: "Fashion & Apparel" },
  { code: "20", name_th: "อัญมณีและเครื่องประดับ", name_en: "Jewelry & Accessories" },
  { code: "21", name_th: "บริการทำความสะอาด", name_en: "Cleaning Services" },
  { code: "22", name_th: "รักษาความปลอดภัย", name_en: "Security Services" },
  { code: "23", name_th: "การเกษตร", name_en: "Agriculture" },
  { code: "24", name_th: "พลังงาน", name_en: "Energy" },
  { code: "25", name_th: "อื่นๆ", name_en: "Others" },
];

export function getBusinessCategoryLabel(code: string | null | undefined): string {
  if (!code) return "";
  const category = BUSINESS_CATEGORIES.find(c => c.code === code);
  return category ? category.name_th : code;
}

export function getBusinessCategoryLabelEn(code: string | null | undefined): string {
  if (!code) return "";
  const category = BUSINESS_CATEGORIES.find(c => c.code === code);
  return category ? category.name_en : code;
}

export function isValidBusinessCategoryCode(code: string | null | undefined): boolean {
  if (!code) return false;
  return BUSINESS_CATEGORIES.some(c => c.code === code);
}
