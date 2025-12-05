import { supabaseAdmin } from "../../utils/supabaseClient";

export type CommandAccessLevel = 'public' | 'member' | 'admin';

interface CommandPermission {
  command_key: string;
  command_name: string;
  command_description: string | null;
  access_level: CommandAccessLevel;
  allow_group: boolean;
}

interface PermissionCache {
  permissions: Map<string, CommandPermission>;
  timestamp: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const permissionCache = new Map<string, PermissionCache>();

const DEFAULT_PERMISSIONS: Record<string, Omit<CommandPermission, 'command_key'>> = {
  'goals_summary': {
    command_name: 'สรุปเป้าหมาย',
    command_description: 'ดูสรุปความคืบหน้าเป้าหมายของ Chapter',
    access_level: 'member',
    allow_group: true
  },
  'business_card_search': {
    command_name: 'ค้นหานามบัตร',
    command_description: 'ค้นหานามบัตรสมาชิกในระบบ',
    access_level: 'member',
    allow_group: true
  },
  'category_search': {
    command_name: 'ค้นหาประเภทธุรกิจ',
    command_description: 'ค้นหาสมาชิกตามประเภทธุรกิจ',
    access_level: 'member',
    allow_group: true
  },
  'checkin': {
    command_name: 'เช็คอิน',
    command_description: 'เช็คอินเข้าร่วมประชุม',
    access_level: 'public',
    allow_group: true
  },
  'link_phone': {
    command_name: 'ผูกเบอร์โทร',
    command_description: 'ผูกเบอร์โทรศัพท์กับบัญชี LINE',
    access_level: 'public',
    allow_group: false
  }
};

async function getPermissionsFromDB(tenantId: string): Promise<Map<string, CommandPermission>> {
  try {
    const { data, error } = await supabaseAdmin
      .from('line_command_permissions')
      .select('command_key, command_name, command_description, access_level, allow_group')
      .eq('tenant_id', tenantId);

    if (error) {
      console.error('[CommandAuth] Error fetching permissions:', error);
      return new Map();
    }

    const permMap = new Map<string, CommandPermission>();
    for (const perm of data || []) {
      permMap.set(perm.command_key, perm as CommandPermission);
    }
    return permMap;
  } catch (error) {
    console.error('[CommandAuth] Exception fetching permissions:', error);
    return new Map();
  }
}

export async function getCommandPermissions(tenantId: string): Promise<Map<string, CommandPermission>> {
  const cached = permissionCache.get(tenantId);
  const now = Date.now();

  if (cached && (now - cached.timestamp) < CACHE_TTL_MS) {
    return cached.permissions;
  }

  const dbPermissions = await getPermissionsFromDB(tenantId);
  
  const mergedPermissions = new Map<string, CommandPermission>();
  for (const [key, defaultPerm] of Object.entries(DEFAULT_PERMISSIONS)) {
    const dbPerm = dbPermissions.get(key);
    mergedPermissions.set(key, dbPerm || { command_key: key, ...defaultPerm });
  }
  for (const [key, perm] of dbPermissions) {
    if (!mergedPermissions.has(key)) {
      mergedPermissions.set(key, perm);
    }
  }

  permissionCache.set(tenantId, {
    permissions: mergedPermissions,
    timestamp: now
  });

  return mergedPermissions;
}

export function clearPermissionCache(tenantId?: string): void {
  if (tenantId) {
    permissionCache.delete(tenantId);
  } else {
    permissionCache.clear();
  }
}

export async function getCommandPermission(
  tenantId: string, 
  commandKey: string
): Promise<CommandPermission | null> {
  const permissions = await getCommandPermissions(tenantId);
  return permissions.get(commandKey) || null;
}

export async function isLinkedMember(
  tenantId: string, 
  lineUserId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin
      .from('participants')
      .select('id, status, user_id')
      .eq('tenant_id', tenantId)
      .eq('line_user_id', lineUserId)
      .eq('status', 'member')
      .single();

    if (error || !data) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('[CommandAuth] Error checking member status:', error);
    return false;
  }
}

