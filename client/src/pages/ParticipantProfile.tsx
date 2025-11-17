import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Loader2, User, Building2, Phone, Mail, Globe, Upload, CheckCircle } from "lucide-react";
import imageCompression from "browser-image-compression";

interface ParticipantProfile {
  participant_id: string;
  full_name: string;
  email: string | null;
  phone: string;
  position: string | null;
  company: string | null;
  website_url: string | null;
  avatar_url: string | null;
  tenant_id: string;
  tenant_name?: string;
  logo_url?: string;
}

export default function ParticipantProfile() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profile, setProfile] = useState<ParticipantProfile | null>(null);
  const [token, setToken] = useState<string>("");
  
  // Form fields
  const [fullName, setFullName] = useState("");
  const [position, setPosition] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  useEffect(() => {
    // Get token from URL query params
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    
    if (!urlToken) {
      toast.error("ลิงก์ไม่ถูกต้อง - กรุณาเปิดจาก LINE");
      return;
    }
    
    setToken(urlToken);
    loadProfile(urlToken);
  }, []);

  const loadProfile = async (authToken: string) => {
    try {
      setLoading(true);
      
      const response = await fetch(`/api/participants/profile?token=${authToken}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || "ไม่สามารถโหลดข้อมูลได้");
      }
      
      setProfile(data.participant);
      setFullName(data.participant.full_name || "");
      setPosition(data.participant.position || "");
      setCompany(data.participant.company || "");
      setPhone(data.participant.phone || "");
      setEmail(data.participant.email || "");
      setWebsite(data.participant.website_url || "");
      setAvatarPreview(data.participant.avatar_url);
      
    } catch (error: any) {
      console.error("Error loading profile:", error);
      toast.error(error.message || "ไม่สามารถโหลดข้อมูลได้");
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

      // Validate file size (max 5MB before compression)
      if (file.size > 5 * 1024 * 1024) {
        toast.error("ไฟล์ต้องมีขนาดไม่เกิน 5MB");
        return;
      }

      setUploading(true);

      // Compress image
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 800,
        useWebWorker: true
      };
      
      const compressedFile = await imageCompression(file, options);
      
      // Create FormData
      const formData = new FormData();
      formData.append("avatar", compressedFile);

      // Upload avatar
      const response = await fetch(`/api/participants/profile/avatar?token=${token}`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "ไม่สามารถอัปโหลดรูปภาพได้");
      }

      setAvatarPreview(data.avatar_url);
      toast.success("อัปโหลดรูปโปรไฟล์สำเร็จ");
      
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      toast.error(error.message || "ไม่สามารถอัปโหลดรูปภาพได้");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await fetch(`/api/participants/profile?token=${token}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          full_name: fullName,
          position,
          company,
          phone,
          email,
          website_url: website,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "ไม่สามารถบันทึกข้อมูลได้");
      }

      toast.success("บันทึกข้อมูลสำเร็จ");
      setProfile(data.participant);
      
    } catch (error: any) {
      console.error("Error updating profile:", error);
      toast.error(error.message || "ไม่สามารถบันทึกข้อมูลได้");
    } finally {
      setSaving(false);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl mx-auto p-4 py-8">
        {/* Header with Chapter Branding */}
        {profile?.tenant_name && (
          <div className="mb-6 flex items-center gap-4">
            {profile.logo_url && (
              <img 
                src={profile.logo_url} 
                alt="Chapter Logo" 
                className="h-16 w-16 rounded object-cover"
              />
            )}
            <div>
              <h1 className="text-2xl font-bold">{profile.tenant_name}</h1>
              <p className="text-muted-foreground">แก้ไขข้อมูลส่วนตัว</p>
            </div>
          </div>
        )}

        {/* Success Alert */}
        {!loading && profile && (
          <Alert className="mb-6 border-primary/20 bg-primary/5">
            <CheckCircle className="h-4 w-4 text-primary" />
            <AlertDescription className="text-primary">
              คุณสามารถแก้ไขข้อมูลของคุณได้ที่นี่ ข้อมูลจะถูกแสดงในนามบัตร LINE
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 md:grid-cols-3">
          {/* Avatar Section */}
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle>รูปโปรไฟล์</CardTitle>
              <CardDescription>อัปโหลดรูปประจำตัว</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center space-y-4">
              <Avatar className="h-32 w-32">
                <AvatarImage src={avatarPreview || undefined} />
                <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                  {getInitials(fullName)}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col items-center gap-2 w-full">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={uploading}
                  onClick={() => document.getElementById('avatar-upload')?.click()}
                  className="w-full"
                  data-testid="button-upload-avatar"
                >
                  {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Upload className="mr-2 h-4 w-4" />
                  {uploading ? "กำลังอัปโหลด..." : "เลือกรูปภาพ"}
                </Button>
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                  data-testid="input-avatar"
                />
                <p className="text-xs text-muted-foreground text-center">
                  JPG, PNG (สูงสุด 5MB)<br />
                  จะถูก compress เป็น 1MB
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Profile Form */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>ข้อมูลส่วนตัว</CardTitle>
              <CardDescription>แก้ไขข้อมูลที่จะแสดงในนามบัตร LINE</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="fullname">
                      <User className="inline h-4 w-4 mr-2" />
                      ชื่อ-นามสกุล *
                    </Label>
                    <Input
                      id="fullname"
                      type="text"
                      placeholder="สมชาย ใจดี"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      data-testid="input-fullname"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="position">
                      <Building2 className="inline h-4 w-4 mr-2" />
                      ตำแหน่ง
                    </Label>
                    <Input
                      id="position"
                      type="text"
                      placeholder="Product Manager"
                      value={position}
                      onChange={(e) => setPosition(e.target.value)}
                      data-testid="input-position"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="company">
                      <Building2 className="inline h-4 w-4 mr-2" />
                      บริษัท
                    </Label>
                    <Input
                      id="company"
                      type="text"
                      placeholder="ABC Technology Co., Ltd."
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      data-testid="input-company"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">
                      <Phone className="inline h-4 w-4 mr-2" />
                      เบอร์โทรศัพท์ *
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="081-234-5678"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                      data-testid="input-phone"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">
                      <Mail className="inline h-4 w-4 mr-2" />
                      อีเมล
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="somchai@abc.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      data-testid="input-email"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="website">
                      <Globe className="inline h-4 w-4 mr-2" />
                      เว็บไซต์
                    </Label>
                    <Input
                      id="website"
                      type="url"
                      placeholder="https://www.abc.com"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      data-testid="input-website"
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <Button 
                    type="submit" 
                    disabled={saving || !fullName || !phone}
                    className="w-full"
                    data-testid="button-save-profile"
                  >
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {saving ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  * ข้อมูลที่มีเครื่องหมายดอกจันจำเป็นต้องกรอก
                </p>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
