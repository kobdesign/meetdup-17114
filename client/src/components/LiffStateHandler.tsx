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
    
    if (decoded.startsWith("/")) {
      return decoded;
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
