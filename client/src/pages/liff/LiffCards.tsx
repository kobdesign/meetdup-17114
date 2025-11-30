import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";

export default function LiffCards() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Log all received parameters for debugging
    console.log("[LiffCards] All params:", Object.fromEntries(searchParams.entries()));
    
    // Helper function to parse tenant and view from various formats
    const parseParams = (str: string): { tenant?: string; view?: string } => {
      const params: { tenant?: string; view?: string } = {};
      
      // Remove leading ? or & if present
      const cleanStr = str.replace(/^[?&]/, '');
      
      // Parse as query string
      const urlParams = new URLSearchParams(cleanStr);
      params.tenant = urlParams.get('tenant') || undefined;
      params.view = urlParams.get('view') || undefined;
      
      return params;
    };
    
    const liffState = searchParams.get("liff.state");
    console.log("[LiffCards] Received liff.state:", liffState);
    
    let tenantParam = searchParams.get("tenant");
    let viewParam = searchParams.get("view");
    
    if (liffState) {
      try {
        let decodedState = decodeURIComponent(liffState);
        console.log("[LiffCards] Decoded once:", decodedState);
        
        // Handle nested liff.state (from LINE redirect issues)
        while (decodedState.includes("liff.state=")) {
          const nestedMatch = decodedState.match(/[?&]?liff\.state=([^&]+)/);
          if (nestedMatch) {
            decodedState = decodeURIComponent(nestedMatch[1]);
            console.log("[LiffCards] Extracted nested liff.state:", decodedState);
          } else {
            break;
          }
        }
        
        // Check for new colon-separated format: share:{tenant}:{participant}
        if (decodedState.startsWith("share:")) {
          const parts = decodedState.split(":");
          if (parts.length === 3) {
            const [, tenantId, participantId] = parts;
            console.log("[LiffCards] Share action detected:", { tenantId, participantId });
            navigate(`/liff/share/${tenantId}/${participantId}`, { replace: true });
            return;
          }
        }
        
        // Legacy: path-based format starting with /
        if (decodedState.startsWith("/")) {
          console.log("[LiffCards] Navigating to path:", decodedState);
          navigate(decodedState, { replace: true });
          return;
        }
        
        // Parse liff.state as query params (LINE converts ?tenant=x&view=y to liff.state)
        const parsedFromState = parseParams(decodedState);
        console.log("[LiffCards] Parsed from liff.state:", parsedFromState);
        
        if (parsedFromState.tenant && !tenantParam) {
          tenantParam = parsedFromState.tenant;
        }
        if (parsedFromState.view && !viewParam) {
          viewParam = parsedFromState.view;
        }
      } catch (e) {
        console.error("[LiffCards] Error parsing liff.state:", e);
      }
    }
    
    console.log("[LiffCards] Final params - tenant:", tenantParam, "view:", viewParam);
    
    // Navigate based on tenant and view
    if (tenantParam) {
      // Handle view parameter for direct navigation
      if (viewParam === "categories" || viewParam === "category") {
        console.log("[LiffCards] Redirecting to categories view");
        navigate(`/liff/search/category?tenant=${tenantParam}`, { replace: true });
      } else if (viewParam === "powerteam") {
        console.log("[LiffCards] Redirecting to powerteam view");
        navigate(`/liff/search/powerteam?tenant=${tenantParam}`, { replace: true });
      } else if (viewParam === "position") {
        console.log("[LiffCards] Redirecting to position view");
        navigate(`/liff/search/position?tenant=${tenantParam}`, { replace: true });
      } else {
        navigate(`/liff/search?tenant=${tenantParam}`, { replace: true });
      }
    } else {
      navigate("/", { replace: true });
    }
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    </div>
  );
}
