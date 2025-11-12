import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import imageCompression from 'browser-image-compression';

export interface ImageUploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

// Configuration for image compression
const COMPRESSION_OPTIONS = {
  maxSizeMB: 1, // ลดขนาดไฟล์สูงสุดเหลือ 1MB
  maxWidthOrHeight: 1920, // ความกว้าง/สูงสูงสุด 1920px
  useWebWorker: true, // ใช้ Web Worker เพื่อไม่ให้ UI ค้าง
  fileType: 'image/jpeg' as const, // แปลงเป็น JPEG เพื่อขนาดไฟล์เล็กลง
};

/**
 * บีบอัดรูปภาพก่อนอัปโหลด
 */
async function compressImage(file: File): Promise<File> {
  try {
    console.log(`Original file size: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
    
    const compressedFile = await imageCompression(file, COMPRESSION_OPTIONS);
    
    console.log(`Compressed file size: ${(compressedFile.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Compression ratio: ${((1 - compressedFile.size / file.size) * 100).toFixed(1)}%`);
    
    return compressedFile;
  } catch (error) {
    console.error('Compression error:', error);
    // ถ้าบีบอัดไม่สำเร็จ ใช้ไฟล์ต้นฉบับ
    return file;
  }
}

/**
 * อัปโหลดรูปภาพไปที่ Supabase Storage และคืน public URL
 * รูปภาพจะถูกบีบอัดอัตโนมัติก่อนอัปโหลด
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

    // Validate file size (max 10MB before compression)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return {
        success: false,
        error: 'ขนาดไฟล์ต้องไม่เกิน 10MB'
      };
    }

    // Compress image automatically
    const compressedFile = await compressImage(file);

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
    const sanitizedFileName = compressedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `${user.id}/${timestamp}_${sanitizedFileName}`;

    // อัปโหลดไฟล์ที่ถูกบีบอัดแล้ว
    const { data, error } = await supabase.storage
      .from('meeting-images')
      .upload(filePath, compressedFile, {
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
