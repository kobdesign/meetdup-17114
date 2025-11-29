import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { 
  Loader2, User, Building2, Phone, Mail, Globe, Upload, CheckCircle, 
  MapPin, Instagram, Facebook, Target
} from "lucide-react";
import imageCompression from "browser-image-compression";
import ImageCropper from "@/components/ImageCropper";

interface ParticipantProfile {
  participant_id: string;
  full_name: string;
  nickname: string | null;
  email: string | null;
  phone: string;
  position: string | null;
  company: string | null;
  tagline: string | null;
  business_type: string | null;
  goal: string | null;
  website_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  business_address: string | null;
  photo_url: string | null;
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
  
  const [cropperOpen, setCropperOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Form fields - using existing database columns only
  const [fullName, setFullName] = useState("");
  const [nickname, setNickname] = useState("");
  const [position, setPosition] = useState("");
  const [company, setCompany] = useState("");
  const [tagline, setTagline] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [goal, setGoal] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [facebook, setFacebook] = useState("");
  const [instagram, setInstagram] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  useEffect(() => {
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
      
      const p = data.participant;
      setProfile(p);
      setFullName(p.full_name || "");
      setNickname(p.nickname || "");
      setPosition(p.position || "");
      setCompany(p.company || "");
      setTagline(p.tagline || "");
      setBusinessType(p.business_type || "");
      setGoal(p.goal || "");
      setPhone(p.phone || "");
      setEmail(p.email || "");
      setWebsite(p.website_url || "");
      setFacebook(p.facebook_url || "");
      setInstagram(p.instagram_url || "");
      setBusinessAddress(p.business_address || "");
      setAvatarPreview(p.photo_url);
      
    } catch (error: any) {
      console.error("Error loading profile:", error);
      toast.error(error.message || "ไม่สามารถโหลดข้อมูลได้");
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error("กรุณาเลือกไฟล์รูปภาพ");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("ไฟล์ต้องมีขนาดไม่เกิน 10MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImage(reader.result as string);
      setCropperOpen(true);
    };
    reader.readAsDataURL(file);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleCroppedImage = async (croppedBlob: Blob) => {
    try {
      setUploading(true);

      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 800,
        useWebWorker: true
      };
      
      const file = new File([croppedBlob], "avatar.jpg", { type: "image/jpeg" });
      const compressedFile = await imageCompression(file, options);
      
      const formData = new FormData();
      formData.append("avatar", compressedFile);

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
      setCropperOpen(false);
      setSelectedImage(null);
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
          nickname: nickname || null,
          position: position || null,
          company: company || null,
          tagline: tagline || null,
          business_type: businessType || null,
          goal: goal || null,
          phone,
          email: email || null,
          website_url: website || null,
          facebook_url: facebook || null,
          instagram_url: instagram || null,
          business_address: businessAddress || null,
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

  const getInitials = () => {
    if (fullName) {
      const parts = fullName.split(" ");
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      }
      return fullName.substring(0, 2).toUpperCase();
    }
    return "?";
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

        <form onSubmit={handleSubmit}>
          <div className="grid gap-6 md:grid-cols-3">
            {/* Left Column - Avatar */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>รูปโปรไฟล์</CardTitle>
                  <CardDescription>อัปโหลดรูปประจำตัว</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center space-y-4">
                  <Avatar className="h-32 w-32 bg-muted">
                    <AvatarImage 
                      src={avatarPreview || undefined} 
                      className="object-contain"
                    />
                    <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                      {getInitials()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-center gap-2 w-full">
                    <Button
                      type="button"
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
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarSelect}
                      data-testid="input-avatar"
                    />
                    <p className="text-xs text-muted-foreground text-center">
                      JPG, PNG (สูงสุด 10MB)
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Profile Form */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>ข้อมูลส่วนตัว</CardTitle>
                <CardDescription>แก้ไขข้อมูลที่จะแสดงในนามบัตร LINE</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Personal Info */}
                <div>
                  <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    ข้อมูลทั่วไป
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="full-name">ชื่อ-นามสกุล *</Label>
                      <Input
                        id="full-name"
                        type="text"
                        placeholder="สมชาย ใจดี"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                        data-testid="input-full-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="nickname">ชื่อเล่น</Label>
                      <Input
                        id="nickname"
                        type="text"
                        placeholder="ชาย"
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        data-testid="input-nickname"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="position">ตำแหน่ง</Label>
                      <Input
                        id="position"
                        type="text"
                        placeholder="กรรมการผู้จัดการ"
                        value={position}
                        onChange={(e) => setPosition(e.target.value)}
                        data-testid="input-position"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tagline">คำอธิบายสั้น</Label>
                      <Input
                        id="tagline"
                        type="text"
                        placeholder="ผู้เชี่ยวชาญด้าน..."
                        value={tagline}
                        onChange={(e) => setTagline(e.target.value)}
                        data-testid="input-tagline"
                      />
                    </div>
                  </div>
                </div>

                {/* Business Info */}
                <div>
                  <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    ข้อมูลธุรกิจ
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="company">ชื่อบริษัท/ร้าน</Label>
                      <Input
                        id="company"
                        type="text"
                        placeholder="บริษัท ABC จำกัด"
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        data-testid="input-company"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="business-type">ประเภทธุรกิจ</Label>
                      <Input
                        id="business-type"
                        type="text"
                        placeholder="ร้านอาหาร, IT, อสังหาริมทรัพย์"
                        value={businessType}
                        onChange={(e) => setBusinessType(e.target.value)}
                        data-testid="input-business-type"
                      />
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    <Label htmlFor="goal" className="flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      เป้าหมาย / สิ่งที่กำลังมองหา
                    </Label>
                    <Textarea
                      id="goal"
                      placeholder="เช่น ต้องการหาพาร์ทเนอร์ทางธุรกิจ, ขยายตลาดไปต่างจังหวัด..."
                      value={goal}
                      onChange={(e) => setGoal(e.target.value)}
                      rows={2}
                      data-testid="input-goal"
                    />
                  </div>
                </div>

                {/* Contact Info */}
                <div>
                  <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    ข้อมูลติดต่อ
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="phone">เบอร์โทรศัพท์ *</Label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="0812345678"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        required
                        data-testid="input-phone"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        อีเมล
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="email@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        data-testid="input-email"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="website" className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        เว็บไซต์
                      </Label>
                      <Input
                        id="website"
                        type="url"
                        placeholder="https://www.example.com"
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                        data-testid="input-website"
                      />
                    </div>
                  </div>
                </div>

                {/* Social Media */}
                <div>
                  <h3 className="text-sm font-medium mb-3">โซเชียลมีเดีย</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="facebook" className="flex items-center gap-2">
                        <Facebook className="h-4 w-4" />
                        Facebook
                      </Label>
                      <Input
                        id="facebook"
                        type="url"
                        placeholder="https://facebook.com/yourpage"
                        value={facebook}
                        onChange={(e) => setFacebook(e.target.value)}
                        data-testid="input-facebook"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="instagram" className="flex items-center gap-2">
                        <Instagram className="h-4 w-4" />
                        Instagram
                      </Label>
                      <Input
                        id="instagram"
                        type="url"
                        placeholder="https://instagram.com/youraccount"
                        value={instagram}
                        onChange={(e) => setInstagram(e.target.value)}
                        data-testid="input-instagram"
                      />
                    </div>
                  </div>
                </div>

                {/* Address */}
                <div>
                  <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    ที่อยู่
                  </h3>
                  <div className="space-y-2">
                    <Label htmlFor="business-address">ที่อยู่ธุรกิจ</Label>
                    <Textarea
                      id="business-address"
                      placeholder="123 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110"
                      value={businessAddress}
                      onChange={(e) => setBusinessAddress(e.target.value)}
                      rows={2}
                      data-testid="input-business-address"
                    />
                  </div>
                </div>

                {/* Submit Button */}
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
              </CardContent>
            </Card>
          </div>
        </form>

        {/* Image Cropper Dialog */}
        <ImageCropper
          open={cropperOpen}
          onClose={() => setCropperOpen(false)}
          image={selectedImage || ""}
          onCropComplete={handleCroppedImage}
          aspectRatio={1}
          cropShape="round"
        />
      </div>
    </div>
  );
}
