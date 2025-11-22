import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
  const [validating, setValidating] = useState(false);
  const [participant, setParticipant] = useState<ParticipantInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState<string>("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      setError("Missing activation token");
      setLoading(false);
      return;
    }

    console.log("🔍 [Activate] Validating token...");
    
    fetch(`/api/participants/validate-token/${token}`)
      .then((response) => response.json())
      .then((data: ValidationResponse) => {
        if (!data.success) {
          setError(data.error || "Invalid activation link");
          setLoading(false);
          return;
        }

        console.log("✅ [Activate] Token validated");
        
        // Store participant info
        setParticipant(data.participant!);
        setTenantId(data.tenantId!);
        setTenantName(data.tenantName || "");

        // Pre-fill email if available
        if (data.participant?.email) {
          setEmail(data.participant.email);
        }

        // Check for existing account
        if (data.existingAccount) {
          setError("คุณมีบัญชีอยู่แล้ว กรุณาเข้าสู่ระบบผ่านเว็บไซต์");
          setLoading(false);
          return;
        }

        setLoading(false);
      })
      .catch((err) => {
        console.error("❌ [Activate] Token validation failed:", err);
        setError("ไม่สามารถตรวจสอบลิงก์ได้");
        setLoading(false);
      });
  }, [token]);

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

    try {
      setValidating(true);

      const response = await fetch("/api/participants/activate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        toast.error(data.error || "ไม่สามารถสร้างบัญชีได้");
        return;
      }

      // Success!
      toast.success(`สร้างบัญชีสำเร็จ! ยินดีต้อนรับสู่ ${tenantName}`);

      // Redirect to login page after 2 seconds
      setTimeout(() => {
        navigate("/auth");
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
            <p className="text-muted-foreground">กำลังตรวจสอบลิงก์...</p>
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
                "สร้างบัญชี"
              )}
            </Button>
          </form>

          <div className="mt-4 text-center text-xs text-muted-foreground">
            <p>บัญชีของคุณจะถูกเชื่อมต่อกับเบอร์โทรศัพท์โดยอัตโนมัติ</p>
            <p className="mt-2">หากคุณมี LINE คุณสามารถเชื่อมต่อได้ภายหลังผ่าน LINE แชท</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
