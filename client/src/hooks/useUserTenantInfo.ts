import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface UserTenantInfo {
  userId: string | null;
  role: string | null;
  tenantId: string | null;
  isSuperAdmin: boolean;
}

export const useUserTenantInfo = () => {
  return useQuery<UserTenantInfo>({
    queryKey: ["/api/user-tenant-info"],
    queryFn: async () => {
      console.log("[useUserTenantInfo] Fetching user info...");
      
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.log("[useUserTenantInfo] No user found");
        return {
          userId: null,
          role: null,
          tenantId: null,
          isSuperAdmin: false,
        };
      }

      console.log("[useUserTenantInfo] User found, loading roles...");
      const { data: roles, error } = await supabase
        .from("user_roles")
        .select("role, tenant_id")
        .eq("user_id", user.id)
        .single();

      if (error) {
        console.error("[useUserTenantInfo] Error loading roles:", error);
        throw error;
      }

      const isSuperAdmin = roles?.role === "super_admin";
      console.log(`[useUserTenantInfo] Role: ${roles?.role}, isSuperAdmin: ${isSuperAdmin}`);

      return {
        userId: user.id,
        role: roles?.role || null,
        tenantId: roles?.tenant_id || null,
        isSuperAdmin,
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - user role doesn't change often
    gcTime: 10 * 60 * 1000, // 10 minutes in cache
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
};
