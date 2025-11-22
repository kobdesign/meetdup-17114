import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import liff from "@line/liff";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface ParticipantInfo {
  participant_id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  phone: string;
  email?: string;
}

interface ValidationResponse {
  success: boolean;
  participant?: ParticipantInfo;
  tenantId?: string;
  tenantName?: string;
  existingAccount?: boolean;
  error?: string;
}

export default function LineActivate() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [liffReady, setLiffReady] = useState(false);
  const [validating, setValidating] = useState(false);
  const [participant, setParticipant] = useState<ParticipantInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState<string>("");
  const [lineUserId, setLineUserId] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Initialize LIFF
  useEffect(() => {
    const liffId = import.meta.env.VITE_LIFF_ID;
    
    if (!liffId) {
      setError("LIFF configuration missing");
      setLoading(false);
      return;
    }

    liff
      .init({ liffId })
      .then(() => {
        console.log("LIFF initialized");
        setLiffReady(true);

        // Get LINE user profile
        if (liff.isLoggedIn()) {
          liff.getProfile().then((profile) => {
            console.log("LINE Profile:", profile);
            setLineUserId(profile.userId);
          }).catch((err) => {
            console.error("Failed to get LINE profile:", err);
          });
        } else {
          // Redirect to LINE login
          liff.login();
        }
      })
      .catch((err) => {
        console.error("LIFF initialization failed:", err);
        setError("ไม่สามารถเชื่อมต่อ LINE ได้");
        setLoading(false);
      });
  }, []);

  // Validate token after LIFF is ready
  useEffect(() => {
    if (!liffReady || !token) return;
    validateToken();
  }, [liffReady, token]);

  const validateToken = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/participants/validate-token/${token}`);
      const data: ValidationResponse = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || "ลิงก์ไม่ถูกต้องหรือหมดอายุ");
        return;
      }

      // Check if already has account
      if (data.existingAccount) {
        setError("คุณมีบัญชีอยู่แล้ว กรุณาเข้าสู่ระบบผ่านเว็บไซต์");
        return;
      }

      setParticipant(data.participant!);
      setTenantId(data.tenantId!);
      setTenantName(data.tenantName || "");

      // Pre-fill email if available
      if (data.participant?.email) {
        setEmail(data.participant.email);
      }
    } catch (err: any) {
      console.error("Validation error:", err);
      setError("ไม่สามารถตรวจสอบลิงก์ได้");
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form
    if (!email || !password || !confirmPassword) {
      toast.error("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("รหัสผ่านไม่ตรงกัน");
      return;
    }

    if (password.length < 6) {
      toast.error("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      return;
    }

    if (!lineUserId) {
      toast.error("ไม่สามารถเชื่อมต่อ LINE ได้");
      return;
    }

    try {
      setValidating(true);

      const response = await fetch("/api/participants/activate-via-line", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          email,
          password,
          line_user_id: lineUserId,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        toast.error(data.error || "ไม่สามารถสร้างบัญชีได้");
        return;
      }

      // Success!
      toast.success(`สร้างบัญชีสำเร็จ! ยินดีต้อนรับสู่ ${tenantName}`);

      // Close LIFF window after 2 seconds
      setTimeout(() => {
        if (liff.isInClient()) {
          liff.closeWindow();
        } else {
          // Redirect to login page if opened in external browser
          window.location.href = "/auth";
        }
      }, 2000);
    } catch (err: any) {
      console.error("Activation error:", err);
      toast.error("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    } finally {
      setValidating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">กำลังเชื่อมต่อ LINE...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !participant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <XCircle className="h-6 w-6 text-destructive" />
              <CardTitle>ไม่สามารถดำเนินการได้</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error || "ไม่พบข้อมูลการลงทะเบียน"}</AlertDescription>
            </Alert>
            <div className="mt-6 text-sm text-muted-foreground">
              <p>กรุณาติดต่อผู้ดูแลระบบเพื่อขอความช่วยเหลือ</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-6 w-6 text-primary" />
            <CardTitle>ลงทะเบียนบัญชีผู้ใช้</CardTitle>
          </div>
          <CardDescription>สวัสดี คุณ{participant.full_name}</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-6">
            <AlertDescription>
              <div className="text-sm space-y-1">
                <p>
                  <strong>ชื่อ:</strong> {participant.full_name}
                </p>
                <p>
                  <strong>เบอร์โทร:</strong> {participant.phone}
                </p>
                <p>
                  <strong>Chapter:</strong> {tenantName}
                </p>
              </div>
            </AlertDescription>
          </Alert>

          <form onSubmit={handleActivate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">
                อีเมล <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                data-testid="input-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                required
              />
              <p className="text-xs text-muted-foreground">
                ใช้สำหรับเข้าสู่ระบบและรับการแจ้งเตือน
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">รหัสผ่าน</Label>
              <Input
                id="password"
                data-testid="input-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="อย่างน้อย 6 ตัวอักษร"
                required
                minLength={6}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">ยืนยันรหัสผ่าน</Label>
              <Input
                id="confirmPassword"
                data-testid="input-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="ยืนยันรหัสผ่าน"
                required
                minLength={6}
              />
            </div>

            <Button
              data-testid="button-activate"
              type="submit"
              className="w-full"
              disabled={validating}
            >
              {validating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  กำลังสร้างบัญชี...
                </>
              ) : (
                "สร้างบัญชีและเชื่อมต่อ LINE"
              )}
            </Button>
          </form>

          <div className="mt-4 text-center text-xs text-muted-foreground">
            <p>บัญชีของคุณจะถูกเชื่อมต่อกับ LINE ID โดยอัตโนมัติ</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
