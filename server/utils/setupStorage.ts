import { supabaseAdmin } from "./supabaseClient";

/**
 * Setup Supabase Storage bucket for Rich Menu images
 * This should be run once during initial setup
 */
export async function setupRichMenuStorage() {
  const bucketName = "rich-menu-images";

  try {
    // Check if bucket already exists
    const { data: buckets } = await supabaseAdmin.storage.listBuckets();
    const bucketExists = buckets?.some((b) => b.name === bucketName);

    if (bucketExists) {
      console.log(`✅ Storage bucket '${bucketName}' already exists`);
      return { success: true, bucketName };
    }

    // Create bucket with public access
    const { data: bucket, error: createError } = await supabaseAdmin.storage.createBucket(
      bucketName,
      {
        public: true, // Images need to be publicly accessible for preview
        fileSizeLimit: 1048576, // 1MB limit (LINE requirement)
        allowedMimeTypes: ["image/png", "image/jpeg"],
      }
    );

    if (createError) {
      console.error("❌ Failed to create storage bucket:", createError);
      throw createError;
    }

    console.log(`✅ Created storage bucket '${bucketName}'`);

    // Set up public access policy
    const { error: policyError } = await supabaseAdmin.rpc("create_storage_policy", {
      bucket_name: bucketName,
      policy_name: "Public Access",
      definition: "true", // Allow all public access for SELECT
    });

    if (policyError) {
      console.warn("⚠️ Policy setup may need manual configuration:", policyError.message);
    }

    return { success: true, bucketName, created: true };
  } catch (error: any) {
    console.error("❌ Storage setup failed:", error);
    throw error;
  }
}

/**
 * Upload Rich Menu image to Supabase Storage
 * Returns the public URL of the uploaded image
 */
export async function uploadRichMenuImage(
  tenantId: string,
  richMenuId: string,
  imageBuffer: Buffer,
  contentType: string
): Promise<string> {
  const bucketName = "rich-menu-images";
  const fileName = `${tenantId}/${richMenuId}.${contentType === "image/png" ? "png" : "jpg"}`;

  const { data, error } = await supabaseAdmin.storage
    .from(bucketName)
    .upload(fileName, imageBuffer, {
      contentType,
      upsert: true, // Allow overwriting existing images
    });

  if (error) {
    console.error("Failed to upload image to storage:", error);
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  // Get public URL
  const { data: urlData } = supabaseAdmin.storage
    .from(bucketName)
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}

/**
 * Delete Rich Menu image from Supabase Storage
 */
export async function deleteRichMenuImage(imageUrl: string): Promise<void> {
  try {
    // Extract file path from URL
    const url = new URL(imageUrl);
    const pathParts = url.pathname.split("/");
    const bucketIndex = pathParts.indexOf("rich-menu-images");
    if (bucketIndex === -1) return;

    const filePath = pathParts.slice(bucketIndex + 1).join("/");

    const { error } = await supabaseAdmin.storage
      .from("rich-menu-images")
      .remove([filePath]);

    if (error) {
      console.warn("Failed to delete image from storage:", error);
    }
  } catch (error) {
    console.warn("Error deleting storage image:", error);
  }
}
