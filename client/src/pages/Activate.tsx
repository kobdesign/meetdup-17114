import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, XCircle, AlertCircle, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface ParticipantInfo {
  participant_id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email?: string;
  full_name?: string;
}

interface ValidationResponse {
  success: boolean;
  participant?: ParticipantInfo;
  tenantId?: string;
  tenantName?: string;
  existingAccount?: boolean;
  existingUserId?: string;
  existingUserName?: string;
  existingUserEmail?: string;
  existingUserTenants?: string[];
  error?: string;
}

export default function Activate() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [participant, setParticipant] = useState<ParticipantInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState<string>("");
  const [existingAccount, setExistingAccount] = useState(false);
  const [existingUserEmail, setExistingUserEmail] = useState<string>("");
  const [existingUserTenants, setExistingUserTenants] = useState<string[]>([]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      setError("ลิงก์ไม่ถูกต้อง");
      setLoading(false);
      return;
    }

    validateToken();
  }, [token]);

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

      setParticipant(data.participant!);
      setTenantId(data.tenantId!);
      setTenantName(data.tenantName || "");
      setExistingAccount(data.existingAccount || false);
      setExistingUserEmail(data.existingUserEmail || "");
      setExistingUserTenants(data.existingUserTenants || []);
      
      // Pre-fill form with participant or existing user data
      if (data.existingAccount && data.existingUserEmail) {
        // Existing account - pre-fill with registered email
        setEmail(data.existingUserEmail);
      } else if (data.participant?.email) {
        // New account - pre-fill with participant email if available
        setEmail(data.participant.email);
      }
      
      if (data.participant?.full_name) {
        setFullName(data.participant.full_name);
      } else if (data.participant?.first_name && data.participant?.last_name) {
        setFullName(`${data.participant.first_name} ${data.participant.last_name}`);
      }
    } catch (err: any) {
      console.error('Validation error:', err);
      setError("ไม่สามารถตรวจสอบลิงก์ได้");
    } finally {
      setLoading(false);
    }
  };

  const handleSignInToJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error("กรุณากรอกอีเมลและรหัสผ่าน");
      return;
    }

    try {
      setValidating(true);

      // Clear any stale session first
      await supabase.auth.signOut();

      // Sign in with Supabase
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        toast.error("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
        return;
      }

      if (!authData.session) {
        toast.error("ไม่สามารถเข้าสู่ระบบได้");
        return;
      }

      // Call join-existing API to link participant + create role
      const response = await fetch('/api/participants/join-existing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authData.session.access_token}`,
        },
        body: JSON.stringify({
          token,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        toast.error(data.error || "ไม่สามารถเข้าร่วม Chapter ได้");
        return;
      }

      toast.success(`เข้าร่วม ${tenantName} สำเร็จ!`);
      
      // Redirect to home
      setTimeout(() => {
        navigate('/');
      }, 1000);
    } catch (err: any) {
      console.error('Sign in error:', err);
      toast.error("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    } finally {
      setValidating(false);
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

    try {
      setValidating(true);

      // Clear any existing session first
      await supabase.auth.signOut();

      const response = await fetch('/api/participants/activate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          email,
          password,
          full_name: fullName,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        toast.error(data.error || "ไม่สามารถสร้างบัญชีได้");
        return;
      }

      // Auto-login with the new account
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        console.error('Auto-login error:', signInError);
        toast.success("สร้างบัญชีสำเร็จ! กรุณาเข้าสู่ระบบ");
        setTimeout(() => {
          navigate('/auth');
        }, 2000);
        return;
      }

      toast.success(`สร้างบัญชีสำเร็จ! ยินดีต้อนรับสู่ ${tenantName}`);
      
      // Redirect to home
      setTimeout(() => {
        navigate('/');
      }, 1000);
    } catch (err: any) {
      console.error('Activation error:', err);
      toast.error("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    } finally {
      setValidating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Card className="w-full max-w-md">
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
              <CardTitle>ลิงก์ไม่ถูกต้อง</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {error || "ไม่พบข้อมูลการลงทะเบียน"}
              </AlertDescription>
            </Alert>
            <div className="mt-6 text-sm text-muted-foreground">
              <p>กรุณาติดต่อผู้ดูแลระบบเพื่อขอลิงก์ลงทะเบียนใหม่</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show "Sign In to Join" page if user has existing account
  if (existingAccount) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <UserCheck className="h-6 w-6 text-primary" />
              <CardTitle>คุณมีบัญชีอยู่แล้ว</CardTitle>
            </div>
            <CardDescription>
              เบอร์โทร {participant.phone} มีบัญชีผู้ใช้แล้ว
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert className="mb-6">
              <AlertDescription>
                <div className="text-sm space-y-2">
                  <p><strong>ชื่อ:</strong> {participant.full_name || `${participant.first_name} ${participant.last_name}`}</p>
                  {existingUserEmail && (
                    <p><strong>อีเมล:</strong> {existingUserEmail}</p>
                  )}
                  <p><strong>คุณเคยเป็นสมาชิก:</strong></p>
                  <ul className="list-disc list-inside ml-2 space-y-1">
                    {existingUserTenants.map((tenant, idx) => (
                      <li key={idx}>{tenant}</li>
                    ))}
                  </ul>
                  <p className="mt-3 font-semibold text-primary">
                    ✅ ต้องการเข้าร่วม "{tenantName}" ด้วยหรือไม่?
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    กรุณา Sign in ด้วยอีเมลและรหัสผ่านที่เคยสมัครไว้
                  </p>
                </div>
              </AlertDescription>
            </Alert>

            <form onSubmit={handleSignInToJoin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">อีเมล</Label>
                <Input
                  id="email"
                  data-testid="input-email-signin"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={existingUserEmail || "email@example.com"}
                  required
                  readOnly={!!existingUserEmail}
                  className={existingUserEmail ? "bg-muted" : ""}
                />
                {existingUserEmail && (
                  <p className="text-xs text-muted-foreground">
                    อีเมลที่คุณเคยลงทะเบียนไว้
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">รหัสผ่าน</Label>
                <Input
                  id="password"
                  data-testid="input-password-signin"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="รหัสผ่านของคุณ"
                  required
                />
              </div>

              <Button
                data-testid="button-signin-to-join"
                type="submit"
                className="w-full"
                disabled={validating}
              >
                {validating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    กำลังเข้าสู่ระบบ...
                  </>
                ) : (
                  `Sign In เพื่อเข้าร่วม ${tenantName}`
                )}
              </Button>
            </form>

            <div className="mt-4 text-center text-sm text-muted-foreground">
              ลืมรหัสผ่าน?{" "}
              <a href="/auth" className="text-primary hover:underline">
                รีเซ็ตรหัสผ่าน
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show normal activation form for new users
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-6 w-6 text-primary" />
            <CardTitle>ลงทะเบียนบัญชีผู้ใช้</CardTitle>
          </div>
          <CardDescription>
            สวัสดี คุณ{participant.full_name || `${participant.first_name} ${participant.last_name}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-6">
            <AlertDescription>
              <div className="text-sm space-y-1">
                <p><strong>ชื่อ:</strong> {participant.full_name || `${participant.first_name} ${participant.last_name}`}</p>
                <p><strong>เบอร์โทร:</strong> {participant.phone}</p>
                <p><strong>Chapter:</strong> {tenantName}</p>
              </div>
            </AlertDescription>
          </Alert>

          <form onSubmit={handleActivate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">ชื่อ-สกุล</Label>
              <Input
                id="fullName"
                data-testid="input-fullname"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="ชื่อ-สกุล"
                required
              />
            </div>

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

          <div className="mt-4 text-center text-sm text-muted-foreground">
            มีบัญชีอยู่แล้ว?{" "}
            <a href="/auth" className="text-primary hover:underline">
              เข้าสู่ระบบ
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
