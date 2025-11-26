/**
 * Shared LINE Official Account Configuration
 * 
 * This module manages the shared LINE OA that all chapters use.
 * Instead of per-tenant LINE credentials, we use a single shared OA.
 * Tenant identification happens via user's participant record.
 * 
 * Config is stored in platform_config table for easy management via admin UI.
 */

import { supabaseAdmin } from "../../utils/supabaseClient";

export interface SharedLineConfig {
  channelAccessToken: string;
  channelSecret: string;
  channelId: string;
  liffId: string;
}

let cachedConfig: SharedLineConfig | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 60000; // 1 minute cache

/**
 * Get shared LINE OA configuration from database
 * Falls back to environment variables if database config not available
 */
export async function getSharedLineConfigAsync(): Promise<SharedLineConfig | null> {
  // Check cache
  if (cachedConfig && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedConfig;
  }

  try {
    // Try to read from database first
    const { data: configs, error } = await supabaseAdmin
      .from("platform_config")
      .select("key, value")
      .in("key", ["LINE_CHANNEL_ACCESS_TOKEN", "LINE_CHANNEL_SECRET", "LINE_CHANNEL_ID", "LIFF_ID"]);

    if (!error && configs && configs.length > 0) {
      const configMap: Record<string, string> = {};
      for (const c of configs) {
        if (c.value) {
          configMap[c.key] = c.value;
        }
      }

      const channelAccessToken = configMap["LINE_CHANNEL_ACCESS_TOKEN"];
      const channelSecret = configMap["LINE_CHANNEL_SECRET"];
      const channelId = configMap["LINE_CHANNEL_ID"];
      const liffId = configMap["LIFF_ID"];

      if (channelAccessToken && channelSecret && channelId) {
        cachedConfig = {
          channelAccessToken,
          channelSecret,
          channelId,
          liffId: liffId || "",
        };
        cacheTimestamp = Date.now();
        return cachedConfig;
      }
    }
  } catch (err) {
    console.warn("⚠️ Could not read LINE config from database, falling back to env vars");
  }

  // Fallback to environment variables
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  const channelId = process.env.LINE_CHANNEL_ID;
  const liffId = process.env.LIFF_ID;

  if (!channelAccessToken || !channelSecret || !channelId) {
    console.warn("⚠️ Shared LINE config not complete - missing credentials");
    return null;
  }

  cachedConfig = {
    channelAccessToken,
    channelSecret,
    channelId,
    liffId: liffId || "",
  };
  cacheTimestamp = Date.now();

  return cachedConfig;
}

/**
 * @deprecated Use getSharedLineConfigAsync() instead.
 * This synchronous version is deprecated and will be removed.
 * All LINE services should use the async database-backed function.
 */
export function getSharedLineConfig(): SharedLineConfig | null {
  console.warn("⚠️ DEPRECATED: getSharedLineConfig() is deprecated. Use getSharedLineConfigAsync() instead.");
  
  // Return cached if available (populated by async calls)
  if (cachedConfig && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedConfig;
  }

  // Return null to force callers to use async version
  // This prevents accidentally bypassing the database
  console.error("❌ getSharedLineConfig() called but no cache available. Use getSharedLineConfigAsync() instead.");
  return null;
}

/**
 * Save LINE config to database
 */
export async function saveSharedLineConfig(config: Partial<SharedLineConfig>): Promise<void> {
  const updates: { key: string; value: string; is_secret: boolean }[] = [];

  if (config.channelAccessToken !== undefined) {
    updates.push({ key: "LINE_CHANNEL_ACCESS_TOKEN", value: config.channelAccessToken, is_secret: true });
  }
  if (config.channelSecret !== undefined) {
    updates.push({ key: "LINE_CHANNEL_SECRET", value: config.channelSecret, is_secret: true });
  }
  if (config.channelId !== undefined) {
    updates.push({ key: "LINE_CHANNEL_ID", value: config.channelId, is_secret: false });
  }
  if (config.liffId !== undefined) {
    updates.push({ key: "LIFF_ID", value: config.liffId, is_secret: false });
  }

  for (const update of updates) {
    const { error } = await supabaseAdmin
      .from("platform_config")
      .upsert({
        key: update.key,
        value: update.value,
        is_secret: update.is_secret,
        updated_at: new Date().toISOString(),
      }, { onConflict: "key" });

    if (error) {
      throw new Error(`Failed to save config ${update.key}: ${error.message}`);
    }
  }

  // Clear cache to force reload
  clearConfigCache();
}

