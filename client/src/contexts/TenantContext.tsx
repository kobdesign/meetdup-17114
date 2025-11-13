import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
  isLoadingTenants: boolean;
  tenantsError: string | null;
  setSelectedTenant: (id: string) => void;
  effectiveTenantId: string | null;
  retryLoadTenants: () => void;
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
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [selectedTenantData, setSelectedTenantData] = useState<TenantDetails | null>(null);
  const [availableTenants, setAvailableTenants] = useState<Tenant[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingTenants, setIsLoadingTenants] = useState(false);
  const [tenantsError, setTenantsError] = useState<string | null>(null);
  const [userTenantId, setUserTenantId] = useState<string | null>(null);
  const { toast } = useToast();

  // Load user role and tenant info
  useEffect(() => {
    loadUserInfo();
  }, []);

  // Load selected tenant from localStorage on mount
  useEffect(() => {
    if (isSuperAdmin) {
      const saved = localStorage.getItem("selected_tenant_id");
      if (saved) {
        setSelectedTenantId(saved);
      }
    }
  }, [isSuperAdmin]);

  // Subscribe to realtime updates for tenants (super admin only)
  useEffect(() => {
    if (!isSuperAdmin) return;

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
          loadAvailableTenants();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isSuperAdmin]);

  // Save selected tenant to localStorage when changed
  useEffect(() => {
    if (isSuperAdmin && selectedTenantId) {
      localStorage.setItem("selected_tenant_id", selectedTenantId);
    }
  }, [selectedTenantId, isSuperAdmin]);

  const loadUserInfo = async () => {
    try {
      console.log("[TenantContext] Loading user info...");
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.log("[TenantContext] No user found");
        setIsLoading(false);
        return;
      }

      console.log("[TenantContext] User found, loading roles...");
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role, tenant_id")
        .eq("user_id", user.id)
        .single();

      if (roles) {
        const isSA = roles.role === "super_admin";
        console.log(`[TenantContext] User role: ${roles.role}, isSuperAdmin: ${isSA}`);
        setIsSuperAdmin(isSA);
        setUserTenantId(roles.tenant_id);

        // If super admin, load all tenants
        if (isSA) {
          console.log("[TenantContext] Super admin detected, loading tenants...");
          await loadAvailableTenants();
        } else {
          console.log("[TenantContext] Regular user, skipping tenant list load");
        }
      }
    } catch (error) {
      console.error("[TenantContext] Error loading user info:", error);
    } finally {
      setIsLoading(false);
      console.log("[TenantContext] User info loading complete");
    }
  };
  
  const retryLoadTenants = () => {
    console.log("[TenantContext] Manual retry requested");
    loadAvailableTenants();
  };

  const loadAvailableTenants = async (): Promise<boolean> => {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000;
    
    setIsLoadingTenants(true);
    setTenantsError(null);
    
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`[TenantContext] Loading tenants (attempt ${attempt + 1}/${MAX_RETRIES + 1})...`);
        
        const { data, error } = await supabase
          .from("tenants")
          .select("tenant_id, name, slug")
          .eq("status", "active")
          .order("name");

        if (error) throw error;
        
        console.log(`[TenantContext] Successfully loaded ${data?.length || 0} tenants`);
        setAvailableTenants(data || []);
        setTenantsError(null);
        setIsLoadingTenants(false);
        return true;
      } catch (error: any) {
        console.error(`[TenantContext] Error loading tenants (attempt ${attempt + 1}):`, error);
        
        if (attempt < MAX_RETRIES) {
          const delay = RETRY_DELAY * (attempt + 1);
          console.log(`[TenantContext] Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          const errorMsg = error.message || "ไม่สามารถโหลดรายชื่อ Tenant ได้";
          setTenantsError(errorMsg);
          setIsLoadingTenants(false);
          
          toast({
            title: "เกิดข้อผิดพลาด",
            description: errorMsg + " (กรุณาลองใหม่อีกครั้ง)",
            variant: "destructive",
          });
          
          return false;
        }
      }
    }
    
    return false;
  };

  const loadTenantDetails = async (tenantId: string) => {
    try {
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
      console.error("Error loading tenant details:", error);
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
    isLoadingTenants,
    tenantsError,
    setSelectedTenant: setSelectedTenantId,
    effectiveTenantId,
    retryLoadTenants,
  };

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
};
