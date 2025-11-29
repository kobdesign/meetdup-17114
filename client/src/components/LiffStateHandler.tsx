import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

export function LiffStateHandler({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [hasHandledLiffState, setHasHandledLiffState] = useState(false);

  useEffect(() => {
    if (hasHandledLiffState) return;

    const urlParams = new URLSearchParams(window.location.search);
    const liffState = urlParams.get("liff.state");

    if (liffState) {
      console.log("[LiffStateHandler] Found liff.state:", liffState);

      try {
        const decodedState = decodeURIComponent(liffState);
        console.log("[LiffStateHandler] Decoded state:", decodedState);

        const currentFullPath = location.pathname + location.search;
        
        if (!currentFullPath.startsWith(decodedState.split("?")[0])) {
          console.log("[LiffStateHandler] Navigating to:", decodedState);
          setHasHandledLiffState(true);
          navigate(decodedState, { replace: true });
          return;
        }
      } catch (e) {
        console.error("[LiffStateHandler] Error parsing liff.state:", e);
      }
    }

    setHasHandledLiffState(true);
  }, [navigate, location.pathname, location.search, hasHandledLiffState]);

  if (!hasHandledLiffState) {
    const urlParams = new URLSearchParams(window.location.search);
    const liffState = urlParams.get("liff.state");
    
    if (liffState) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      );
    }
  }

  return <>{children}</>;
}
