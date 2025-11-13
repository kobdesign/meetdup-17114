import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface UserTenantInfo {
  userId: string | null;
  role: string | null;
  tenantId: string | null;
  isSuperAdmin: boolean;
  userName: string | null;
  userEmail: string | null;
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
    };
  }

  const user = session.user;

  console.log("[fetchUserTenantInfo] User found, loading roles and profile...");
  
  // Fetch all roles (user might have multiple)
  const { data: rolesData, error: rolesError } = await supabase
    .from("user_roles")
    .select("role, tenant_id")
    .eq("user_id", user.id);

  if (rolesError) {
    console.error("[fetchUserTenantInfo] Error loading roles:", rolesError);
    throw rolesError;
  }

  // Select highest priority role if user has multiple
  let selectedRole = null;
  let selectedTenantId = null;
  if (rolesData && rolesData.length > 0) {
    const roleHierarchy = { super_admin: 3, chapter_admin: 2, chapter_member: 1 };
    const highestRole = rolesData.reduce((highest, current) => {
      const currentPriority = roleHierarchy[current.role as keyof typeof roleHierarchy] || 0;
      const highestPriority = roleHierarchy[highest.role as keyof typeof roleHierarchy] || 0;
      return currentPriority > highestPriority ? current : highest;
    });
    selectedRole = highestRole.role;
    selectedTenantId = highestRole.tenant_id;
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
  console.log(`[fetchUserTenantInfo] Role: ${selectedRole}, isSuperAdmin: ${isSuperAdmin}, userName: ${profile?.full_name}`);

  return {
    userId: user.id,
    role: selectedRole,
    tenantId: selectedTenantId,
    isSuperAdmin,
    userName: profile?.full_name || null,
    userEmail: user.email || null,
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
