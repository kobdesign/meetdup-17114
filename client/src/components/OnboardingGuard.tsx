import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, LogIn } from "lucide-react";
import { useUserTenantInfo } from "@/hooks/useUserTenantInfo";

interface OnboardingGuardProps {
  children: React.ReactNode;
}

export function OnboardingGuard({ children }: OnboardingGuardProps) {
  const navigate = useNavigate();
  const { data: userInfo, isLoading } = useUserTenantInfo();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!userInfo?.userId) {
    const currentPath = window.location.pathname;
    const redirectUrl = `/auth?redirect=${encodeURIComponent(currentPath)}`;

    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <LogIn className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>กรุณาเข้าสู่ระบบ</CardTitle>
            <CardDescription>
              คุณต้องเข้าสู่ระบบก่อนดำเนินการต่อ
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={() => navigate(redirectUrl)}
              className="w-full"
              data-testid="button-login"
            >
              <LogIn className="mr-2 h-4 w-4" />
              เข้าสู่ระบบ
            </Button>
            <Button
              variant="ghost"
              onClick={() => navigate("/welcome")}
              className="w-full"
              data-testid="button-back-welcome"
            >
              ย้อนกลับหน้าหลัก
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
