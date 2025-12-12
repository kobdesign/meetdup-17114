import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

function extractFinalPath(liffState: string): string | null {
  try {
    let decoded = decodeURIComponent(liffState);
    console.log("[LiffStateHandler] First decode:", decoded);
    
    while (decoded.includes("liff.state=")) {
      const match = decoded.match(/[?&]?liff\.state=([^&]+)/);
      if (match) {
        decoded = decodeURIComponent(match[1]);
        console.log("[LiffStateHandler] Nested decode:", decoded);
      } else {
        break;
      }
    }
    
    // Handle path format: /liff/xxx
    if (decoded.startsWith("/")) {
      return decoded;
    }
    
    // Handle query params format: page=substitute&tenant=xxx&meeting=xxx
    // This comes from LINE bot commands that use ?page=substitute format
    if (decoded.includes("page=")) {
      const params = new URLSearchParams(decoded.replace(/^[?&]/, ''));
      const page = params.get("page");
      const tenant = params.get("tenant");
      const meeting = params.get("meeting");
      
      if (page === "substitute" && tenant) {
        const meetingParam = meeting ? `&meeting=${meeting}` : "";
        const targetPath = `/liff/substitute?tenant=${tenant}${meetingParam}`;
        console.log("[LiffStateHandler] Substitute page detected, redirecting to:", targetPath);
        return targetPath;
      }
    }
    
    // IMPORTANT: share: format is handled INLINE by /liff/cards
    // Do NOT redirect - LINE OAuth only allows exact endpoint match
    // /liff/cards will parse liff.state and render share UI directly
    if (decoded.startsWith("share:")) {
      console.log("[LiffStateHandler] Share format detected - letting /liff/cards handle inline");
      return null; // Return null so we don't redirect
    }
    
    return null;
  } catch (e) {
    console.error("[LiffStateHandler] Error extracting path:", e);
    return null;
  }
}

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

      const finalPath = extractFinalPath(liffState);
      
      if (finalPath) {
        const currentPath = location.pathname;
        const targetPath = finalPath.split("?")[0];
        
        if (currentPath !== targetPath) {
          console.log("[LiffStateHandler] Navigating to:", finalPath);
          setHasHandledLiffState(true);
          navigate(finalPath, { replace: true });
          return;
        }
      }
    }

    setHasHandledLiffState(true);
  }, [navigate, location.pathname, hasHandledLiffState]);

  if (!hasHandledLiffState) {
    const urlParams = new URLSearchParams(window.location.search);
    const liffState = urlParams.get("liff.state");
    
    if (liffState && extractFinalPath(liffState)) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      );
    }
  }

  return <>{children}</>;
}
