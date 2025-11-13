import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useUserTenantInfo } from "@/hooks/useUserTenantInfo";
import { useAvailableTenants } from "@/hooks/useAvailableTenants";

interface Tenant {
  tenant_id: string;
  name: string;
  slug: string;
}

interface TenantDetails extends Tenant {
  logo_url?: string;
  branding_color?: string;
}

interface TenantContextType {
  selectedTenantId: string | null;
  selectedTenant: TenantDetails | null;
  availableTenants: Tenant[];
  isSuperAdmin: boolean;
  isLoading: boolean;
  setSelectedTenant: (id: string) => void;
  effectiveTenantId: string | null;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const useTenantContext = () => {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error("useTenantContext must be used within TenantProvider");
  }
  return context;
};

interface TenantProviderProps {
  children: ReactNode;
}

export const TenantProvider: React.FC<TenantProviderProps> = ({ children }) => {
  const queryClient = useQueryClient();
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [selectedTenantData, setSelectedTenantData] = useState<TenantDetails | null>(null);

  // Use React Query hooks for data fetching
  const userInfoQuery = useUserTenantInfo();
  const tenantsQuery = useAvailableTenants(userInfoQuery.data?.isSuperAdmin || false);

  const isSuperAdmin = userInfoQuery.data?.isSuperAdmin || false;
  const userTenantId = userInfoQuery.data?.tenantId || null;
  const availableTenants = tenantsQuery.data || [];

  // Derive combined loading state
  const isLoading = userInfoQuery.isLoading || (isSuperAdmin && tenantsQuery.isLoading && !tenantsQuery.data);

  // Load selected tenant from localStorage on mount
  useEffect(() => {
    if (isSuperAdmin) {
      const saved = localStorage.getItem("selected_tenant_id");
      if (saved) {
        console.log("[TenantContext] Loading saved tenant from localStorage:", saved);
        setSelectedTenantId(saved);
      }
    }
  }, [isSuperAdmin]);

  // Subscribe to realtime updates for tenants (super admin only)
  useEffect(() => {
    if (!isSuperAdmin) return;

    console.log("[TenantContext] Setting up realtime subscription for tenants");
    const channel = supabase
      .channel('tenants-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tenants'
        },
        () => {
          console.log("[TenantContext] Tenant update detected, invalidating cache");
          queryClient.invalidateQueries({ queryKey: ["/api/tenants"] });
        }
      )
      .subscribe();

    return () => {
      console.log("[TenantContext] Cleaning up realtime subscription");
      supabase.removeChannel(channel);
    };
  }, [isSuperAdmin, queryClient]);

  // Save selected tenant to localStorage when changed
  useEffect(() => {
    if (isSuperAdmin && selectedTenantId) {
      console.log("[TenantContext] Saving selected tenant to localStorage:", selectedTenantId);
      localStorage.setItem("selected_tenant_id", selectedTenantId);
    }
  }, [selectedTenantId, isSuperAdmin]);

  const loadTenantDetails = async (tenantId: string) => {
    try {
      console.log("[TenantContext] Loading details for tenant:", tenantId);
      const { data: tenantData } = await supabase
        .from("tenants")
        .select("tenant_id, name, slug")
        .eq("tenant_id", tenantId)
        .single();

      const { data: settingsData, error: settingsError } = await supabase
        .from("tenant_settings")
        .select("logo_url, branding_color")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (settingsError && settingsError.code !== "PGRST116") {
        throw settingsError;
      }

      if (tenantData) {
        setSelectedTenantData({
          ...tenantData,
          logo_url: settingsData?.logo_url,
          branding_color: settingsData?.branding_color,
        });
      }
    } catch (error) {
      console.error("[TenantContext] Error loading tenant details:", error);
    }
  };

  // Load tenant details when selectedTenantId changes
  useEffect(() => {
    if (selectedTenantId) {
      loadTenantDetails(selectedTenantId);
    } else {
      setSelectedTenantData(null);
    }
  }, [selectedTenantId]);

  // Effective tenant ID: for super admin use selected, for regular users use their tenant
  const effectiveTenantId = isSuperAdmin ? selectedTenantId : userTenantId;

  const value: TenantContextType = {
    selectedTenantId,
    selectedTenant: selectedTenantData,
    availableTenants,
    isSuperAdmin,
    isLoading,
    setSelectedTenant: setSelectedTenantId,
    effectiveTenantId,
  };

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
};
