import { useState, useEffect, useCallback, useRef } from "react";
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

// Global flag to prevent multiple LIFF initializations across component remounts
let liffInitialized = false;
let liffInitPromise: Promise<void> | null = null;

export function useAppsLiff(): UseAppsLiffReturn {
  const [isLiffReady, setIsLiffReady] = useState(false);
  const [isInLiff, setIsInLiff] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [liffError, setLiffError] = useState<string | null>(null);
  const [profile, setProfile] = useState<UseAppsLiffReturn["profile"]>(null);
  const [liffConfig, setLiffConfig] = useState<LiffConfig | null>(null);
  const initAttempted = useRef(false);

  useEffect(() => {
    // Prevent double initialization from React StrictMode or fast remounts
    if (initAttempted.current) {
      return;
    }
    initAttempted.current = true;

    let isMounted = true;
    
    const initLiff = async () => {
      try {
        // If LIFF is already initialized, just read the state
        if (liffInitialized) {
          console.log("[Apps LIFF] Already initialized, reading state");
          if (isMounted) {
            setIsInLiff(liff.isInClient());
            setIsLoggedIn(liff.isLoggedIn());
            setIsLiffReady(true);
            
            if (liff.isLoggedIn()) {
              try {
                const userProfile = await liff.getProfile();
                if (isMounted) {
                  setProfile({
                    userId: userProfile.userId,
                    displayName: userProfile.displayName,
                    pictureUrl: userProfile.pictureUrl
                  });
                }
              } catch (e) {
                console.error("[Apps LIFF] Error getting profile:", e);
              }
            }
          }
          return;
        }

        // If init is in progress, wait for it
        if (liffInitPromise) {
          console.log("[Apps LIFF] Init in progress, waiting...");
          await liffInitPromise;
          if (isMounted && liffInitialized) {
            setIsInLiff(liff.isInClient());
            setIsLoggedIn(liff.isLoggedIn());
            setIsLiffReady(true);
          }
          return;
        }

        // Start new initialization
        liffInitPromise = (async () => {
          const response = await fetch("/api/public/apps-liff-config");
          if (!response.ok) {
            throw new Error("Failed to fetch LIFF config");
          }
          const config: LiffConfig = await response.json();
          
          if (isMounted) {
            setLiffConfig(config);
          }

          if (!config.liff_id) {
            console.log("[Apps LIFF] No Apps LIFF ID configured - apps will work without LIFF features");
            liffInitialized = true;
            if (isMounted) {
              setIsLiffReady(true);
            }
            return;
          }

          console.log("[Apps LIFF] Initializing with Apps LIFF ID:", config.liff_id);

          await liff.init({ liffId: config.liff_id });
          liffInitialized = true;
          
          const inClient = liff.isInClient();
          const loggedIn = liff.isLoggedIn();
          
          console.log("[Apps LIFF] Initialized successfully", {
            isInClient: inClient,
            isLoggedIn: loggedIn
          });

          if (isMounted) {
            setIsInLiff(inClient);
            setIsLoggedIn(loggedIn);
            setIsLiffReady(true);

            if (loggedIn) {
              try {
                const userProfile = await liff.getProfile();
                if (isMounted) {
                  setProfile({
                    userId: userProfile.userId,
                    displayName: userProfile.displayName,
                    pictureUrl: userProfile.pictureUrl
                  });
                }
              } catch (profileError) {
                console.error("[Apps LIFF] Error getting profile:", profileError);
              }
            }
          }
        })();

        await liffInitPromise;
      } catch (error: any) {
        console.error("[Apps LIFF] Initialization error:", error);
        liffInitPromise = null;
        if (isMounted) {
          setLiffError(error.message || "Failed to initialize LIFF");
          setIsLiffReady(true);
        }
      }
    };

    initLiff();
    
    return () => {
      isMounted = false;
    };
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
