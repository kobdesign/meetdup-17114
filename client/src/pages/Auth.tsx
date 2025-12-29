import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Mail, CheckCircle2, AlertCircle } from "lucide-react";
import { MeetdupLogo } from "@/components/MeetdupLogo";

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [activeTab, setActiveTab] = useState("signin");
  const [showEmailExists, setShowEmailExists] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [showForgotPasswordDialog, setShowForgotPasswordDialog] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);

  // Get redirect parameter from URL
  const getRedirectPath = () => {
    return searchParams.get('redirect');
  };

  // Get plan selection from URL (from pricing page)
  const getPlanSelection = () => {
    const plan = searchParams.get('plan');
    const billing = searchParams.get('billing') || 'monthly';
    if (plan && plan !== 'free') {
      return { plan, billing };
    }
    return null;
  };

  // Save plan selection to localStorage for use after chapter creation
  const savePlanSelection = () => {
    const planSelection = getPlanSelection();
    if (planSelection) {
      localStorage.setItem('pendingPlanUpgrade', JSON.stringify(planSelection));
      console.log("[Auth] Saved pending plan upgrade:", planSelection);
    }
  };

  useEffect(() => {
    const redirectPath = getRedirectPath();
    
    // Save plan selection from URL params (if coming from pricing page)
    savePlanSelection();
    
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
    // Sync user metadata (full_name, phone) to profiles table - only update fields with values
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.user_metadata) {
        const { full_name, phone } = user.user_metadata;
        
        // Only sync if we have new data to add
        if (full_name || phone) {
          // Build update object with only non-null values to avoid overwriting existing data
          const updateData: Record<string, string> = {
            updated_at: new Date().toISOString(),
          };
          if (full_name) updateData.full_name = full_name;
          if (phone) updateData.phone = phone;
          
          console.log("[Auth] Syncing user metadata to profiles:", updateData);
          
          // First check if profile exists
          const { data: existingProfile } = await supabase
            .from("profiles")
            .select("id")
            .eq("id", userId)
            .single();
          
          if (existingProfile) {
            // Update only the fields we have
            await supabase
              .from("profiles")
              .update(updateData)
              .eq("id", userId);
          } else {
            // Create new profile with available data
            await supabase
              .from("profiles")
              .insert({ id: userId, ...updateData });
          }
        }
      }
    } catch (err) {
      console.warn("[Auth] Failed to sync profile metadata:", err);
    }

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

    // Check for pending plan upgrade - if user has a tenant, redirect to checkout
    const pendingUpgrade = localStorage.getItem('pendingPlanUpgrade');
    const userTenantId = roles.find(r => r.tenant_id)?.tenant_id;
    
    if (pendingUpgrade && userTenantId) {
      try {
        const { plan, billing } = JSON.parse(pendingUpgrade);
        console.log("[Auth] Found pending plan upgrade for existing tenant:", plan, billing);
        
        // Get auth token for authenticated API calls
        const { data: sessionData } = await supabase.auth.getSession();
        const authToken = sessionData?.session?.access_token;
        const authHeaders = authToken 
          ? { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` }
          : { 'Content-Type': 'application/json' };
        
        // Fetch plan prices to get the correct price ID
        const plansResponse = await fetch('/api/subscriptions/plans', { headers: authHeaders });
        const plansData = await plansResponse.json();
        const selectedPlan = plansData.plans?.find((p: any) => p.id === plan);
        const priceId = billing === 'yearly' 
          ? selectedPlan?.prices.yearly.id 
          : selectedPlan?.prices.monthly.id;
        
        if (priceId) {
          console.log("[Auth] Starting checkout with priceId:", priceId);
          const checkoutResponse = await fetch('/api/subscriptions/checkout', {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({ tenantId: userTenantId, priceId: priceId })
          });
          const checkoutData = await checkoutResponse.json();
          
          if (checkoutData?.url) {
            localStorage.removeItem('pendingPlanUpgrade');
            window.location.href = checkoutData.url;
            return;
          }
        }
        // If checkout fails, redirect to billing page where user can see retry banner
        toast.error("ไม่สามารถเริ่มกระบวนการชำระเงินได้ กรุณาลองใหม่จากหน้า Billing");
        navigate("/admin/billing");
        return;
      } catch (error) {
        console.error("[Auth] Error processing pending upgrade:", error);
        toast.error("เกิดข้อผิดพลาดในการอัพเกรดแพลน");
        navigate("/admin/billing");
        return;
      }
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
    setShowEmailExists(false);

    // Validate phone
    const normalizedPhone = phone.replace(/\D/g, "");
    if (normalizedPhone.length < 9 || normalizedPhone.length > 10) {
      toast.error("กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง (9-10 หลัก)");
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { 
            full_name: fullName,
            phone: normalizedPhone,
          },
        },
      });

      if (error) throw error;

      console.log("[Auth] SignUp response:", { 
        user: data.user?.id, 
        session: !!data.session,
        identities: data.user?.identities?.length 
      });

      // Check if email already exists (Supabase returns user with empty identities)
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        console.log("[Auth] Email already exists, prompting to login");
        setShowEmailExists(true);
        return;
      }

      if (data.user && data.session) {
        // User is auto-confirmed, proceed directly
        console.log("[Auth] Registration successful, proceeding with login");
        toast.success("ลงทะเบียนสำเร็จ!");
        const redirectPath = getRedirectPath();
        await checkUserRole(data.user.id, redirectPath);
      } else if (data.user) {
        // Fallback: try immediate sign in (for edge cases)
        console.log("[Auth] No session returned, attempting immediate sign in");
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (signInData?.session) {
          console.log("[Auth] Immediate sign in successful");
          toast.success("ลงทะเบียนสำเร็จ!");
          const redirectPath = getRedirectPath();
          await checkUserRole(signInData.user.id, redirectPath);
        } else {
          // This shouldn't happen if email confirmation is disabled
          console.error("[Auth] Sign in failed:", signInError?.message);
          toast.error("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
        }
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotPasswordEmail) {
      toast.error("กรุณากรอกอีเมล");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(forgotPasswordEmail)) {
      toast.error("กรุณากรอกอีเมลให้ถูกต้อง");
      return;
    }

    setLoading(true);

    try {
      console.log("[Auth] Sending password reset email to:", forgotPasswordEmail);
      const { error } = await supabase.auth.resetPasswordForEmail(forgotPasswordEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;
      
      console.log("[Auth] Password reset email sent successfully");
      setResetEmailSent(true);
      toast.success("ส่งลิงก์รีเซ็ตรหัสผ่านไปที่อีเมลแล้ว");
    } catch (error: any) {
      console.error("[Auth] Password reset error:", error);
      toast.error(error.message || "เกิดข้อผิดพลาด กรุณาลองใหม่");
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
          <MeetdupLogo size="lg" variant="dark" className="justify-center" />
          <CardDescription className="text-center">
            เข้าสู่ระบบเพื่อจัดการชาปเตอร์ หรือสร้างบัญชีใหม่
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin" data-testid="tab-signin">เข้าสู่ระบบ</TabsTrigger>
              <TabsTrigger value="signup" data-testid="tab-signup">ลงทะเบียน</TabsTrigger>
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
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="forgot-email">อีเมล</Label>
                              <Input
                                id="forgot-email"
                                type="email"
                                placeholder="your@email.com"
                                value={forgotPasswordEmail}
                                onChange={(e) => setForgotPasswordEmail(e.target.value)}
                                data-testid="input-forgot-email"
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                className="flex-1"
                                onClick={() => setShowForgotPasswordDialog(false)}
                                data-testid="button-cancel-forgot"
                              >
                                ยกเลิก
                              </Button>
                              <Button 
                                type="button" 
                                className="flex-1" 
                                disabled={loading || !forgotPasswordEmail}
                                onClick={handleForgotPassword}
                                data-testid="button-send-reset-link"
                              >
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                ส่งลิงก์
                              </Button>
                            </div>
                          </div>
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
              {showEmailExists ? (
                <div className="space-y-4 py-4">
                  <Alert className="border-amber-500/20 bg-amber-500/5">
                    <AlertCircle className="h-5 w-5 text-amber-600" />
                    <AlertDescription className="mt-2 space-y-2">
                      <div className="flex items-start gap-2">
                        <div>
                          <p className="font-semibold text-foreground">อีเมลนี้มีบัญชีอยู่แล้ว</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            อีเมล <span className="font-medium text-foreground">{email}</span> ลงทะเบียนไว้แล้ว กรุณาเข้าสู่ระบบด้วยรหัสผ่านเดิม
                          </p>
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>
                  
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setShowEmailExists(false)}
                      data-testid="button-back-to-signup"
                    >
                      ลองใหม่
                    </Button>
                    <Button
                      type="button"
                      variant="default"
                      className="flex-1"
                      onClick={() => {
                        setShowEmailExists(false);
                        setActiveTab("signin");
                      }}
                      data-testid="button-go-to-signin"
                    >
                      เข้าสู่ระบบ
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
                      data-testid="input-fullname"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">เบอร์โทรศัพท์</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="0812345678"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                      data-testid="input-phone"
                    />
                    <p className="text-xs text-muted-foreground">
                      ใช้สำหรับเชื่อมต่อกับ LINE Official Account
                    </p>
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
                      data-testid="input-signup-email"
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
                      data-testid="input-signup-password"
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading} data-testid="button-signup">
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    ลงทะเบียน
                  </Button>
                </form>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
