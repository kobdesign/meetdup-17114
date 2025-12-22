import { useState, useEffect, useCallback, useRef } from "react";
import {
  initializeLiff,
  getLiffState,
  subscribeLiffState,
  liffLogin,
  liffCloseWindow,
} from "@/lib/liffManager";

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
  const [state, setState] = useState(() => getLiffState());
  const initAttempted = useRef(false);

  useEffect(() => {
    const unsubscribe = subscribeLiffState(() => {
      setState(getLiffState());
    });

    if (!initAttempted.current) {
      initAttempted.current = true;
      initializeLiff("apps", "/api/public/apps-liff-config").then(() => {
        setState(getLiffState());
      });
    }

    return unsubscribe;
  }, []);

  const needsLogin =
    state.initialized && !state.isLoggedIn && !!state.liffId;

  const login = useCallback(() => {
    liffLogin();
  }, []);

  const closeWindow = useCallback(() => {
    liffCloseWindow();
  }, []);

  return {
    isLiffReady: state.initialized,
    isInLiff: state.isInClient,
    isLoggedIn: state.isLoggedIn,
    needsLogin,
    liffError: state.error,
    profile: state.profile,
    login,
    closeWindow,
  };
}
