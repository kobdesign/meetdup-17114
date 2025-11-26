import { createContext, useContext, useEffect, useState, ReactNode } from "react";

interface LiffUser {
  lineUserId: string;
  displayName: string;
  pictureUrl?: string;
}

interface TenantBranding {
  tenant_id: string;
  name: string;
  subdomain?: string;
  logo_url?: string;
  branding_color: string;
}

interface ParticipantInfo {
  participant_id: string;
  tenant_id: string;
  full_name: string;
  nickname?: string | null;
  phone?: string | null;
  status: string;
}

interface LiffContextType {
  isReady: boolean;
  isLoggedIn: boolean;
  isInClient: boolean;
  isLoading: boolean;
  error: string | null;
  user: LiffUser | null;
  participant: ParticipantInfo | null;
  tenant: TenantBranding | null;
  liff: any;
  login: () => void;
  logout: () => void;
  shareTargetPicker: (messages: any[]) => Promise<void>;
  closeWindow: () => void;
}

const LiffContext = createContext<LiffContextType | null>(null);

export function useLiff() {
  const context = useContext(LiffContext);
  if (!context) {
    throw new Error("useLiff must be used within a LiffProvider");
  }
  return context;
}

interface LiffProviderProps {
  children: ReactNode;
}

export function LiffProvider({ children }: LiffProviderProps) {
  const [isReady, setIsReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isInClient, setIsInClient] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<LiffUser | null>(null);
  const [participant, setParticipant] = useState<ParticipantInfo | null>(null);
  const [tenant, setTenant] = useState<TenantBranding | null>(null);
  const [liffObj, setLiffObj] = useState<any>(null);

  useEffect(() => {
    initializeLiff();
  }, []);

  const initializeLiff = async () => {
    try {
      const liffId = import.meta.env.VITE_LIFF_ID;
      
      if (!liffId) {
        setError("LIFF ID not configured");
        setIsLoading(false);
        return;
      }

      // Dynamically import LIFF SDK
      const liff = (await import("@line/liff")).default;
      
      await liff.init({ liffId });
      
      setLiffObj(liff);
      setIsReady(true);
      setIsInClient(liff.isInClient());
      
      if (liff.isLoggedIn()) {
        setIsLoggedIn(true);
        await loadUserAndTenant(liff);
      }
      
      setIsLoading(false);
    } catch (err: any) {
      console.error("LIFF initialization failed:", err);
      setError(err.message || "Failed to initialize LIFF");
      setIsLoading(false);
    }
  };

  const loadUserAndTenant = async (liff: any) => {
    try {
      // Get LINE profile
      const profile = await liff.getProfile();
      
      setUser({
        lineUserId: profile.userId,
        displayName: profile.displayName,
        pictureUrl: profile.pictureUrl,
      });

      // Fetch participant and tenant info from backend
      const response = await fetch(`/api/liff/context?line_user_id=${profile.userId}`);
      const data = await response.json();

      if (data.success && data.participant) {
        setParticipant(data.participant);
        setTenant(data.tenant);
      }
    } catch (err) {
      console.error("Failed to load user/tenant:", err);
    }
  };

  const login = () => {
    if (liffObj && !isLoggedIn) {
      liffObj.login();
    }
  };

  const logout = () => {
    if (liffObj && isLoggedIn) {
      liffObj.logout();
      setIsLoggedIn(false);
      setUser(null);
      setParticipant(null);
      setTenant(null);
    }
  };

  const shareTargetPicker = async (messages: any[]) => {
    if (!liffObj) {
      throw new Error("LIFF not initialized");
    }
    
    if (!liffObj.isApiAvailable("shareTargetPicker")) {
      throw new Error("shareTargetPicker not available");
    }
    
    await liffObj.shareTargetPicker(messages);
  };

  const closeWindow = () => {
    if (liffObj) {
      liffObj.closeWindow();
    }
  };

  return (
    <LiffContext.Provider
      value={{
        isReady,
        isLoggedIn,
        isInClient,
        isLoading,
        error,
        user,
        participant,
        tenant,
        liff: liffObj,
        login,
        logout,
        shareTargetPicker,
        closeWindow,
      }}
    >
      {children}
    </LiffContext.Provider>
  );
}