/**
 * Get config status for display (without exposing secrets)
 */
export async function getSharedLineConfigStatus(): Promise<{
  hasAccessToken: boolean;
  hasChannelSecret: boolean;
  hasChannelId: boolean;
  hasLiffId: boolean;
  channelId: string | null;
  liffId: string | null;
  accessTokenPreview: string | null;
  channelSecretPreview: string | null;
  source: "database" | "environment";
}> {
  // Try database first
  try {
    const { data: configs, error } = await supabaseAdmin
      .from("platform_config")
      .select("key, value")
      .in("key", ["LINE_CHANNEL_ACCESS_TOKEN", "LINE_CHANNEL_SECRET", "LINE_CHANNEL_ID", "LIFF_ID"]);

    if (!error && configs && configs.length > 0) {
      const configMap: Record<string, string> = {};
      for (const c of configs) {
        configMap[c.key] = c.value || "";
      }

      const accessToken = configMap["LINE_CHANNEL_ACCESS_TOKEN"];
      const secret = configMap["LINE_CHANNEL_SECRET"];
      const channelId = configMap["LINE_CHANNEL_ID"];
      const liffId = configMap["LIFF_ID"];

      return {
        hasAccessToken: !!accessToken,
        hasChannelSecret: !!secret,
        hasChannelId: !!channelId,
        hasLiffId: !!liffId,
        channelId: channelId || null,
        liffId: liffId || null,
        accessTokenPreview: accessToken ? "••••" + accessToken.slice(-4) : null,
        channelSecretPreview: secret ? "••••" + secret.slice(-4) : null,
        source: "database",
      };
    }
  } catch (err) {
    // Fall through to env vars
  }

  // Fallback to environment variables
  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const secret = process.env.LINE_CHANNEL_SECRET;
  const channelId = process.env.LINE_CHANNEL_ID;
  const liffId = process.env.LIFF_ID || process.env.VITE_LIFF_ID;

  return {
    hasAccessToken: !!accessToken,
    hasChannelSecret: !!secret,
    hasChannelId: !!channelId,
    hasLiffId: !!liffId,
    channelId: channelId || null,
    liffId: liffId || null,
    accessTokenPreview: accessToken ? "••••" + accessToken.slice(-4) : null,
    channelSecretPreview: secret ? "••••" + secret.slice(-4) : null,
    source: "environment",
  };
}

/**
 * Clear cached config (useful for testing or config reload)
 */
export function clearConfigCache(): void {
  cachedConfig = null;
  cacheTimestamp = 0;
}

/**
 * Find participant and tenant by LINE user ID
 * Returns participant info with tenant_id if found
 */
export async function findParticipantByLineUserId(lineUserId: string): Promise<{
  participant_id: string;
  tenant_id: string;
  full_name: string;
  nickname?: string | null;
  phone?: string | null;
  status: string;
} | null> {
  const { data, error } = await supabaseAdmin
    .from("participants")
    .select("id, tenant_id, full_name, nickname, phone, status")
    .eq("line_user_id", lineUserId)
    .eq("status", "active")
    .single();

  if (error || !data) {
    console.log(`[SharedConfig] No active participant found for LINE user: ${lineUserId}`);
    return null;
  }

  return {
    participant_id: data.id,
    tenant_id: data.tenant_id,
    full_name: data.full_name,
    nickname: data.nickname,
    phone: data.phone,
    status: data.status,
  };
}

/**
 * Get tenant info for branding
 */
export async function getTenantBranding(tenantId: string): Promise<{
  name: string;
  subdomain?: string;
  logo_url?: string;
  branding_color: string;
} | null> {
  const { data, error } = await supabaseAdmin
    .from("tenants")
    .select("name, subdomain, logo_url")
    .eq("id", tenantId)
    .single();

  if (error || !data) {
    return null;
  }

  // Get branding color from tenant_settings
  const { data: settings } = await supabaseAdmin
    .from("tenant_settings")
    .select("branding_color")
    .eq("tenant_id", tenantId)
    .single();

  return {
    name: data.name,
    subdomain: data.subdomain,
    logo_url: data.logo_url,
    branding_color: settings?.branding_color || "#1E3A5F",
  };
}

/**
 * Get rich menu ID for a tenant
 */
export async function getTenantRichMenuId(tenantId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("rich_menus")
    .select("line_rich_menu_id")
    .eq("tenant_id", tenantId)
    .eq("is_default", true)
    .single();

  if (error || !data) {
    return null;
  }

  return data.line_rich_menu_id;
}
