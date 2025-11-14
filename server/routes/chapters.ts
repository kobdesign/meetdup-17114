import { Router } from "express";
import { supabaseAdmin } from "../utils/supabaseClient";
import { verifySupabaseAuth, AuthenticatedRequest } from "../utils/auth";

const router = Router();

// Create new chapter (user becomes admin)
router.post("/create", verifySupabaseAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { tenant_name, subdomain } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!tenant_name || !subdomain) {
      return res.status(400).json({ 
        error: "Missing required fields",
        message: "tenant_name และ subdomain จำเป็นต้องกรอก"
      });
    }

    // Check if subdomain already exists
    const { data: existingTenant } = await supabaseAdmin
      .from("tenants")
      .select("tenant_id")
      .eq("subdomain", subdomain)
      .single();

    if (existingTenant) {
      return res.status(400).json({ 
        error: "Subdomain already exists",
        message: "Subdomain นี้ถูกใช้งานแล้ว กรุณาเลือก subdomain อื่น"
      });
    }

    // Create tenant
    const { data: newTenant, error: tenantError } = await supabaseAdmin
      .from("tenants")
      .insert({
        tenant_name,
        subdomain,
      })
      .select()
      .single();

    if (tenantError) {
      console.error("Error creating tenant:", tenantError);
      return res.status(500).json({ 
        error: "Failed to create chapter",
        message: tenantError.message
      });
    }

    // Create user profile if not exists
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .single();

    if (!existingProfile) {
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .insert({
          id: userId,
        });

      if (profileError) {
        console.error("Error creating profile:", profileError);
        // Continue anyway as profile might already exist
      }
    }

    // Assign user as chapter_admin
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({
        user_id: userId,
        tenant_id: newTenant.tenant_id,
        role: "chapter_admin",
      });

    if (roleError) {
      console.error("Error assigning role:", roleError);
      // Rollback: delete tenant
      await supabaseAdmin
        .from("tenants")
        .delete()
        .eq("tenant_id", newTenant.tenant_id);

      return res.status(500).json({ 
        error: "Failed to assign admin role",
        message: roleError.message
      });
    }

    return res.status(201).json({
      success: true,
      tenant: newTenant,
      message: "สร้าง Chapter สำเร็จ!",
    });

  } catch (error: any) {
    console.error("Chapter creation error:", error);
    return res.status(500).json({ 
      error: "Internal server error",
      message: error.message
    });
  }
});

export default router;
