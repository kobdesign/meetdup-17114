import { useState, useEffect, useCallback } from "react";
import liff from "@line/liff";

interface LiffConfig {
  liff_id: string | null;
  liff_enabled: boolean;
}

interface UseAppsLiffReturn {
  isLiffReady: boolean;
  isInLiff: boolean;
  isLoggedIn: boolean;
  needsLogin: boolean;
  liffError: string | null;
  profile: {
    userId: string;
    displayName: string;
    pictureUrl?: string;
  } | null;
  login: () => void;
  closeWindow: () => void;
}

export function useAppsLiff(): UseAppsLiffReturn {
  const [isLiffReady, setIsLiffReady] = useState(false);
  const [isInLiff, setIsInLiff] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [liffError, setLiffError] = useState<string | null>(null);
  const [profile, setProfile] = useState<UseAppsLiffReturn["profile"]>(null);
  const [liffConfig, setLiffConfig] = useState<LiffConfig | null>(null);

  useEffect(() => {
    const initLiff = async () => {
      try {
        const response = await fetch("/api/public/apps-liff-config");
        const config: LiffConfig = await response.json();
        setLiffConfig(config);

        if (!config.liff_id) {
          console.log("[Apps LIFF] No Apps LIFF ID configured - apps will work without LIFF features");
          setIsLiffReady(true);
          return;
        }

        console.log("[Apps LIFF] Initializing with Apps LIFF ID:", config.liff_id, "(independent from Share LIFF)");

        await liff.init({ liffId: config.liff_id });
        
        setIsLiffReady(true);
        setIsInLiff(liff.isInClient());
        setIsLoggedIn(liff.isLoggedIn());

        console.log("[Apps LIFF] Initialized successfully", {
          isInClient: liff.isInClient(),
          isLoggedIn: liff.isLoggedIn()
        });

        if (liff.isLoggedIn()) {
          try {
            const userProfile = await liff.getProfile();
            setProfile({
              userId: userProfile.userId,
              displayName: userProfile.displayName,
              pictureUrl: userProfile.pictureUrl
            });
          } catch (profileError) {
            console.error("[Apps LIFF] Error getting profile:", profileError);
          }
        }
      } catch (error: any) {
        console.error("[Apps LIFF] Initialization error:", error);
        setLiffError(error.message || "Failed to initialize LIFF");
        setIsLiffReady(true);
      }
    };

    initLiff();
  }, []);

  // needsLogin is true when:
  // 1. LIFF is ready
  // 2. User is NOT logged in
  // 3. Apps LIFF ID is configured
  // Note: In LIFF client, user might still need to login if not logged in
  const needsLogin = isLiffReady && !isLoggedIn && !!liffConfig?.liff_id;

  const login = useCallback(() => {
    if (!liffConfig?.liff_id) {
      console.log("[Apps LIFF] Cannot login - Apps LIFF ID not configured");
      return;
    }

    console.log("[Apps LIFF] Calling liff.login() for External browser");
    liff.login({ redirectUri: window.location.href });
  }, [liffConfig]);

  const closeWindow = useCallback(() => {
    if (liff.isInClient()) {
      liff.closeWindow();
    } else {
      window.close();
    }
  }, []);

  return {
    isLiffReady,
    isInLiff,
    isLoggedIn,
    needsLogin,
    liffError,
    profile,
    login,
    closeWindow
  };
}