export async function isChapterAdmin(
  tenantId: string, 
  lineUserId: string
): Promise<boolean> {
  try {
    const { data: participant } = await supabaseAdmin
      .from('participants')
      .select('user_id')
      .eq('tenant_id', tenantId)
      .eq('line_user_id', lineUserId)
      .single();

    if (participant?.user_id) {
      const { data: role } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', participant.user_id)
        .or(`tenant_id.eq.${tenantId},role.eq.super_admin`)
        .in('role', ['super_admin', 'chapter_admin'])
        .single();

      if (role) {
        return true;
      }
    }

    const { data: allParticipants } = await supabaseAdmin
      .from('participants')
      .select('user_id')
      .eq('line_user_id', lineUserId)
      .not('user_id', 'is', null);

    if (allParticipants && allParticipants.length > 0) {
      for (const p of allParticipants) {
        const { data: superAdminRole } = await supabaseAdmin
          .from('user_roles')
          .select('role')
          .eq('user_id', p.user_id)
          .eq('role', 'super_admin')
          .single();

        if (superAdminRole) {
          return true;
        }

        const { data: chapterAdminRole } = await supabaseAdmin
          .from('user_roles')
          .select('role')
          .eq('user_id', p.user_id)
          .eq('tenant_id', tenantId)
          .eq('role', 'chapter_admin')
          .single();

        if (chapterAdminRole) {
          return true;
        }
      }
    }

    return false;
  } catch (error) {
    console.error('[CommandAuth] Error checking admin status:', error);
    return false;
  }
}

export interface AuthorizationResult {
  authorized: boolean;
  reason?: string;
  accessLevel?: CommandAccessLevel;
}

export async function checkCommandAuthorization(
  tenantId: string,
  commandKey: string,
  lineUserId: string,
  isGroupChat: boolean
): Promise<AuthorizationResult> {
  const permission = await getCommandPermission(tenantId, commandKey);

  if (!permission) {
    console.log(`[CommandAuth] No permission found for command: ${commandKey}`);
    return { authorized: false, reason: 'unknown_command' };
  }

  if (isGroupChat && !permission.allow_group) {
    console.log(`[CommandAuth] Command ${commandKey} not allowed in group chat`);
    return { 
      authorized: false, 
      reason: 'group_not_allowed',
      accessLevel: permission.access_level 
    };
  }

  switch (permission.access_level) {
    case 'public':
      return { authorized: true, accessLevel: 'public' };

    case 'member': {
      const isMember = await isLinkedMember(tenantId, lineUserId);
      if (isMember) {
        return { authorized: true, accessLevel: 'member' };
      }
      
      const isAdmin = await isChapterAdmin(tenantId, lineUserId);
      if (isAdmin) {
        return { authorized: true, accessLevel: 'admin' };
      }
      
      console.log(`[CommandAuth] User ${lineUserId} is not a member for command: ${commandKey}`);
      return { 
        authorized: false, 
        reason: 'member_required',
        accessLevel: permission.access_level 
      };
    }

    case 'admin': {
      const isAdmin = await isChapterAdmin(tenantId, lineUserId);
      if (isAdmin) {
        return { authorized: true, accessLevel: 'admin' };
      }
      
      console.log(`[CommandAuth] User ${lineUserId} is not an admin for command: ${commandKey}`);
      return { 
        authorized: false, 
        reason: 'admin_required',
        accessLevel: permission.access_level 
      };
    }

    default:
      return { authorized: false, reason: 'invalid_access_level' };
  }
}

export function getAuthorizationErrorMessage(reason: string): string {
  switch (reason) {
    case 'group_not_allowed':
      return 'คำสั่งนี้ไม่สามารถใช้ใน Group chat ได้\nกรุณาส่งข้อความส่วนตัวมาที่บอทโดยตรง';
    case 'member_required':
      return 'คำสั่งนี้สำหรับสมาชิกเท่านั้น\nกรุณาผูกบัญชี LINE ของคุณกับระบบก่อน';
    case 'admin_required':
      return 'คำสั่งนี้สำหรับผู้ดูแลระบบเท่านั้น';
    case 'unknown_command':
      return 'ไม่พบคำสั่งนี้ในระบบ';
    default:
      return 'คุณไม่มีสิทธิ์ใช้คำสั่งนี้';
  }
}

export async function getAllCommandPermissionsList(tenantId: string): Promise<CommandPermission[]> {
  const permissions = await getCommandPermissions(tenantId);
  return Array.from(permissions.values());
}
