import { Router } from "express";
import { supabaseAdmin } from "../utils/supabaseClient";
import { verifySupabaseAuth, AuthenticatedRequest } from "../utils/auth";

const router = Router();

// Create new tenant (bypasses PostgREST to avoid schema cache issues)
router.post("/create", verifySupabaseAuth, async (req: AuthenticatedRequest, res) => {
  try {
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

    // Create tenant settings using service role (bypasses PostgREST)
    const { error: settingsError } = await supabaseAdmin
      .from("tenant_settings")
      .insert({
        tenant_id: tenant.tenant_id,
        language: language || 'th',
        currency: currency || 'THB',
        default_visitor_fee: default_visitor_fee ? parseFloat(default_visitor_fee) : 650,
        require_visitor_payment: true,
      });

    if (settingsError) throw settingsError;

    res.json({
      success: true,
      tenant: {
        tenant_id: tenant.tenant_id,
        tenant_name: tenant.tenant_name,
        subdomain: tenant.subdomain,
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
