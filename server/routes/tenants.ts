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

    // Use RPC function to bypass PostgREST schema cache
    // This function handles transaction and rollback automatically
    const { data: result, error: rpcError } = await supabaseAdmin.rpc(
      'create_tenant_with_settings',
      {
        p_tenant_name: tenant_name,
        p_subdomain: subdomain,
        p_language: language || 'th',
        p_currency: currency || 'THB',
        p_default_visitor_fee: default_visitor_fee ? parseFloat(default_visitor_fee) : 650,
      }
    );

    if (rpcError) {
      // Check for duplicate subdomain error
      if (rpcError.message.includes('Subdomain already exists')) {
        return res.status(409).json({
          error: "Subdomain already exists",
          message: "This subdomain is already taken. Please choose another one."
        });
      }
      
      console.error('Error creating tenant via RPC:', rpcError);
      throw rpcError;
    }

    // Return success response
    res.json({
      success: true,
      tenant: {
        tenant_id: result.tenant_id,
        tenant_name: result.tenant_name,
        subdomain: result.subdomain,
      }
    });

  } catch (error: any) {
    console.error('Error creating tenant:', error);
    res.status(500).json({
      error: "Failed to create tenant",
      message: error.message
    });
  }
});

export default router;
