import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Mail, CheckCircle2 } from "lucide-react";

export default function Auth() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showEmailSent, setShowEmailSent] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [showForgotPasswordDialog, setShowForgotPasswordDialog] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);

  // Get redirect parameter from URL
  const getRedirectPath = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get('redirect');
  };

  useEffect(() => {
    const redirectPath = getRedirectPath();
    
    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        checkUserRole(session.user.id, redirectPath);
      }
    });

    // Listen for auth state changes (handles email confirmation callback)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[Auth] Auth state changed:", event, "Session:", !!session);
      
      if (event === 'SIGNED_IN' && session) {
        console.log("[Auth] User signed in, checking role...");
        checkUserRole(session.user.id, redirectPath);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const checkUserRole = async (userId: string, redirectPath?: string | null) => {
    // If there's a redirect path (e.g., /invite/:token), use it
    if (redirectPath) {
      console.log("[Auth] Redirecting to:", redirectPath);
      navigate(redirectPath);
      return;
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role, tenant_id")
      .eq("user_id", userId);

    // If no roles assigned, redirect to welcome page
    if (!roles || roles.length === 0) {
      navigate("/welcome");
      return;
    }

    // Check if user is super admin
    const isSuperAdmin = roles.some(r => r.role === "super_admin");
    if (isSuperAdmin) {
      navigate("/super-admin/tenants");
    } else {
      navigate("/admin");
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: `${window.location.origin}/auth`,
        },
      });

      if (error) throw error;

      if (data.user) {
        setShowEmailSent(true);
        toast.success("กรุณาตรวจสอบอีเมลเพื่อยืนยันบัญชี");
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmail = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      });
      
      if (error) throw error;
      toast.success("ส่งอีเมลยืนยันใหม่แล้ว");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotPasswordEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;
      
      setResetEmailSent(true);
      toast.success("ส่งลิงก์รีเซ็ตรหัสผ่านไปที่อีเมลแล้ว");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        const redirectPath = getRedirectPath();
        await checkUserRole(data.user.id, redirectPath);
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">BNI Chapter Management</CardTitle>
          <CardDescription>
            เข้าสู่ระบบเพื่อจัดการชาปเตอร์ หรือสร้างบัญชีใหม่
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">เข้าสู่ระบบ</TabsTrigger>
              <TabsTrigger value="signup">ลงทะเบียน</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">อีเมล</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">รหัสผ่าน</Label>
                    <Dialog open={showForgotPasswordDialog} onOpenChange={setShowForgotPasswordDialog}>
                      <DialogTrigger asChild>
                        <Button 
                          type="button" 
                          variant="link" 
                          className="h-auto p-0 text-xs text-primary"
                          onClick={() => setResetEmailSent(false)}
                        >
                          ลืมรหัสผ่าน?
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle>รีเซ็ตรหัสผ่าน</DialogTitle>
                          <DialogDescription>
                            กรอกอีเมลของคุณ เราจะส่งลิงก์สำหรับรีเซ็ตรหัสผ่านให้
                          </DialogDescription>
                        </DialogHeader>
                        {resetEmailSent ? (
                          <Alert className="border-primary/20 bg-primary/5">
                            <Mail className="h-5 w-5 text-primary" />
                            <AlertDescription className="mt-2">
                              <div className="flex items-start gap-2">
                                <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                                <div>
                                  <p className="font-semibold text-foreground">ส่งอีเมลแล้ว!</p>
                                  <p className="text-sm text-muted-foreground mt-1">
                                    ตรวจสอบอีเมล <span className="font-medium text-foreground">{forgotPasswordEmail}</span> เพื่อรีเซ็ตรหัสผ่าน
                                  </p>
                                </div>
                              </div>
                            </AlertDescription>
                          </Alert>
                        ) : (
                          <form onSubmit={handleForgotPassword} className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="forgot-email">อีเมล</Label>
                              <Input
                                id="forgot-email"
                                type="email"
                                placeholder="your@email.com"
                                value={forgotPasswordEmail}
                                onChange={(e) => setForgotPasswordEmail(e.target.value)}
                                required
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                className="flex-1"
                                onClick={() => setShowForgotPasswordDialog(false)}
                              >
                                ยกเลิก
                              </Button>
                              <Button type="submit" className="flex-1" disabled={loading}>
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                ส่งลิงก์
                              </Button>
                            </div>
                          </form>
                        )}
                      </DialogContent>
                    </Dialog>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  เข้าสู่ระบบ
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              {showEmailSent ? (
                <div className="space-y-4 py-4">
                  <Alert className="border-primary/20 bg-primary/5">
                    <Mail className="h-5 w-5 text-primary" />
                    <AlertDescription className="mt-2 space-y-2">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-foreground">ส่งอีเมลยืนยันแล้ว!</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            เราได้ส่งลิงก์ยืนยันไปที่ <span className="font-medium text-foreground">{email}</span>
                          </p>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground pl-7">
                        <p>กรุณาตรวจสอบกล่องจดหมายของคุณและคลิกลิงก์ยืนยันเพื่อเปิดใช้งานบัญชี</p>
                        <p className="mt-2">ไม่ได้รับอีเมล?</p>
                      </div>
                    </AlertDescription>
                  </Alert>
                  
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={handleResendEmail}
                      disabled={loading}
                    >
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      ส่งอีเมลใหม่
                    </Button>
                    <Button
                      type="button"
                      variant="default"
                      className="flex-1"
                      onClick={() => setShowEmailSent(false)}
                    >
                      ย้อนกลับ
                    </Button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullname">ชื่อ-นามสกุล</Label>
                    <Input
                      id="fullname"
                      type="text"
                      placeholder="ชื่อ นามสกุล"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">อีเมล</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">รหัสผ่าน</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="อย่างน้อย 6 ตัวอักษร"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    ลงทะเบียน
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    เมื่อลงทะเบียน คุณจะได้รับอีเมลยืนยันบัญชี
                  </p>
                </form>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
