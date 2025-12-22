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
import { Loader2, User, Lock, CheckCircle2, AlertCircle, LayoutGrid, Calculator, ArrowRight } from "lucide-react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Link } from "react-router-dom";

export default function Profile() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [uploading, setUploading] = useState(false);
  
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

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;

      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error("กรุณาเลือกไฟล์รูปภาพ");
        return;
      }

      // Validate file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        toast.error("ไฟล์ต้องมีขนาดไม่เกิน 2MB");
        return;
      }

      setUploading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("ไม่พบข้อมูลผู้ใช้");

      // Delete old avatar if exists
      if (profile?.avatar_url) {
        const oldPath = profile.avatar_url.split('/').pop();
        if (oldPath) {
          await supabase.storage
            .from('avatars')
            .remove([`${user.id}/${oldPath}`]);
        }
      }

      // Upload new avatar
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      toast.success("อัปโหลดรูปโปรไฟล์สำเร็จ");
      loadProfile();
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      toast.error(error.message || "ไม่สามารถอัปโหลดรูปภาพได้");
    } finally {
      setUploading(false);
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
              <div className="flex flex-col items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={uploading}
                  onClick={() => document.getElementById('avatar-upload')?.click()}
                >
                  {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {uploading ? "กำลังอัปโหลด..." : "อัปโหลดรูปภาพ"}
                </Button>
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
                <p className="text-xs text-muted-foreground text-center">
                  JPG, PNG หรือ WEBP (สูงสุด 2MB)
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>ข้อมูลบัญชี</CardTitle>
              <CardDescription>แก้ไขข้อมูลส่วนตัวและตั้งค่าความปลอดภัย</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="profile" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="profile" data-testid="tab-profile">
                    <User className="mr-2 h-4 w-4" />
                    ข้อมูลส่วนตัว
                  </TabsTrigger>
                  <TabsTrigger value="password" data-testid="tab-password">
                    <Lock className="mr-2 h-4 w-4" />
                    เปลี่ยนรหัสผ่าน
                  </TabsTrigger>
                  <TabsTrigger value="apps" data-testid="tab-apps">
                    <LayoutGrid className="mr-2 h-4 w-4" />
                    Apps
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

                <TabsContent value="apps" className="space-y-4">
                  <div className="text-sm text-muted-foreground mb-4">
                    เครื่องมือและแอปพลิเคชันที่พร้อมใช้งาน
                  </div>
                  
                  <div className="grid gap-4">
                    <Link to="/apps/boq-estimator" data-testid="link-app-boq">
                      <Card className="hover-elevate cursor-pointer">
                        <CardContent className="flex items-center gap-4 p-4">
                          <div className="h-12 w-12 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                            <Calculator className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold">BOQ Estimator</h3>
                            <p className="text-sm text-muted-foreground">
                              ประเมินราคางานก่อสร้างเบื้องต้น
                            </p>
                          </div>
                          <ArrowRight className="h-5 w-5 text-muted-foreground" />
                        </CardContent>
                      </Card>
                    </Link>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
