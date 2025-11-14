import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface UserChapter {
  tenantId: string;
  tenantName: string;
  role: string;
  createdAt: string;
}

export interface UserTenantInfo {
  userId: string | null;
  role: string | null;
  tenantId: string | null;
  isSuperAdmin: boolean;
  userName: string | null;
  userEmail: string | null;
  userChapters: UserChapter[];
}

// Exported queryFn for reuse in auth listeners and forced fetches
export const fetchUserTenantInfo = async (): Promise<UserTenantInfo> => {
  console.log("[fetchUserTenantInfo] Fetching user info...");
  
  // Use getSession() instead of getUser() to wait for session restoration from localStorage
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.user) {
    console.log("[fetchUserTenantInfo] No session found");
    return {
      userId: null,
      role: null,
      tenantId: null,
      isSuperAdmin: false,
      userName: null,
      userEmail: null,
      userChapters: [],
    };
  }

  const user = session.user;

  console.log("[fetchUserTenantInfo] User found, loading roles and profile...");
  
  // Fetch all user roles first (including super_admin with tenant_id = null)
  const { data: rolesData, error: rolesError } = await supabase
    .from("user_roles")
    .select("role, tenant_id, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (rolesError) {
    console.error("[fetchUserTenantInfo] Error loading roles:", rolesError);
    throw rolesError;
  }

  // Check if user is super_admin
  const isSuperAdmin = rolesData?.some(r => r.role === "super_admin") || false;

  // Build userChapters array (only chapter-specific roles, exclude super_admin)
  const userChapters: UserChapter[] = [];
  const chapterRoles = rolesData?.filter(r => r.tenant_id !== null && r.role !== "super_admin") || [];
  
  if (chapterRoles.length > 0) {
    // Fetch tenant names separately using left join
    const tenantIds = chapterRoles.map(r => r.tenant_id);
    const { data: tenantsData } = await supabase
      .from("tenants")
      .select("tenant_id, tenant_name")
      .in("tenant_id", tenantIds);

    const tenantMap = new Map(tenantsData?.map(t => [t.tenant_id, t.tenant_name]) || []);

    for (const roleRow of chapterRoles) {
      if (roleRow.tenant_id) {
        userChapters.push({
          tenantId: roleRow.tenant_id,
          tenantName: tenantMap.get(roleRow.tenant_id) || "Unknown Chapter",
          role: roleRow.role,
          createdAt: roleRow.created_at || new Date().toISOString(),
        });
      }
    }
  }

  // Chapter selection will be handled by TenantContext
  // This query function returns raw data only (no localStorage side effects)
  let selectedRole = null;
  let selectedTenantId = null;

  if (isSuperAdmin) {
    selectedRole = "super_admin";
    selectedTenantId = null;
  } else if (userChapters.length > 0) {
    // Default to first chapter (TenantContext will override with stored selection)
    const firstChapter = userChapters[0];
    selectedRole = firstChapter.role;
    selectedTenantId = firstChapter.tenantId;
  }

  // Fetch profile
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  if (profileError) {
    console.error("[fetchUserTenantInfo] Error loading profile:", profileError);
  }

  console.log(`[fetchUserTenantInfo] Role: ${selectedRole}, isSuperAdmin: ${isSuperAdmin}, userName: ${profile?.full_name}, chapters: ${userChapters.length}`);

  return {
    userId: user.id,
    role: selectedRole,
    tenantId: selectedTenantId,
    isSuperAdmin,
    userName: profile?.full_name || null,
    userEmail: user.email || null,
    userChapters,
  };
};

export const useUserTenantInfo = () => {
  return useQuery<UserTenantInfo>({
    queryKey: ["/api/user-tenant-info"],
    queryFn: fetchUserTenantInfo,
    staleTime: 5 * 60 * 1000, // 5 minutes - user role doesn't change often
    gcTime: 10 * 60 * 1000, // 10 minutes in cache
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
};
