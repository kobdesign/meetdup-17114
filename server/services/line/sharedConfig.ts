/**
 * Shared LINE Official Account Configuration
 * 
 * This module manages the shared LINE OA that all chapters use.
 * Instead of per-tenant LINE credentials, we use a single shared OA.
 * Tenant identification happens via user's participant record.
 */

import { supabaseAdmin } from "../../utils/supabaseClient";

export interface SharedLineConfig {
  channelAccessToken: string;
  channelSecret: string;
  channelId: string;
  liffId: string;
}

let cachedConfig: SharedLineConfig | null = null;

/**
 * Get shared LINE OA configuration from environment variables
 */
export function getSharedLineConfig(): SharedLineConfig | null {
  if (cachedConfig) {
    return cachedConfig;
  }

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

  return cachedConfig;
}

/**
 * Clear cached config (useful for testing or config reload)
 */
export function clearConfigCache(): void {
  cachedConfig = null;
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
