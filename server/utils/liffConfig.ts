import { supabaseAdmin } from "./supabaseClient";

interface LiffConfig {
  liffId: string | null;
  liffEnabled: boolean;
  environment: "development" | "production";
}

/**
 * Get LIFF configuration based on environment
 * 
 * Development mode (REPLIT_DEPLOYMENT !== "1"):
 *   - Uses LIFF_ID_DEV environment variable
 *   - Allows testing with Replit dev URL
 * 
 * Production mode (REPLIT_DEPLOYMENT === "1"):
 *   - Uses liff_id from system_settings table
 *   - Points to production domain (meetdup.com)
 */
export async function getLiffConfig(): Promise<LiffConfig> {
  const isProduction = process.env.REPLIT_DEPLOYMENT === "1" || process.env.NODE_ENV === "production";
  const environment = isProduction ? "production" : "development";

  if (!isProduction) {
    const devLiffId = process.env.LIFF_ID_DEV;
    
    if (devLiffId) {
      console.log("[LIFF Config] Using development LIFF ID");
      return {
        liffId: devLiffId,
        liffEnabled: true,
        environment: "development"
      };
    }
    
    console.log("[LIFF Config] No LIFF_ID_DEV set, falling back to production config");
  }

  try {
    const { data: settings, error } = await supabaseAdmin
      .from("system_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["liff_id", "liff_enabled"]);

    if (error || !settings) {
      console.log("[LIFF Config] Failed to fetch settings:", error);
      return { liffId: null, liffEnabled: false, environment };
    }

    const settingsMap: Record<string, string> = {};
    for (const s of settings) {
      settingsMap[s.setting_key] = s.setting_value || "";
    }

    const liffEnabled = settingsMap.liff_enabled === "true";
    const liffId = settingsMap.liff_id;

    console.log(`[LIFF Config] Using ${environment} LIFF ID from system_settings`);
    
    return {
      liffId: liffEnabled && liffId ? liffId : null,
      liffEnabled,
      environment
    };
  } catch (error) {
    console.error("[LIFF Config] Error:", error);
    return { liffId: null, liffEnabled: false, environment };
  }
}

/**
 * Get just the LIFF ID (for backwards compatibility)
 */
export async function getLiffId(): Promise<string | null> {
  const config = await getLiffConfig();
  return config.liffId;
}

/**
 * Get share button enabled setting from system_settings
 * Defaults to true if not set
 */
export async function getShareEnabled(): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin
      .from("system_settings")
      .select("setting_value")
      .eq("setting_key", "liff_share_enabled")
      .single();

    if (error || !data) {
      return true;
    }

    return data.setting_value !== "false";
  } catch (error) {
    console.error("[LIFF Config] Error getting share enabled:", error);
    return true;
  }
}

/**
 * Default share service URL - fallback if not configured
 */
const DEFAULT_SHARE_SERVICE_URL = "https://line-share-flex-api.lovable.app";

/**
 * Normalize URL by removing trailing slashes
 */
function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

/**
 * Get share service URL from system_settings
 * This is the external LINE Share Target Picker service URL
 * Configurable by Super Admin to allow changing the service without code changes
 * Returns URL without trailing slash to prevent double slashes when constructing paths
 */
export async function getShareServiceUrl(): Promise<string> {
  try {
    const { data, error } = await supabaseAdmin
      .from("system_settings")
      .select("setting_value")
      .eq("setting_key", "liff_share_service_url")
      .single();

    if (error || !data || !data.setting_value) {
      console.log("[LIFF Config] Using default share service URL");
      return DEFAULT_SHARE_SERVICE_URL;
    }

    // Normalize URL to remove trailing slashes
    const normalizedUrl = normalizeUrl(data.setting_value);
    console.log("[LIFF Config] Using configured share service URL:", normalizedUrl);
    return normalizedUrl;
  } catch (error) {
    console.error("[LIFF Config] Error getting share service URL:", error);
    return DEFAULT_SHARE_SERVICE_URL;
  }
}
