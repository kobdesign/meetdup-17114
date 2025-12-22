import { Router } from "express";
import { supabaseAdmin } from "../utils/supabaseClient";
import { verifySupabaseAuth, AuthenticatedRequest } from "../utils/auth";

const router = Router();

// Get all available apps
router.get("/", verifySupabaseAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { data: apps, error } = await supabaseAdmin
      .from("apps")
      .select("*")
      .eq("is_active", true)
      .order("name");

    if (error) {
      console.error("Error fetching apps:", error);
      return res.status(500).json({ error: "Failed to fetch apps" });
    }

    res.json(apps || []);
  } catch (error) {
    console.error("Error in GET /apps:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get apps for a specific chapter with enabled status
router.get("/chapter/:tenantId", verifySupabaseAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { tenantId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Check if user is super admin (can access any chapter)
    const { data: superAdminRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "super_admin")
      .limit(1);

    const isSuperAdmin = superAdminRoles && superAdminRoles.length > 0;

    // If not super admin, verify user has access to this specific chapter
    if (!isSuperAdmin) {
      const { data: userRole } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (!userRole) {
        return res.status(403).json({ error: "Access denied to this chapter" });
      }
    }

    // Get all active apps with their enabled status for this chapter
    const { data: apps, error: appsError } = await supabaseAdmin
      .from("apps")
      .select("*")
      .eq("is_active", true)
      .order("name");

    if (appsError) {
      console.error("Error fetching apps:", appsError);
      return res.status(500).json({ error: "Failed to fetch apps" });
    }

    // Get chapter app settings
    const { data: chapterApps, error: chapterAppsError } = await supabaseAdmin
      .from("chapter_apps")
      .select("*")
      .eq("tenant_id", tenantId);

    if (chapterAppsError) {
      console.error("Error fetching chapter apps:", chapterAppsError);
      return res.status(500).json({ error: "Failed to fetch chapter apps" });
    }

    // Merge apps with their chapter-specific status
    const appsWithStatus = (apps || []).map(app => {
      const chapterApp = chapterApps?.find(ca => ca.app_id === app.app_id);
      return {
        ...app,
        is_enabled: chapterApp?.is_enabled || false,
        enabled_at: chapterApp?.enabled_at || null,
        enabled_by: chapterApp?.enabled_by || null
      };
    });

    res.json(appsWithStatus);
  } catch (error) {
    console.error("Error in GET /apps/chapter/:tenantId:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get only enabled apps for a chapter (for member view)
router.get("/chapter/:tenantId/enabled", verifySupabaseAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { tenantId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Check if user is super admin (can access any chapter)
    const { data: superAdminRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "super_admin")
      .limit(1);

    const isSuperAdmin = superAdminRoles && superAdminRoles.length > 0;

    // If not super admin, verify user has access to this specific chapter
    if (!isSuperAdmin) {
      const { data: userRole } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (!userRole) {
        return res.status(403).json({ error: "Access denied to this chapter" });
      }
    }

    // Get enabled apps for this chapter
    const { data: enabledApps, error } = await supabaseAdmin
      .from("chapter_apps")
      .select(`
        app_id,
        is_enabled,
        apps (
          app_id,
          name,
          description,
          icon,
          route,
          category
        )
      `)
      .eq("tenant_id", tenantId)
      .eq("is_enabled", true);

    if (error) {
      console.error("Error fetching enabled apps:", error);
      return res.status(500).json({ error: "Failed to fetch enabled apps" });
    }

    // Flatten the result
    const apps = (enabledApps || [])
      .filter(ea => ea.apps)
      .map(ea => ea.apps);

    res.json(apps);
  } catch (error) {
    console.error("Error in GET /apps/chapter/:tenantId/enabled:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Enable an app for a chapter
router.post("/chapter/:tenantId/:appId/enable", verifySupabaseAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { tenantId, appId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Check if user is super admin (can manage any chapter)
    const { data: superAdminRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "super_admin")
      .limit(1);

    const isSuperAdmin = superAdminRoles && superAdminRoles.length > 0;

    // If not super admin, verify user is chapter admin for this specific chapter
    if (!isSuperAdmin) {
      const { data: userRole } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("tenant_id", tenantId)
        .eq("role", "chapter_admin")
        .maybeSingle();

      if (!userRole) {
        return res.status(403).json({ error: "Admin access required" });
      }
    }

    // Verify app exists
    const { data: app } = await supabaseAdmin
      .from("apps")
      .select("app_id")
      .eq("app_id", appId)
      .eq("is_active", true)
      .single();

    if (!app) {
      return res.status(404).json({ error: "App not found" });
    }

    // Upsert chapter_apps record
    const { data, error } = await supabaseAdmin
      .from("chapter_apps")
      .upsert({
        tenant_id: tenantId,
        app_id: appId,
        is_enabled: true,
        enabled_at: new Date().toISOString(),
        enabled_by: userId,
        updated_at: new Date().toISOString()
      }, {
        onConflict: "tenant_id,app_id"
      })
      .select()
      .single();

    if (error) {
      console.error("Error enabling app:", error);
      return res.status(500).json({ error: "Failed to enable app" });
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error("Error in POST /apps/chapter/:tenantId/:appId/enable:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Disable an app for a chapter
router.post("/chapter/:tenantId/:appId/disable", verifySupabaseAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { tenantId, appId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Check if user is super admin (can manage any chapter)
    const { data: superAdminRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "super_admin")
      .limit(1);

    const isSuperAdmin = superAdminRoles && superAdminRoles.length > 0;

    // If not super admin, verify user is chapter admin for this specific chapter
    if (!isSuperAdmin) {
      const { data: userRole } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("tenant_id", tenantId)
        .eq("role", "chapter_admin")
        .maybeSingle();

      if (!userRole) {
        return res.status(403).json({ error: "Admin access required" });
      }
    }

    // Update chapter_apps record
    const { data, error } = await supabaseAdmin
      .from("chapter_apps")
      .upsert({
        tenant_id: tenantId,
        app_id: appId,
        is_enabled: false,
        updated_at: new Date().toISOString()
      }, {
        onConflict: "tenant_id,app_id"
      })
      .select()
      .single();

    if (error) {
      console.error("Error disabling app:", error);
      return res.status(500).json({ error: "Failed to disable app" });
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error("Error in POST /apps/chapter/:tenantId/:appId/disable:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
