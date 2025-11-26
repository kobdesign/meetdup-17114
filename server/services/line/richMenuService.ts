/**
 * Rich Menu Service for Shared LINE OA
 * 
 * Manages per-user rich menu assignment based on their chapter/tenant.
 */

import { supabaseAdmin } from "../../utils/supabaseClient";
import { LineClient } from "./lineClient";
import { getSharedLineConfig } from "./sharedConfig";

/**
 * Link a user to their chapter's default rich menu
 */
export async function linkUserToChapterRichMenu(
  lineUserId: string,
  tenantId: string
): Promise<{ success: boolean; richMenuId?: string; error?: string }> {
  const config = getSharedLineConfig();
  
  if (!config) {
    return { success: false, error: "Shared LINE config not available" };
  }

  try {
    // Get the chapter's default rich menu
    const { data: richMenu, error } = await supabaseAdmin
      .from("rich_menus")
      .select("line_rich_menu_id")
      .eq("tenant_id", tenantId)
      .eq("is_default", true)
      .single();

    if (error || !richMenu?.line_rich_menu_id) {
      console.log(`[RichMenuService] No default rich menu found for tenant ${tenantId}`);
      return { success: false, error: "No default rich menu configured for this chapter" };
    }

    const lineClient = new LineClient(config.channelAccessToken);
    await lineClient.linkRichMenuToUser(lineUserId, richMenu.line_rich_menu_id);

    console.log(`[RichMenuService] Linked rich menu ${richMenu.line_rich_menu_id} to user ${lineUserId}`);
    
    return { success: true, richMenuId: richMenu.line_rich_menu_id };
  } catch (err: any) {
    console.error(`[RichMenuService] Failed to link rich menu:`, err);
    return { success: false, error: err.message };
  }
}

/**
 * Unlink rich menu from a user (when they leave a chapter)
 */
export async function unlinkUserRichMenu(
  lineUserId: string
): Promise<{ success: boolean; error?: string }> {
  const config = getSharedLineConfig();
  
  if (!config) {
    return { success: false, error: "Shared LINE config not available" };
  }

  try {
    const lineClient = new LineClient(config.channelAccessToken);
    await lineClient.unlinkRichMenuFromUser(lineUserId);

    console.log(`[RichMenuService] Unlinked rich menu from user ${lineUserId}`);
    
    return { success: true };
  } catch (err: any) {
    console.error(`[RichMenuService] Failed to unlink rich menu:`, err);
    return { success: false, error: err.message };
  }
}

/**
 * Update rich menu for all users in a chapter
 * (Used when the default rich menu changes)
 */
export async function updateChapterUsersRichMenu(
  tenantId: string,
  newRichMenuId: string
): Promise<{ success: boolean; updated: number; failed: number }> {
  const config = getSharedLineConfig();
  
  if (!config) {
    return { success: false, updated: 0, failed: 0 };
  }

  try {
    // Get all active participants with LINE user IDs
    const { data: participants, error } = await supabaseAdmin
      .from("participants")
      .select("line_user_id")
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .not("line_user_id", "is", null);

    if (error || !participants) {
      console.error(`[RichMenuService] Failed to get participants:`, error);
      return { success: false, updated: 0, failed: 0 };
    }

    const lineClient = new LineClient(config.channelAccessToken);
    let updated = 0;
    let failed = 0;

    for (const participant of participants) {
      if (participant.line_user_id) {
        try {
          await lineClient.linkRichMenuToUser(participant.line_user_id, newRichMenuId);
          updated++;
        } catch (err) {
          console.error(`[RichMenuService] Failed to update for user ${participant.line_user_id}:`, err);
          failed++;
        }
      }
    }

    console.log(`[RichMenuService] Updated ${updated} users, ${failed} failed for tenant ${tenantId}`);
    
    return { success: true, updated, failed };
  } catch (err: any) {
    console.error(`[RichMenuService] Batch update failed:`, err);
    return { success: false, updated: 0, failed: 0 };
  }
}

/**
 * Get the LINE user's current rich menu
 */
export async function getUserRichMenu(
  lineUserId: string
): Promise<string | null> {
  const config = getSharedLineConfig();
  
  if (!config) {
    return null;
  }

  try {
    const lineClient = new LineClient(config.channelAccessToken);
    return await lineClient.getRichMenuIdOfUser(lineUserId);
  } catch (err) {
    console.error(`[RichMenuService] Failed to get user's rich menu:`, err);
    return null;
  }
}
