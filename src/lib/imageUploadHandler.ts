import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ImageUploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * อัปโหลดรูปภาพไปที่ Supabase Storage และคืน public URL
 */
export async function uploadMeetingImage(file: File): Promise<ImageUploadResult> {
  try {
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return {
        success: false,
        error: 'รองรับเฉพาะไฟล์ JPG, PNG, GIF, WEBP เท่านั้น'
      };
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return {
        success: false,
        error: 'ขนาดไฟล์ต้องไม่เกิน 5MB'
      };
    }

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return {
        success: false,
        error: 'กรุณาเข้าสู่ระบบก่อน'
      };
    }

    // สร้างชื่อไฟล์ที่ unique: user_id/timestamp_filename
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `${user.id}/${timestamp}_${sanitizedFileName}`;

    // อัปโหลดไฟล์
    const { data, error } = await supabase.storage
      .from('meeting-images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Upload error:', error);
      return {
        success: false,
        error: 'เกิดข้อผิดพลาดในการอัปโหลด'
      };
    }

    // ดึง public URL
    const { data: { publicUrl } } = supabase.storage
      .from('meeting-images')
      .getPublicUrl(data.path);

    return {
      success: true,
      url: publicUrl
    };
  } catch (error) {
    console.error('Upload exception:', error);
    return {
      success: false,
      error: 'เกิดข้อผิดพลาดที่ไม่คาดคิด'
    };
  }
}
