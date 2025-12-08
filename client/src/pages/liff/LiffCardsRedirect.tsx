import { useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";

export default function LiffCardsRedirect() {
  const navigate = useNavigate();
  const params = useParams();
  const hasRedirected = useRef(false);
  
  useEffect(() => {
    if (hasRedirected.current) {
      console.log("[LiffCardsRedirect] Already redirected, skipping");
      return;
    }
    
    const pathState = params["*"];
    
    console.log("[LiffCardsRedirect] Detected path-based state:", pathState);
    
    if (pathState) {
      try {
        const decoded = decodeURIComponent(pathState);
        console.log("[LiffCardsRedirect] Decoded path state:", decoded);
        
        const canonicalUrl = `/liff/cards?liff.state=${encodeURIComponent(decoded)}`;
        console.log("[LiffCardsRedirect] Redirecting to canonical URL:", canonicalUrl);
        
        hasRedirected.current = true;
        navigate(canonicalUrl, { replace: true });
      } catch (e) {
        console.error("[LiffCardsRedirect] Error processing path state:", e);
        hasRedirected.current = true;
        navigate("/liff/cards", { replace: true });
      }
    } else {
      console.log("[LiffCardsRedirect] No path state, redirecting to /liff/cards");
      hasRedirected.current = true;
      navigate("/liff/cards", { replace: true });
    }
  }, [navigate, params]);
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
        <p className="text-muted-foreground text-sm">Redirecting...</p>
      </div>
    </div>
  );
}
