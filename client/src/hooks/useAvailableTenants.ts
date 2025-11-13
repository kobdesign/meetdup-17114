import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Tenant {
  tenant_id: string;
  name: string;
  slug: string;
}

export const useAvailableTenants = (enabled: boolean) => {
  return useQuery<Tenant[]>({
    queryKey: ["/api/tenants"],
    queryFn: async () => {
      console.log("[useAvailableTenants] Fetching tenants...");
      
      const { data, error } = await supabase
        .from("tenants")
        .select("tenant_id, name, slug")
        .eq("status", "active")
        .order("name");

      if (error) {
        console.error("[useAvailableTenants] Error loading tenants:", error);
        throw error;
      }

      console.log(`[useAvailableTenants] Successfully loaded ${data?.length || 0} tenants`);
      return data || [];
    },
    enabled, // Only fetch when user is super admin
    staleTime: 2 * 60 * 1000, // 2 minutes - tenants don't change very often
    gcTime: 5 * 60 * 1000, // 5 minutes in cache
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    // Stale-while-revalidate: show cached data immediately while fetching fresh data
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
  });
};
