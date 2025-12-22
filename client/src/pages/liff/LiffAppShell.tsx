import { useEffect, useState, lazy, Suspense } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, Lock, ArrowLeft, AppWindow } from "lucide-react";
import { useAppsLiff } from "@/hooks/useAppsLiff";

interface AppConfig {
  app_id: string;
  name: string;
  description: string;
  route: string;
  access_level: "public" | "member" | "admin";
  component: string;
}

interface MemberVerification {
  isMember: boolean;
  isAdmin: boolean;
  participant?: {
    participant_id: string;
    full_name_th: string;
    nickname_th: string;
    tenant_id: string;
  };
  tenant?: {
    tenant_id: string;
    name: string;
  };
}

const appComponents: Record<string, React.LazyExoticComponent<React.ComponentType<any>>> = {
  "boq-estimator": lazy(() => import("@/pages/apps/BOQEstimator")),
};

const appConfigs: Record<string, AppConfig> = {
  "boq-estimator": {
    app_id: "boq-estimator",
    name: "BOQ Estimator",
    description: "ประเมินราคางานก่อสร้างเบื้องต้น",
    route: "/apps/boq-estimator",
    access_level: "member",
    component: "boq-estimator",
  },
};

export default function LiffAppShell() {
  const { appSlug } = useParams<{ appSlug: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { isLiffReady, isLoggedIn, needsLogin, profile, login, liffError, isInLiff, closeWindow } = useAppsLiff();
  
  const [verifying, setVerifying] = useState(false);
  const [verification, setVerification] = useState<MemberVerification | null>(null);
  const [error, setError] = useState<string | null>(null);

  const searchParams = new URLSearchParams(location.search);
  const tenantId = searchParams.get("tenant");
  const appFromQuery = searchParams.get("app");

  const effectiveAppSlug = appSlug || appFromQuery;
  const appConfig = effectiveAppSlug ? appConfigs[effectiveAppSlug] : null;
  const AppComponent = effectiveAppSlug && appComponents[effectiveAppSlug] ? appComponents[effectiveAppSlug] : null;

  useEffect(() => {
    setError(null);
    setVerification(null);

    if (!isLiffReady) {
      return;
    }

    if (!effectiveAppSlug || !appConfig) {
      return;
    }

    if (appConfig.access_level === "public") {
      setVerification({ isMember: false, isAdmin: false });
      return;
    }

    if (!isLoggedIn || !profile?.userId) {
      return;
    }

    if (!tenantId) {
      setError("Missing tenant context");
      return;
    }

    setVerifying(true);
    fetch(`/api/public/verify-line-member?lineUserId=${profile.userId}&tenantId=${tenantId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setVerification(data);
        }
      })
      .catch((err) => {
        console.error("Error verifying member:", err);
        setError("Failed to verify membership");
      })
      .finally(() => setVerifying(false));
  }, [isLiffReady, isLoggedIn, profile, appConfig, tenantId, effectiveAppSlug]);

  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else if (isInLiff) {
      closeWindow();
    }
  };

  if (!effectiveAppSlug || !appConfig) {
    const availableApps = Object.values(appConfigs);
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-md mx-auto space-y-4">
          <div className="text-center space-y-2 py-4">
            <AppWindow className="h-12 w-12 mx-auto text-primary" />
            <h1 className="text-xl font-semibold">Chapter Apps</h1>
            <p className="text-sm text-muted-foreground">
              เลือกแอปพลิเคชันที่ต้องการใช้งาน
            </p>
          </div>
          
          <div className="space-y-3">
            {availableApps.map((app) => (
              <Card 
                key={app.app_id} 
                className="hover-elevate cursor-pointer"
                onClick={() => {
                  const newUrl = `/liff/apps/${app.app_id}${tenantId ? `?tenant=${tenantId}` : ''}`;
                  navigate(newUrl);
                }}
                data-testid={`card-app-${app.app_id}`}
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
                    <AppWindow className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium">{app.name}</h3>
                    <p className="text-sm text-muted-foreground">{app.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {availableApps.length === 0 && (
            <Card>
              <CardContent className="pt-6 text-center space-y-4">
                <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  ยังไม่มีแอปพลิเคชันที่เปิดใช้งาน
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  if (!isLiffReady) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground">กำลังเชื่อมต่อกับ LINE...</p>
        </div>
      </div>
    );
  }

  if (liffError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
            <h2 className="text-lg font-semibold">เกิดข้อผิดพลาด</h2>
            <p className="text-sm text-muted-foreground">{liffError}</p>
            <Button onClick={handleBack} variant="outline" data-testid="button-back">
              <ArrowLeft className="h-4 w-4 mr-2" />
              กลับ
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (appConfig.access_level !== "public" && needsLogin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <Lock className="h-12 w-12 mx-auto text-primary" />
            <h2 className="text-lg font-semibold">{appConfig.name}</h2>
            <p className="text-sm text-muted-foreground">
              กรุณาเข้าสู่ระบบด้วย LINE เพื่อใช้งานแอปพลิเคชันนี้
            </p>
            <Button onClick={login} className="w-full" data-testid="button-line-login">
              เข้าสู่ระบบด้วย LINE
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (verifying) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground">กำลังตรวจสอบสิทธิ์...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
            <h2 className="text-lg font-semibold">เกิดข้อผิดพลาด</h2>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button onClick={handleBack} variant="outline" data-testid="button-back">
              <ArrowLeft className="h-4 w-4 mr-2" />
              กลับ
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasRequiredAccess = () => {
    if (appConfig?.access_level === "public") return true;
    if (!verification) return false;
    if (appConfig?.access_level === "member") return verification.isMember;
    if (appConfig?.access_level === "admin") return verification.isAdmin;
    return false;
  };

  if (appConfig.access_level === "admin" && verification && !verification.isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <Lock className="h-12 w-12 mx-auto text-muted-foreground" />
            <h2 className="text-lg font-semibold">สำหรับผู้ดูแลระบบเท่านั้น</h2>
            <p className="text-sm text-muted-foreground">
              แอปพลิเคชันนี้สำหรับผู้ดูแลระบบ Chapter เท่านั้น
            </p>
            <Button onClick={handleBack} variant="outline" data-testid="button-back">
              <ArrowLeft className="h-4 w-4 mr-2" />
              กลับ
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (appConfig.access_level === "member" && verification && !verification.isMember) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <Lock className="h-12 w-12 mx-auto text-muted-foreground" />
            <h2 className="text-lg font-semibold">สำหรับสมาชิกเท่านั้น</h2>
            <p className="text-sm text-muted-foreground">
              แอปพลิเคชันนี้สำหรับสมาชิก Chapter เท่านั้น
              กรุณาติดต่อ Admin เพื่อลงทะเบียนเป็นสมาชิก
            </p>
            <Button onClick={handleBack} variant="outline" data-testid="button-back">
              <ArrowLeft className="h-4 w-4 mr-2" />
              กลับ
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!AppComponent) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
            <h2 className="text-lg font-semibold">แอปยังไม่พร้อมใช้งาน</h2>
            <p className="text-sm text-muted-foreground">
              แอปพลิเคชันนี้ยังไม่พร้อมใช้งานในขณะนี้
            </p>
            <Button onClick={handleBack} variant="outline" data-testid="button-back">
              <ArrowLeft className="h-4 w-4 mr-2" />
              กลับ
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-primary text-primary-foreground p-3 flex items-center gap-3 sticky top-0 z-50">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleBack}
          className="text-primary-foreground hover:bg-primary/80"
          data-testid="button-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="font-semibold" data-testid="text-app-name">{appConfig.name}</h1>
          {verification?.participant && (
            <p className="text-xs opacity-80">
              {verification.participant.nickname_th || verification.participant.full_name_th}
            </p>
          )}
        </div>
      </div>
      
      <Suspense
        fallback={
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        }
      >
        <AppComponent 
          isLiff={true} 
          tenantId={verification?.tenant?.tenant_id || tenantId}
          participantId={verification?.participant?.participant_id}
        />
      </Suspense>
    </div>
  );
}
