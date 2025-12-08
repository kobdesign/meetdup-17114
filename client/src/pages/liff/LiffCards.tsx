import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, Share2, CheckCircle2, XCircle, AlertCircle, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLiff } from "@/hooks/useLiff";

type ShareStatus = "loading" | "ready" | "sharing" | "success" | "cancelled" | "error" | "not-in-liff" | "missing-tenant" | "needs-login";

interface ShareState {
  tenantId: string;
  participantId: string;
}

export default function LiffCards() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const hasProcessed = useRef(false);
  
  const [mode, setMode] = useState<"routing" | "share">("routing");
  const [shareState, setShareState] = useState<ShareState | null>(null);
  
  const { isLiffReady, isInLiff, isLoggedIn, needsLogin, canShare, login, shareTargetPicker, closeWindow, liffError } = useLiff();
  
  const [status, setStatus] = useState<ShareStatus>("loading");
  const [memberName, setMemberName] = useState<string>("");
  const [flexMessage, setFlexMessage] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    if (hasProcessed.current) {
      console.log("[LiffCards] Already processed, skipping");
      return;
    }
    
    console.log("[LiffCards] All params:", Object.fromEntries(searchParams.entries()));
    
    const parseParams = (str: string): { tenant?: string; view?: string } => {
      const params: { tenant?: string; view?: string } = {};
      const cleanStr = str.replace(/^[?&]/, '');
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
        
        while (decodedState.includes("liff.state=")) {
          const nestedMatch = decodedState.match(/[?&]?liff\.state=([^&]+)/);
          if (nestedMatch) {
            decodedState = decodeURIComponent(nestedMatch[1]);
            console.log("[LiffCards] Extracted nested liff.state:", decodedState);
          } else {
            break;
          }
        }
        
        if (decodedState.startsWith("share:")) {
          const parts = decodedState.split(":");
          console.log("[LiffCards] Share parts:", parts, "length:", parts.length);
          if (parts.length >= 3) {
            const tenantId = parts[1];
            const participantId = parts.slice(2).join(":");
            console.log("[LiffCards] Share action detected - rendering inline:", { tenantId, participantId });
            hasProcessed.current = true;
            setShareState({ tenantId, participantId });
            setMode("share");
            return;
          }
        }
        
        if (decodedState.startsWith("/")) {
          console.log("[LiffCards] Navigating to path:", decodedState);
          hasProcessed.current = true;
          navigate(decodedState, { replace: true });
          return;
        }
        
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
    
    hasProcessed.current = true;
    
    if (tenantParam) {
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
      console.log("[LiffCards] No tenant param, redirecting to home");
      navigate("/", { replace: true });
    }
  }, [navigate, searchParams]);

  useEffect(() => {
    if (mode !== "share" || !shareState) return;
    
    const { tenantId, participantId } = shareState;
    
    if (!participantId) {
      setStatus("error");
      setErrorMessage("ไม่พบรหัสสมาชิก");
      return;
    }

    if (!tenantId) {
      setStatus("missing-tenant");
      setErrorMessage("ไม่พบข้อมูล Chapter");
      return;
    }

    const fetchFlexMessage = async () => {
      try {
        const url = `/api/public/share-flex/${participantId}?tenantId=${tenantId}`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || `HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.flexMessage) {
          setFlexMessage(data.flexMessage);
          setMemberName(data.memberName || "สมาชิก");
          setStatus("ready");
        } else {
          throw new Error(data.error || "ไม่สามารถโหลดนามบัตรได้");
        }
      } catch (err: any) {
        console.error("[LiffCards] Error fetching flex message:", err);
        setStatus("error");
        setErrorMessage(err.message || "เกิดข้อผิดพลาดในการโหลดข้อมูล");
      }
    };

    fetchFlexMessage();
  }, [mode, shareState]);

  useEffect(() => {
    if (mode !== "share" || status !== "ready" || !isLiffReady || !flexMessage) return;

    if (needsLogin) {
      console.log("[LiffCards] User needs to login first (External browser)");
      setStatus("needs-login");
      return;
    }

    if (!canShare) {
      console.log("[LiffCards] Cannot share - API not available", { isLoggedIn, isInLiff, canShare });
      if (isLoggedIn) {
        setStatus("not-in-liff");
      } else {
        setStatus("needs-login");
      }
      return;
    }

    const autoShare = async () => {
      setStatus("sharing");
      
      try {
        await shareTargetPicker([flexMessage]);
        setStatus("success");
        
        setTimeout(() => {
          closeWindow();
        }, 1500);
      } catch (err: any) {
        console.error("[LiffCards] Share error:", err);
        
        if (err.message?.includes("cancelled") || err.message?.includes("cancel")) {
          setStatus("cancelled");
        } else {
          setStatus("error");
          setErrorMessage(err.message || "ไม่สามารถแชร์ได้");
        }
      }
    };

    autoShare();
  }, [mode, status, isLiffReady, isLoggedIn, isInLiff, needsLogin, canShare, flexMessage, shareTargetPicker, closeWindow]);

  const handleRetry = async () => {
    if (!flexMessage) return;
    
    setStatus("sharing");
    
    try {
      await shareTargetPicker([flexMessage]);
      setStatus("success");
      
      setTimeout(() => {
        closeWindow();
      }, 1500);
    } catch (err: any) {
      console.error("[LiffCards] Retry share error:", err);
      
      if (err.message?.includes("cancelled") || err.message?.includes("cancel")) {
        setStatus("cancelled");
      } else {
        setStatus("error");
        setErrorMessage(err.message || "ไม่สามารถแชร์ได้");
      }
    }
  };

  const handleClose = () => {
    closeWindow();
  };

  const handleCopyLink = async () => {
    if (!shareState) return;
    const profileUrl = `${window.location.origin}/p/${shareState.participantId}`;
    
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopySuccess(true);
      setTimeout(() => {
        setCopySuccess(false);
      }, 2000);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  if (mode === "routing") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/10 to-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center space-y-6">
        {status === "loading" && (
          <>
            <div className="w-20 h-20 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-semibold">กำลังโหลดนามบัตร...</h1>
              <p className="text-muted-foreground text-sm">กรุณารอสักครู่</p>
            </div>
          </>
        )}

        {status === "ready" && (
          <>
            <div className="w-20 h-20 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-semibold">เตรียมแชร์นามบัตร</h1>
              <p className="text-muted-foreground text-sm">{memberName}</p>
            </div>
          </>
        )}

        {status === "sharing" && (
          <>
            <div className="w-20 h-20 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
              <Share2 className="w-10 h-10 text-primary animate-pulse" />
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-semibold">เลือกผู้รับนามบัตร</h1>
              <p className="text-muted-foreground text-sm">เลือกเพื่อนหรือกลุ่มที่ต้องการส่งให้</p>
            </div>
          </>
        )}

        {status === "success" && (
          <>
            <div className="w-20 h-20 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-semibold text-green-600 dark:text-green-400">แชร์สำเร็จ!</h1>
              <p className="text-muted-foreground text-sm">ส่งนามบัตรเรียบร้อยแล้ว</p>
            </div>
          </>
        )}

        {status === "cancelled" && (
          <>
            <div className="w-20 h-20 mx-auto bg-muted rounded-full flex items-center justify-center">
              <XCircle className="w-10 h-10 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-semibold">ยกเลิกการแชร์</h1>
              <p className="text-muted-foreground text-sm">{memberName}</p>
            </div>
            <div className="space-y-3 pt-4">
              <Button 
                onClick={handleRetry} 
                className="w-full"
                data-testid="button-retry-share"
              >
                <Share2 className="w-4 h-4 mr-2" />
                ลองใหม่อีกครั้ง
              </Button>
              <Button 
                variant="outline" 
                onClick={handleClose}
                className="w-full"
                data-testid="button-close"
              >
                ปิดหน้านี้
              </Button>
            </div>
          </>
        )}

        {status === "needs-login" && (
          <>
            <div className="w-20 h-20 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
              <LogIn className="w-10 h-10 text-primary" />
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-semibold">เข้าสู่ระบบด้วย LINE</h1>
              <p className="text-muted-foreground text-sm">
                กรุณาเข้าสู่ระบบด้วย LINE เพื่อแชร์นามบัตรของ
              </p>
              <p className="font-medium">{memberName}</p>
            </div>
            <div className="space-y-3 pt-4">
              <Button 
                onClick={login}
                className="w-full bg-[#06C755] hover:bg-[#05b34d]"
                data-testid="button-line-login"
              >
                <LogIn className="w-4 h-4 mr-2" />
                เข้าสู่ระบบด้วย LINE
              </Button>
              <Button 
                variant="outline" 
                onClick={handleClose}
                className="w-full"
                data-testid="button-close"
              >
                ยกเลิก
              </Button>
            </div>
          </>
        )}

        {status === "not-in-liff" && (
          <>
            <div className="w-20 h-20 mx-auto bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
              <AlertCircle className="w-10 h-10 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-semibold">กรุณาเปิดใน LINE</h1>
              <p className="text-muted-foreground text-sm">
                ฟีเจอร์แชร์นามบัตรใช้งานได้เฉพาะใน LINE เท่านั้น
              </p>
              <p className="text-muted-foreground text-xs">
                เปิดลิงก์นี้จากแอพ LINE เพื่อแชร์นามบัตรให้เพื่อน
              </p>
            </div>
            <div className="space-y-3 pt-4">
              <Button 
                onClick={handleCopyLink}
                className="w-full"
                data-testid="button-copy-link"
              >
                {copySuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    คัดลอกลิงก์แล้ว!
                  </>
                ) : (
                  "คัดลอกลิงก์หน้านี้"
                )}
              </Button>
              <Button 
                onClick={handleCopyLink}
                variant="outline"
                className="w-full"
                data-testid="button-copy-profile-link"
              >
                คัดลอกลิงก์โปรไฟล์
              </Button>
              <p className="text-xs text-muted-foreground">
                วางลิงก์ในแอพ LINE แล้วกดเปิดเพื่อแชร์ได้
              </p>
            </div>
          </>
        )}

        {status === "missing-tenant" && (
          <>
            <div className="w-20 h-20 mx-auto bg-destructive/10 rounded-full flex items-center justify-center">
              <XCircle className="w-10 h-10 text-destructive" />
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-semibold text-destructive">ข้อมูลไม่ครบถ้วน</h1>
              <p className="text-muted-foreground text-sm">
                ไม่พบข้อมูล Chapter กรุณาลองใหม่จากนามบัตรอีกครั้ง
              </p>
            </div>
            <div className="space-y-3 pt-4">
              <Button 
                variant="outline" 
                onClick={handleClose}
                className="w-full"
                data-testid="button-close"
              >
                ปิดหน้านี้
              </Button>
            </div>
          </>
        )}

        {status === "error" && (
          <>
            <div className="w-20 h-20 mx-auto bg-destructive/10 rounded-full flex items-center justify-center">
              <XCircle className="w-10 h-10 text-destructive" />
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-semibold text-destructive">เกิดข้อผิดพลาด</h1>
              <p className="text-muted-foreground text-sm">
                {errorMessage || liffError || "ไม่สามารถแชร์นามบัตรได้"}
              </p>
            </div>
            <div className="space-y-3 pt-4">
              {flexMessage && (
                <Button 
                  onClick={handleRetry}
                  className="w-full"
                  data-testid="button-retry-share"
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  ลองใหม่อีกครั้ง
                </Button>
              )}
              <Button 
                variant="outline" 
                onClick={handleClose}
                className="w-full"
                data-testid="button-close"
              >
                ปิดหน้านี้
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
