import { Router } from "express";
import { supabaseAdmin } from "../utils/supabaseClient";
import { verifySupabaseAuth, AuthenticatedRequest } from "../utils/auth";

const router = Router();

// Create new tenant (bypasses PostgREST to avoid schema cache issues)
// SUPER ADMIN ONLY
router.post("/create", verifySupabaseAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Verify user is super admin
    const { data: userRoles, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role, tenant_id")
      .eq("user_id", userId);

    if (roleError || !userRoles || userRoles.length === 0) {
      return res.status(403).json({ 
        error: "Forbidden",
        message: "You don't have permission to create tenants"
      });
    }

    const isSuperAdmin = userRoles.some(r => r.role === "super_admin" && !r.tenant_id);
    
    if (!isSuperAdmin) {
      return res.status(403).json({ 
        error: "Forbidden",
        message: "Only super admins can create new tenants"
      });
    }

    const { tenant_name, subdomain, language, currency, default_visitor_fee } = req.body;

    if (!tenant_name || !subdomain) {
      return res.status(400).json({ 
        error: "Missing required fields",
        message: "tenant_name and subdomain are required"
      });
    }

    // Validate subdomain format
    const subdomainRegex = /^[a-z0-9-]+$/;
    if (!subdomainRegex.test(subdomain)) {
      return res.status(400).json({ 
        error: "Invalid subdomain format",
        message: "Subdomain must contain only lowercase letters, numbers, and hyphens"
      });
    }

    // Use transaction to ensure atomicity
    let tenantId: string | null = null;

    try {
      // Create tenant using service role (bypasses PostgREST)
      const { data: tenant, error: tenantError } = await supabaseAdmin
        .from("tenants")
        .insert({
          tenant_name,
          subdomain,
        })
        .select()
        .single();

      if (tenantError) {
        // Check for unique constraint violation
        if (tenantError.code === '23505') {
          return res.status(409).json({
            error: "Subdomain already exists",
            message: "This subdomain is already taken. Please choose another one."
          });
        }
        throw tenantError;
      }

      tenantId = tenant.tenant_id;

      // Create tenant settings using service role (bypasses PostgREST)
      const { error: settingsError } = await supabaseAdmin
        .from("tenant_settings")
        .insert({
          tenant_id: tenantId,
          language: language || 'th',
          currency: currency || 'THB',
          default_visitor_fee: default_visitor_fee ? parseFloat(default_visitor_fee) : 650,
          require_visitor_payment: true,
        });

      if (settingsError) {
        // Rollback: delete tenant if settings creation failed
        const { error: deleteError } = await supabaseAdmin
          .from("tenants")
          .delete()
          .eq("tenant_id", tenantId);
        
        if (deleteError) {
          console.error('CRITICAL: Failed to rollback tenant after settings error:', {
            tenantId,
            settingsError: settingsError.message,
            deleteError: deleteError.message
          });
        }
        
        throw new Error(`Failed to create tenant settings: ${settingsError.message}`);
      }

      res.json({
        success: true,
        tenant: {
          tenant_id: tenant.tenant_id,
          tenant_name: tenant.tenant_name,
          subdomain: tenant.subdomain,
        }
      });

    } catch (txError: any) {
      // Ensure cleanup if anything goes wrong during transaction
      if (tenantId && !txError.message.includes('Failed to create tenant settings')) {
        // Only attempt cleanup if error is NOT from settings creation
        // (settings error already tried rollback above)
        const { error: cleanupError } = await supabaseAdmin
          .from("tenants")
          .delete()
          .eq("tenant_id", tenantId);
        
        if (cleanupError) {
          console.error('CRITICAL: Failed to cleanup tenant after error:', {
            tenantId,
            originalError: txError.message,
            cleanupError: cleanupError.message
          });
        }
      }
      throw txError;
    }

  } catch (error: any) {
    console.error('Error creating tenant:', error);
    res.status(500).json({
      error: "Failed to create tenant",
      message: error.message
    });
  }
});

export default router;
