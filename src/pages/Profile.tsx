import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, User, Lock, CheckCircle2, AlertCircle } from "lucide-react";
import AdminLayout from "@/components/layout/AdminLayout";

export default function Profile() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  
  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }

      setEmail(user.email || "");

      const { data: profileData, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (profileData) {
        setProfile(profileData);
        setFullName(profileData.full_name || "");
        setPhone(profileData.phone || "");
      }
    } catch (error: any) {
      console.error("Error loading profile:", error);
      toast.error("ไม่สามารถโหลดข้อมูลโปรไฟล์ได้");
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error("ไม่พบข้อมูลผู้ใช้");

      const { error } = await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          full_name: fullName,
          phone: phone,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      toast.success("อัปเดตโปรไฟล์สำเร็จ");
      loadProfile();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error("รหัสผ่านใหม่ไม่ตรงกัน");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast.success("เปลี่ยนรหัสผ่านสำเร็จ");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return "?";
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">โปรไฟล์ของฉัน</h1>
          <p className="text-muted-foreground">จัดการข้อมูลส่วนตัวและความปลอดภัยของบัญชี</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle>รูปโปรไฟล์</CardTitle>
              <CardDescription>อัปโหลดรูปประจำตัวของคุณ</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center space-y-4">
              <Avatar className="h-32 w-32">
                <AvatarImage src={profile?.avatar_url} />
                <AvatarFallback className="text-2xl">
                  {getInitials(fullName)}
                </AvatarFallback>
              </Avatar>
              <Button variant="outline" size="sm" disabled>
                อัปโหลดรูปภาพ (เร็วๆ นี้)
              </Button>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>ข้อมูลบัญชี</CardTitle>
              <CardDescription>แก้ไขข้อมูลส่วนตัวและตั้งค่าความปลอดภัย</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="profile" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="profile">
                    <User className="mr-2 h-4 w-4" />
                    ข้อมูลส่วนตัว
                  </TabsTrigger>
                  <TabsTrigger value="password">
                    <Lock className="mr-2 h-4 w-4" />
                    เปลี่ยนรหัสผ่าน
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="profile">
                  <form onSubmit={handleUpdateProfile} className="space-y-4">
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
                      <Label htmlFor="email">อีเมล</Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        disabled
                        className="bg-muted"
                      />
                      <p className="text-xs text-muted-foreground">
                        ไม่สามารถเปลี่ยนอีเมลได้ในขณะนี้
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">เบอร์โทรศัพท์</Label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="0812345678"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </div>
                    <Button type="submit" disabled={loading}>
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      บันทึกการเปลี่ยนแปลง
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="password">
                  <form onSubmit={handleChangePassword} className="space-y-4">
                    <Alert className="border-primary/20 bg-primary/5">
                      <AlertCircle className="h-4 w-4 text-primary" />
                      <AlertDescription className="text-primary">
                        รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร
                      </AlertDescription>
                    </Alert>

                    <div className="space-y-2">
                      <Label htmlFor="new-password">รหัสผ่านใหม่</Label>
                      <Input
                        id="new-password"
                        type="password"
                        placeholder="อย่างน้อย 6 ตัวอักษร"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        minLength={6}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirm-new-password">ยืนยันรหัสผ่านใหม่</Label>
                      <Input
                        id="confirm-new-password"
                        type="password"
                        placeholder="กรอกรหัสผ่านอีกครั้ง"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        minLength={6}
                      />
                    </div>

                    {newPassword && confirmPassword && newPassword !== confirmPassword && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>รหัสผ่านไม่ตรงกัน</AlertDescription>
                      </Alert>
                    )}

                    {newPassword && confirmPassword && newPassword === confirmPassword && (
                      <Alert className="border-primary/20 bg-primary/5">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                        <AlertDescription className="text-primary">
                          รหัสผ่านตรงกัน
                        </AlertDescription>
                      </Alert>
                    )}

                    <Button
                      type="submit"
                      disabled={loading || newPassword !== confirmPassword}
                    >
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      เปลี่ยนรหัสผ่าน
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
