import { Router, Response } from "express";
import { z } from "zod";
import { AuthenticatedRequest, verifySupabaseAuth } from "../../utils/auth";
import { supabaseAdmin } from "../../utils/supabaseClient";
import { 
  getAllCommandPermissionsList, 
  clearPermissionCache,
  CommandAccessLevel 
} from "../../services/line/commandAuthorization";

const KNOWN_COMMAND_KEYS = [
  'goals_summary',
  'business_card_search', 
  'category_search',
  'checkin',
  'link_phone'
] as const;

const permissionUpdateSchema = z.object({
  command_key: z.enum(KNOWN_COMMAND_KEYS),
  access_level: z.enum(['public', 'member', 'admin']).optional(),
  allow_group: z.boolean().optional()
}).refine(
  data => data.access_level !== undefined || data.allow_group !== undefined,
  { message: "At least one of access_level or allow_group must be provided" }
);

const updatePermissionsBodySchema = z.object({
  tenant_id: z.string().uuid(),
  permissions: z.array(permissionUpdateSchema).min(1)
});

const router = Router();

async function checkTenantAccess(userId: string, tenantId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("tenant_id", tenantId)
    .in("role", ["super_admin", "chapter_admin"])
    .single();

  if (data) return true;

  const { data: superAdmin } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .single();

  return !!superAdmin;
}

router.get("/", verifySupabaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tenant_id } = req.query;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!tenant_id || typeof tenant_id !== 'string') {
      return res.status(400).json({ error: "tenant_id is required" });
    }

    const hasAccess = await checkTenantAccess(userId, tenant_id);
    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied" });
    }

    const permissions = await getAllCommandPermissionsList(tenant_id);

    res.json({
      success: true,
      permissions
    });
  } catch (error: any) {
    console.error("[CommandAccess] Error fetching permissions:", error);
    res.status(500).json({ error: error.message || "Failed to fetch permissions" });
  }
});

router.post("/", verifySupabaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const parseResult = updatePermissionsBodySchema.safeParse(req.body);
    if (!parseResult.success) {
      const errorMessages = parseResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
      return res.status(400).json({ 
        error: "Validation failed", 
        details: errorMessages 
      });
    }

    const { tenant_id, permissions } = parseResult.data;

    const hasAccess = await checkTenantAccess(userId, tenant_id);
    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied" });
    }

    for (const perm of permissions) {
      const updateFields: Record<string, any> = {
        updated_at: new Date().toISOString()
      };

      if (perm.access_level !== undefined) {
        updateFields.access_level = perm.access_level;
      }

      if (perm.allow_group !== undefined) {
        updateFields.allow_group = perm.allow_group;
      }

      const { error } = await supabaseAdmin
        .from('line_command_permissions')
        .update(updateFields)
        .eq('tenant_id', tenant_id)
        .eq('command_key', perm.command_key);

      if (error) {
        console.error(`[CommandAccess] Error updating ${perm.command_key}:`, error);
        throw new Error(`Failed to update permission for ${perm.command_key}`);
      }
    }

    clearPermissionCache(tenant_id);

    res.json({ 
      success: true, 
      message: `Updated ${permissions.length} command permission(s)` 
    });
  } catch (error: any) {
    console.error("[CommandAccess] Error updating permissions:", error);
    res.status(500).json({ error: error.message || "Failed to update permissions" });
  }
});

router.get("/available", verifySupabaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const commands = [
      { key: 'goals_summary', name: 'สรุปเป้าหมาย', description: 'ดูสรุปความคืบหน้าเป้าหมายของ Chapter' },
      { key: 'business_card_search', name: 'ค้นหานามบัตร', description: 'ค้นหานามบัตรสมาชิกในระบบ' },
      { key: 'category_search', name: 'ค้นหาประเภทธุรกิจ', description: 'ค้นหาสมาชิกตามประเภทธุรกิจ' },
      { key: 'checkin', name: 'เช็คอิน', description: 'เช็คอินเข้าร่วมประชุม' },
      { key: 'link_phone', name: 'ผูกเบอร์โทร', description: 'ผูกเบอร์โทรศัพท์กับบัญชี LINE' }
    ];

    res.json({ success: true, commands });
  } catch (error: any) {
    console.error("[CommandAccess] Error fetching available commands:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
