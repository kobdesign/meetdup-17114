import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

type Tenant = Pick<Database["public"]["Tables"]["tenants"]["Row"], "tenant_id" | "tenant_name" | "subdomain">;

interface UseAccessibleTenantsParams {
  userId: string | null;
  isSuperAdmin: boolean;
  enabled: boolean;
}

/**
 * Hook to fetch tenants accessible by the current user
 * - Super admins: See all active tenants
 * - Chapter admins: See only tenants they're assigned to (via user_roles)
 */
export const useAccessibleTenants = ({ userId, isSuperAdmin, enabled }: UseAccessibleTenantsParams) => {
  return useQuery<Tenant[]>({
    queryKey: ["/api/accessible-tenants", userId, isSuperAdmin],
    queryFn: async () => {
      console.log("[useAccessibleTenants] Fetching accessible tenants...");
      
      if (!userId) {
        console.log("[useAccessibleTenants] No userId provided");
        return [];
      }

      if (isSuperAdmin) {
        // Super admin can see all active tenants
        console.log("[useAccessibleTenants] User is super admin - fetching all tenants");
        const { data, error } = await supabase
          .from("tenants")
          .select("tenant_id, tenant_name, subdomain")
          .order("tenant_name");

        if (error) {
          console.error("[useAccessibleTenants] Error loading all tenants:", error);
          throw error;
        }

        console.log(`[useAccessibleTenants] Loaded ${data?.length || 0} tenants for super admin`);
        return data || [];
      } else {
        // Chapter admin - fetch only assigned tenants
        console.log("[useAccessibleTenants] User is chapter admin - fetching assigned tenants");
        
        // First get tenant IDs from user_roles
        const { data: userRoles, error: rolesError } = await supabase
          .from("user_roles")
          .select("tenant_id")
          .eq("user_id", userId)
          .not("tenant_id", "is", null);

        if (rolesError) {
          console.error("[useAccessibleTenants] Error loading user roles:", rolesError);
          throw rolesError;
        }

        // Extract unique tenant IDs
        const tenantIds = [...new Set(userRoles?.map(r => r.tenant_id).filter(Boolean) || [])];
        
        if (tenantIds.length === 0) {
          console.log("[useAccessibleTenants] No tenants assigned to user");
          return [];
        }

        // Fetch tenant details for assigned tenants
        const { data, error } = await supabase
          .from("tenants")
          .select("tenant_id, tenant_name, subdomain")
          .in("tenant_id", tenantIds)
          .order("tenant_name");

        if (error) {
          console.error("[useAccessibleTenants] Error loading assigned tenants:", error);
          throw error;
        }

        console.log(`[useAccessibleTenants] Loaded ${data?.length || 0} assigned tenants for chapter admin`);
        return data || [];
      }
    },
    enabled: enabled && !!userId,
    staleTime: 2 * 60 * 1000, // 2 minutes - tenants don't change very often
    gcTime: 5 * 60 * 1000, // 5 minutes in cache
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
  });
};
