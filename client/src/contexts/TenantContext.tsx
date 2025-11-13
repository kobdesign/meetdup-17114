import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useUserTenantInfo } from "@/hooks/useUserTenantInfo";
import { useAccessibleTenants } from "@/hooks/useAccessibleTenants";

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
  isReady: boolean; // NEW: Indicates tenant selection is complete
  setSelectedTenant: (id: string | null) => void; // Updated to accept null
  effectiveTenantId: string | null;
  userId: string | null;
  userRole: string | null;
  userName: string | null;
  userEmail: string | null;
  isLoadingUserInfo: boolean;
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
  const [isReady, setIsReady] = useState(false);

  // Use React Query hooks for data fetching
  const userInfoQuery = useUserTenantInfo();
  const userId = userInfoQuery.data?.userId || null;
  const isSuperAdmin = userInfoQuery.data?.isSuperAdmin || false;
  const userTenantId = userInfoQuery.data?.tenantId || null;
  const userRole = userInfoQuery.data?.role || null;
  const userName = userInfoQuery.data?.userName || null;
  const userEmail = userInfoQuery.data?.userEmail || null;
  const isLoadingUserInfo = userInfoQuery.isLoading;

  // Fetch accessible tenants based on user role
  const tenantsQuery = useAccessibleTenants({
    userId,
    isSuperAdmin,
    enabled: !!userId, // Only fetch when we have a user
  });

  const availableTenants = tenantsQuery.data || [];
  
  // Derive combined loading state
  const isLoading = userInfoQuery.isLoading || tenantsQuery.isLoading;

  // Auto-selection and localStorage restoration
  useEffect(() => {
    // Don't run until both queries are settled
    if (isLoading || !userId) {
      setIsReady(false);
      return;
    }

    console.log("[TenantContext] Running auto-selection logic", {
      isSuperAdmin,
      availableTenantsCount: availableTenants.length,
      userId,
    });

    // User-scoped localStorage key
    const storageKey = `tenant_selection_${userId}`;
    const savedTenantId = localStorage.getItem(storageKey);

    if (isSuperAdmin) {
      // Super admin: default to null (All tenants mode)
      // Restore saved selection if valid (including null)
      if (savedTenantId === "null" || savedTenantId === null) {
        console.log("[TenantContext] Super admin: defaulting to All tenants (null)");
        setSelectedTenantId(null);
        setIsReady(true);
      } else if (savedTenantId && availableTenants.find(t => t.tenant_id === savedTenantId)) {
        console.log("[TenantContext] Super admin: restoring valid saved tenant:", savedTenantId);
        setSelectedTenantId(savedTenantId);
        setIsReady(true);
      } else {
        console.log("[TenantContext] Super admin: no valid saved selection, defaulting to null");
        setSelectedTenantId(null);
        localStorage.setItem(storageKey, "null");
        setIsReady(true);
      }
    } else {
      // Chapter admin: auto-select based on available tenants
      if (availableTenants.length === 0) {
        console.warn("[TenantContext] Chapter admin has no accessible tenants!");
        setSelectedTenantId(null);
        setIsReady(true);
      } else if (availableTenants.length === 1) {
        // Auto-select the only tenant
        const singleTenant = availableTenants[0];
        console.log("[TenantContext] Chapter admin: auto-selecting single tenant:", singleTenant.name);
        setSelectedTenantId(singleTenant.tenant_id);
        localStorage.setItem(storageKey, singleTenant.tenant_id);
        setIsReady(true);
      } else {
        // Multiple tenants: restore saved or select first
        const validSaved = savedTenantId && availableTenants.find(t => t.tenant_id === savedTenantId);
        if (validSaved) {
          console.log("[TenantContext] Chapter admin: restoring saved tenant:", savedTenantId);
          setSelectedTenantId(savedTenantId);
        } else {
          const firstTenant = availableTenants[0];
          console.log("[TenantContext] Chapter admin: selecting first tenant:", firstTenant.name);
          setSelectedTenantId(firstTenant.tenant_id);
          localStorage.setItem(storageKey, firstTenant.tenant_id);
        }
        setIsReady(true);
      }
    }
  }, [isLoading, userId, isSuperAdmin, availableTenants]);

  // Subscribe to realtime updates for accessible tenants
  useEffect(() => {
    if (!userId) return;

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
          // Invalidate with the new queryKey pattern
          queryClient.invalidateQueries({ queryKey: ["/api/accessible-tenants", userId, isSuperAdmin] });
        }
      )
      .subscribe();

    return () => {
      console.log("[TenantContext] Cleaning up realtime subscription");
      supabase.removeChannel(channel);
    };
  }, [userId, isSuperAdmin, queryClient]);

  // Save selected tenant to localStorage when manually changed
  const handleSetSelectedTenant = (id: string | null) => {
    if (!userId) return;
    
    const storageKey = `tenant_selection_${userId}`;
    console.log("[TenantContext] Manually setting selected tenant:", id);
    setSelectedTenantId(id);
    
    // Save to localStorage (including null for "All tenants")
    if (id === null) {
      localStorage.setItem(storageKey, "null");
    } else {
      localStorage.setItem(storageKey, id);
    }
  };

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

  // Effective tenant ID: use selected if available, fallback to user's tenant
  // This allows both super admin AND chapter admin to switch tenants
  const effectiveTenantId = selectedTenantId !== null ? selectedTenantId : userTenantId;

  const value: TenantContextType = {
    selectedTenantId,
    selectedTenant: selectedTenantData,
    availableTenants,
    isSuperAdmin,
    isLoading,
    isReady,
    setSelectedTenant: handleSetSelectedTenant,
    effectiveTenantId,
    userId,
    userRole,
    userName,
    userEmail,
    isLoadingUserInfo,
  };

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
};
