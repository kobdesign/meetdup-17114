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
  
  // Fetch all roles with tenant names (user might have multiple chapters)
  const { data: rolesData, error: rolesError } = await supabase
    .from("user_roles")
    .select(`
      role, 
      tenant_id,
      created_at,
      tenants!inner(tenant_name)
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (rolesError) {
    console.error("[fetchUserTenantInfo] Error loading roles:", rolesError);
    throw rolesError;
  }

  // Build userChapters array
  const userChapters: UserChapter[] = [];
  if (rolesData && rolesData.length > 0) {
    for (const roleRow of rolesData) {
      if (roleRow.tenant_id && roleRow.tenants) {
        userChapters.push({
          tenantId: roleRow.tenant_id,
          tenantName: (roleRow.tenants as any).tenant_name || "Unknown Chapter",
          role: roleRow.role,
          createdAt: roleRow.created_at || new Date().toISOString(),
        });
      }
    }
  }

  // Determine selected chapter from localStorage or default
  const storedChapterId = localStorage.getItem("meetdup_selected_chapter");
  let selectedRole = null;
  let selectedTenantId = null;

  if (rolesData && rolesData.length > 0) {
    // Check if user has super_admin role
    const superAdminRole = rolesData.find(r => r.role === "super_admin");
    if (superAdminRole) {
      selectedRole = "super_admin";
      selectedTenantId = null; // Super admin has no specific tenant
    } else {
      // Find selected chapter from localStorage
      const selectedChapter = userChapters.find(c => c.tenantId === storedChapterId);
      
      if (selectedChapter) {
        selectedRole = selectedChapter.role;
        selectedTenantId = selectedChapter.tenantId;
      } else if (userChapters.length > 0) {
        // Default to first chapter
        const firstChapter = userChapters[0];
        selectedRole = firstChapter.role;
        selectedTenantId = firstChapter.tenantId;
        localStorage.setItem("meetdup_selected_chapter", firstChapter.tenantId);
      }
    }
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

  const isSuperAdmin = selectedRole === "super_admin";
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
