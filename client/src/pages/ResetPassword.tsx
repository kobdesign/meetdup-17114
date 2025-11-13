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

  useEffect(() => {
    // Check if we have a valid recovery token
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setValidToken(true);
      } else {
        setValidToken(false);
      }
    });
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
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) throw error;

      toast.success("เปลี่ยนรหัสผ่านสำเร็จ");
      
      // Redirect to login after successful password reset
      setTimeout(() => {
        navigate("/auth");
      }, 2000);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (validToken === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
