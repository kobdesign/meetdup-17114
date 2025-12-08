import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [validToken, setValidToken] = useState<boolean | null>(null);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  useEffect(() => {
    console.log("[ResetPassword] Initializing...");
    console.log("[ResetPassword] Current URL:", window.location.href);
    console.log("[ResetPassword] Hash:", window.location.hash);
    
    // Listen for auth state changes - this catches PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[ResetPassword] Auth event:", event, "Session:", !!session);
      
      if (event === "PASSWORD_RECOVERY") {
        console.log("[ResetPassword] Password recovery event received");
        setIsRecoveryMode(true);
        setValidToken(true);
      } else if (event === "SIGNED_IN" && session) {
        // User might already be in recovery mode from URL hash
        console.log("[ResetPassword] Signed in, checking if recovery mode");
        setValidToken(true);
      }
    });

    // Check URL hash for recovery token (Supabase puts tokens in hash fragment)
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get("access_token");
    const type = hashParams.get("type");
    
    console.log("[ResetPassword] Hash params - type:", type, "has access_token:", !!accessToken);
    
    if (type === "recovery" && accessToken) {
      console.log("[ResetPassword] Recovery token found in URL, setting session...");
      setIsRecoveryMode(true);
      
      // Supabase will automatically pick up the token from the hash
      // Just wait a moment for it to process
      const checkSession = async () => {
        // Give Supabase time to process the hash
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const { data: { session }, error } = await supabase.auth.getSession();
        console.log("[ResetPassword] Session check result:", !!session, error?.message);
        
        if (session) {
          setValidToken(true);
        } else {
          // Try to set session manually from hash
          const refreshToken = hashParams.get("refresh_token");
          if (accessToken && refreshToken) {
            console.log("[ResetPassword] Attempting to set session from tokens...");
            const { data, error: setError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            
            if (data.session) {
              console.log("[ResetPassword] Session set successfully");
              setValidToken(true);
            } else {
              console.error("[ResetPassword] Failed to set session:", setError);
              setValidToken(false);
            }
          } else {
            setValidToken(false);
          }
        }
      };
      
      checkSession();
    } else {
      // No recovery token in URL, check existing session
      supabase.auth.getSession().then(({ data: { session } }) => {
        console.log("[ResetPassword] Existing session check:", !!session);
        if (session) {
          setValidToken(true);
        } else {
          // Wait a bit more in case auth is still initializing
          setTimeout(() => {
            supabase.auth.getSession().then(({ data: { session: retrySession } }) => {
              console.log("[ResetPassword] Retry session check:", !!retrySession);
              setValidToken(!!retrySession);
            });
          }, 1000);
        }
      });
    }

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error("รหัสผ่านไม่ตรงกัน");
      return;
    }

    if (password.length < 6) {
      toast.error("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      return;
    }

    setLoading(true);

    try {
      console.log("[ResetPassword] Updating password...");
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        console.error("[ResetPassword] Update error:", error);
        throw error;
      }

      console.log("[ResetPassword] Password updated successfully");
      toast.success("เปลี่ยนรหัสผ่านสำเร็จ");
      setResetSuccess(true);
      
      // Sign out and redirect to login after successful password reset
      await supabase.auth.signOut();
      
      setTimeout(() => {
        navigate("/auth");
      }, 3000);
    } catch (error: any) {
      console.error("[ResetPassword] Error:", error);
      // Handle specific error messages
      if (error.message?.includes("same_password")) {
        toast.error("รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม");
      } else if (error.message?.includes("weak_password")) {
        toast.error("รหัสผ่านไม่ปลอดภัยเพียงพอ กรุณาใช้รหัสผ่านที่ซับซ้อนกว่านี้");
      } else {
        toast.error(error.message || "เกิดข้อผิดพลาด กรุณาลองใหม่");
      }
    } finally {
      setLoading(false);
    }
  };

  if (validToken === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">กำลังตรวจสอบลิงก์...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (validToken === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold">ลิงก์ไม่ถูกต้อง</CardTitle>
            <CardDescription>
              ลิงก์รีเซ็ตรหัสผ่านนี้หมดอายุหรือไม่ถูกต้อง
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                กรุณาขอลิงก์รีเซ็ตรหัสผ่านใหม่จากหน้าเข้าสู่ระบบ
              </AlertDescription>
            </Alert>
            <Button 
              className="w-full" 
              onClick={() => navigate("/auth")}
            >
              กลับไปหน้าเข้าสู่ระบบ
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (resetSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              เปลี่ยนรหัสผ่านสำเร็จ
            </CardTitle>
            <CardDescription>
              รหัสผ่านของคุณถูกเปลี่ยนเรียบร้อยแล้ว
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="border-green-500/20 bg-green-500/5">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700">
                กำลังนำคุณไปยังหน้าเข้าสู่ระบบ...
              </AlertDescription>
            </Alert>
            <Button 
              className="w-full" 
              onClick={() => navigate("/auth")}
            >
              เข้าสู่ระบบทันที
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">ตั้งรหัสผ่านใหม่</CardTitle>
          <CardDescription>
            กรอกรหัสผ่านใหม่ของคุณ
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">รหัสผ่านใหม่</Label>
              <Input
                id="password"
                type="password"
                placeholder="อย่างน้อย 6 ตัวอักษร"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">ยืนยันรหัสผ่าน</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="กรอกรหัสผ่านอีกครั้ง"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            
            {password && confirmPassword && password !== confirmPassword && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  รหัสผ่านไม่ตรงกัน
                </AlertDescription>
              </Alert>
            )}

            {password && confirmPassword && password === confirmPassword && (
              <Alert className="border-primary/20 bg-primary/5">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <AlertDescription className="text-primary">
                  รหัสผ่านตรงกัน
                </AlertDescription>
              </Alert>
            )}

            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading || password !== confirmPassword}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              เปลี่ยนรหัสผ่าน
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
