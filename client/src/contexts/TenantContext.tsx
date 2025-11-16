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
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [selectedTenantData, setSelectedTenantData] = useState<TenantDetails | null>(null);
  const [availableTenants, setAvailableTenants] = useState<Tenant[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      // Get user role and tenant
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role, tenant_id")
        .eq("user_id", user.id)
        .single();

      if (roles) {
        const isSA = roles.role === "super_admin";
        setIsSuperAdmin(isSA);
        setUserTenantId(roles.tenant_id);

        // If super admin, load all tenants
        if (isSA) {
          await loadAvailableTenants();
        }
      }
    } catch (error) {
      console.error("Error loading user info:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAvailableTenants = async () => {
    try {
      const { data, error } = await supabase
        .from("tenants")
        .select("tenant_id, name, slug")
        .eq("status", "active")
        .order("name");

      if (error) throw error;
      setAvailableTenants(data || []);
    } catch (error) {
      console.error("Error loading tenants:", error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถโหลดรายชื่อ Tenant ได้",
        variant: "destructive",
      });
    }
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
    setSelectedTenant: setSelectedTenantId,
    effectiveTenantId,
  };

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
};
