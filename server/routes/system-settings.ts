import { Router, Request, Response } from "express";
import { supabaseAdmin } from "../utils/supabaseClient";
import { verifySupabaseAuth, AuthenticatedRequest } from "../utils/auth";

const router = Router();

interface SystemSetting {
  setting_key: string;
  setting_value: string | null;
  description: string | null;
}

router.get("/liff", verifySupabaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { data: userRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", req.user.id)
      .single();

    if (!userRole || userRole.role !== "super_admin") {
      return res.status(403).json({ error: "Super admin access required" });
    }

    const { data: settings, error } = await supabaseAdmin
      .from("system_settings")
      .select("setting_key, setting_value, description")
      .in("setting_key", ["liff_id", "liff_channel_id", "liff_enabled", "liff_share_enabled"]);

    if (error) {
      console.error("Error fetching LIFF settings:", error);
      return res.status(500).json({ error: "Failed to fetch settings" });
    }

    const settingsMap: Record<string, string> = {};
    for (const s of settings || []) {
      settingsMap[s.setting_key] = s.setting_value || "";
    }

    return res.json({
      liff_id: settingsMap.liff_id || "",
      liff_channel_id: settingsMap.liff_channel_id || "",
      liff_enabled: settingsMap.liff_enabled === "true",
      liff_share_enabled: settingsMap.liff_share_enabled !== "false"
    });
  } catch (error: any) {
    console.error("Error in getLiffSettings:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/liff", verifySupabaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { data: userRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", req.user.id)
      .single();

    if (!userRole || userRole.role !== "super_admin") {
      return res.status(403).json({ error: "Super admin access required" });
    }

    const { liff_id, liff_channel_id, liff_enabled } = req.body;

    if (liff_id !== undefined) {
      await supabaseAdmin
        .from("system_settings")
        .upsert({
          setting_key: "liff_id",
          setting_value: liff_id,
          updated_at: new Date().toISOString()
        }, { onConflict: "setting_key" });
    }

    if (liff_channel_id !== undefined) {
      await supabaseAdmin
        .from("system_settings")
        .upsert({
          setting_key: "liff_channel_id",
          setting_value: liff_channel_id,
          updated_at: new Date().toISOString()
        }, { onConflict: "setting_key" });
    }

    if (liff_enabled !== undefined) {
      await supabaseAdmin
        .from("system_settings")
        .upsert({
          setting_key: "liff_enabled",
          setting_value: liff_enabled ? "true" : "false",
          updated_at: new Date().toISOString()
        }, { onConflict: "setting_key" });
    }

    if (req.body.liff_share_enabled !== undefined) {
      await supabaseAdmin
        .from("system_settings")
        .upsert({
          setting_key: "liff_share_enabled",
          setting_value: req.body.liff_share_enabled ? "true" : "false",
          updated_at: new Date().toISOString()
        }, { onConflict: "setting_key" });
    }

    return res.json({ success: true, message: "LIFF settings updated" });
  } catch (error: any) {
    console.error("Error in updateLiffSettings:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
