import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { 
  Loader2, User, Building2, Phone, Mail, Globe, Upload, CheckCircle, 
  MapPin, Instagram, Facebook, FileImage, Target, MessageSquare, MessageCircle,
  Linkedin, AlertCircle, Users, StickyNote
} from "lucide-react";
import imageCompression from "browser-image-compression";
import BusinessTypeSelector from "@/components/BusinessTypeSelector";
import TagInput from "@/components/TagInput";
import { getBusinessCategoryLabel } from "@/lib/business-categories";
import ImageCropper from "@/components/ImageCropper";
import { MemberSearchSelect, MemberOption } from "@/components/MemberSearchSelect";

interface ParticipantProfile {
  participant_id: string;
  full_name_th: string | null;
  full_name_en: string | null;
  nickname: string | null;
  nickname_th: string | null;
  nickname_en: string | null;
  email: string | null;
  phone: string;
  position: string | null;
  company: string | null;
  company_logo_url: string | null;
  tagline: string | null;
  business_type_code: string | null;
  goal: string | null;
  website_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  linkedin_url: string | null;
  line_id: string | null;
  business_address: string | null;
  photo_url: string | null;
  tags: string[] | null;
  onepage_url: string | null;
  member_type: string | null;
  tenant_id: string;
  tenant_name?: string;
  logo_url?: string;
  referral_origin: "member" | "central" | "external" | null;
  referred_by_participant_id: string | null;
  notes: string | null;
}

export default function ParticipantProfile() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingOnepage, setUploadingOnepage] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [profile, setProfile] = useState<ParticipantProfile | null>(null);
  const [token, setToken] = useState<string>("");
  
  const [cropperOpen, setCropperOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null);
  
  // Form fields - Thai names (required)
  const [fullNameTh, setFullNameTh] = useState("");
  const [nicknameTh, setNicknameTh] = useState("");
  // Form fields - English names (optional)
  const [fullNameEn, setFullNameEn] = useState("");
  const [nicknameEn, setNicknameEn] = useState("");
  // Other fields
  const [position, setPosition] = useState("");
  const [company, setCompany] = useState("");
  const [tagline, setTagline] = useState("");
  const [businessTypeCode, setBusinessTypeCode] = useState<string | null>(null);
  const [goal, setGoal] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [facebook, setFacebook] = useState("");
  const [instagram, setInstagram] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [lineId, setLineId] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [onepageUrl, setOnepageUrl] = useState<string | null>(null);
  // Referral fields
  const [referralOrigin, setReferralOrigin] = useState<"member" | "central" | "external">("member");
  const [referredByParticipantId, setReferredByParticipantId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [members, setMembers] = useState<MemberOption[]>([]);

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
      // Thai names
      setFullNameTh(p.full_name_th || "");
      setNicknameTh(p.nickname_th || "");
      // English names
      setFullNameEn(p.full_name_en || "");
      setNicknameEn(p.nickname_en || "");
      // Other fields
      setPosition(p.position || "");
      setCompany(p.company || "");
      setTagline(p.tagline || "");
      setBusinessTypeCode(p.business_type_code || null);
      setGoal(p.goal || "");
      setPhone(p.phone || "");
      setEmail(p.email || "");
      setWebsite(p.website_url || "");
      setFacebook(p.facebook_url || "");
      setInstagram(p.instagram_url || "");
      setLinkedin(p.linkedin_url || "");
      setLineId(p.line_id || "");
      setBusinessAddress(p.business_address || "");
      setTags(p.tags || []);
      setAvatarPreview(p.photo_url);
      setOnepageUrl(p.onepage_url);
      setCompanyLogoUrl(p.company_logo_url);
      // Referral fields
      setReferralOrigin(p.referral_origin || "member");
      setReferredByParticipantId(p.referred_by_participant_id || null);
      setNotes(p.notes || "");
      // Load members list for referral selector (from profile response)
      if (data.members) {
        setMembers(data.members);
      }
      
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

  const handleOnepageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;

      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        toast.error("กรุณาเลือกไฟล์รูปภาพหรือ PDF");
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        toast.error("ไฟล์ต้องมีขนาดไม่เกิน 10MB");
        return;
      }

      setUploadingOnepage(true);

      let uploadFile = file;
      
      // Compress if image
      if (file.type.startsWith('image/')) {
        const options = {
          maxSizeMB: 2,
          maxWidthOrHeight: 2000,
          useWebWorker: true
        };
        uploadFile = await imageCompression(file, options);
      }
      
      const formData = new FormData();
      formData.append("onepage", uploadFile);

      const response = await fetch(`/api/participants/profile/onepage?token=${token}`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "ไม่สามารถอัปโหลดไฟล์ได้");
      }

      setOnepageUrl(data.onepage_url);
      toast.success("อัปโหลด One Page สำเร็จ");
      
    } catch (error: any) {
      console.error('Error uploading onepage:', error);
      toast.error(error.message || "ไม่สามารถอัปโหลดไฟล์ได้");
    } finally {
      setUploadingOnepage(false);
    }
  };

  const handleCompanyLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;

      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
      if (!allowedTypes.includes(file.type)) {
        toast.error("กรุณาเลือกไฟล์รูปภาพ (JPG, PNG, WEBP, SVG)");
        return;
      }

      if (file.size > 2 * 1024 * 1024) {
        toast.error("ไฟล์ต้องมีขนาดไม่เกิน 2MB");
        return;
      }

      setUploadingLogo(true);

      let uploadFile = file;
      
      if (file.type.startsWith('image/') && file.type !== 'image/svg+xml') {
        const options = {
          maxSizeMB: 0.5,
          maxWidthOrHeight: 500,
          useWebWorker: true
        };
        uploadFile = await imageCompression(file, options);
      }
      
      const formData = new FormData();
      formData.append("logo", uploadFile);

      const response = await fetch(`/api/participants/profile/company-logo?token=${token}`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "ไม่สามารถอัปโหลดโลโก้ได้");
      }

      setCompanyLogoUrl(data.logo_url);
      toast.success("อัปโหลดโลโก้บริษัทสำเร็จ");
      
    } catch (error: any) {
      console.error('Error uploading company logo:', error);
      toast.error(error.message || "ไม่สามารถอัปโหลดโลโก้ได้");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleDeleteCompanyLogo = async () => {
    try {
      setUploadingLogo(true);

      const response = await fetch(`/api/participants/profile/company-logo?token=${token}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "ไม่สามารถลบโลโก้ได้");
      }

      setCompanyLogoUrl(null);
      toast.success("ลบโลโก้บริษัทสำเร็จ");
      
    } catch (error: any) {
      console.error('Error deleting company logo:', error);
      toast.error(error.message || "ไม่สามารถลบโลโก้ได้");
    } finally {
      setUploadingLogo(false);
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
          // Thai names
          full_name_th: fullNameTh,
          nickname_th: nicknameTh || null,
          // English names
          full_name_en: fullNameEn || null,
          nickname_en: nicknameEn || null,
          // Other fields
          position: position || null,
          company: company || null,
          tagline: tagline || null,
          business_type: businessTypeCode ? getBusinessCategoryLabel(businessTypeCode) : null,
          business_type_code: businessTypeCode,
          goal: goal || null,
          phone,
          email: email || null,
          website_url: website || null,
          facebook_url: facebook || null,
          instagram_url: instagram || null,
          linkedin_url: linkedin || null,
          line_id: lineId || null,
          business_address: businessAddress || null,
          tags: tags.length > 0 ? tags : null,
          // Referral fields
          referral_origin: referralOrigin,
          referred_by_participant_id: referralOrigin === "member" ? referredByParticipantId : null,
          notes: notes || null,
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
    if (fullNameTh) {
      const parts = fullNameTh.split(" ");
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      }
      return fullNameTh.substring(0, 2).toUpperCase();
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
            {/* Left Column - Avatar & OnePage */}
            <div className="space-y-6">
              {/* Avatar Section */}
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
                      JPG, PNG (สูงสุด 10MB) - สามารถครอปรูปได้
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* OnePage Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileImage className="h-5 w-5" />
                    One Page
                  </CardTitle>
                  <CardDescription>
                    Infographic แนะนำธุรกิจของคุณ
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center space-y-4">
                  {onepageUrl ? (
                    <div className="w-full space-y-2">
                      {onepageUrl.endsWith('.pdf') ? (
                        <a 
                          href={onepageUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="block p-4 border rounded-md text-center hover:bg-muted"
                        >
                          <FileImage className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">ดู PDF</span>
                        </a>
                      ) : (
                        <a href={onepageUrl} target="_blank" rel="noopener noreferrer">
                          <img 
                            src={onepageUrl} 
                            alt="One Page" 
                            className="w-full rounded-md border"
                          />
                        </a>
                      )}
                    </div>
                  ) : (
                    <div className="w-full p-8 border-2 border-dashed rounded-md text-center text-muted-foreground">
                      <FileImage className="h-12 w-12 mx-auto mb-2" />
                      <p className="text-sm">ยังไม่มี One Page</p>
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploadingOnepage}
                    onClick={() => document.getElementById('onepage-upload')?.click()}
                    className="w-full"
                    data-testid="button-upload-onepage"
                  >
                    {uploadingOnepage && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Upload className="mr-2 h-4 w-4" />
                    {uploadingOnepage ? "กำลังอัปโหลด..." : onepageUrl ? "เปลี่ยน One Page" : "อัปโหลด One Page"}
                  </Button>
                  <input
                    id="onepage-upload"
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={handleOnepageUpload}
                    data-testid="input-onepage"
                  />
                  <p className="text-xs text-muted-foreground text-center">
                    รูปภาพหรือ PDF (สูงสุด 10MB)
                  </p>
                </CardContent>
              </Card>

              {/* Company Logo Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    โลโก้บริษัท
                  </CardTitle>
                  <CardDescription>
                    โลโก้จะแสดงในนามบัตรออนไลน์
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center space-y-4">
                  {companyLogoUrl ? (
                    <div className="w-full space-y-2">
                      <div className="flex justify-center p-4 bg-muted/50 rounded-md">
                        <img 
                          src={companyLogoUrl} 
                          alt="Company Logo" 
                          className="max-h-24 object-contain"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="w-full p-8 border-2 border-dashed rounded-md text-center text-muted-foreground">
                      <Building2 className="h-12 w-12 mx-auto mb-2" />
                      <p className="text-sm">ยังไม่มีโลโก้บริษัท</p>
                    </div>
                  )}
                  <div className="flex gap-2 w-full">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={uploadingLogo}
                      onClick={() => document.getElementById('company-logo-upload')?.click()}
                      className="flex-1"
                      data-testid="button-upload-company-logo"
                    >
                      {uploadingLogo && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      <Upload className="mr-2 h-4 w-4" />
                      {uploadingLogo ? "กำลังอัปโหลด..." : companyLogoUrl ? "เปลี่ยนโลโก้" : "อัปโหลดโลโก้"}
                    </Button>
                    {companyLogoUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={uploadingLogo}
                        onClick={handleDeleteCompanyLogo}
                        className="text-destructive hover:text-destructive"
                        data-testid="button-delete-company-logo"
                      >
                        ลบ
                      </Button>
                    )}
                  </div>
                  <input
                    id="company-logo-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleCompanyLogoUpload}
                    data-testid="input-company-logo"
                  />
                  <p className="text-xs text-muted-foreground text-center">
                    JPG, PNG, SVG (สูงสุด 2MB)
                  </p>
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
                {/* Thai Names (Required) */}
                <div>
                  <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    ชื่อ-นามสกุล (ภาษาไทย) *
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="full-name-th">ชื่อ-นามสกุล *</Label>
                      <Input
                        id="full-name-th"
                        type="text"
                        placeholder="สมชาย ใจดี"
                        value={fullNameTh}
                        onChange={(e) => setFullNameTh(e.target.value)}
                        required
                        data-testid="input-full-name-th"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="nickname-th">ชื่อเล่น</Label>
                      <Input
                        id="nickname-th"
                        type="text"
                        placeholder="ชาย"
                        value={nicknameTh}
                        onChange={(e) => setNicknameTh(e.target.value)}
                        data-testid="input-nickname-th"
                      />
                    </div>
                  </div>
                </div>

                {/* English Names (Optional) */}
                <div>
                  <h3 className="text-sm font-medium mb-3 text-muted-foreground">
                    ชื่อ-นามสกุล (ภาษาอังกฤษ) - ไม่บังคับ
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="full-name-en">Full Name</Label>
                      <Input
                        id="full-name-en"
                        type="text"
                        placeholder="Somchai Jaidee"
                        value={fullNameEn}
                        onChange={(e) => setFullNameEn(e.target.value)}
                        data-testid="input-full-name-en"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="nickname-en">Nickname</Label>
                      <Input
                        id="nickname-en"
                        type="text"
                        placeholder="Chai"
                        value={nicknameEn}
                        onChange={(e) => setNicknameEn(e.target.value)}
                        data-testid="input-nickname-en"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Contact Info */}
                <div className="grid gap-4 md:grid-cols-2">
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
                </div>

                <Separator />

                {/* Business Info */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="company">
                      <Building2 className="inline h-4 w-4 mr-2" />
                      บริษัท/ชื่อธุรกิจ
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

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="tagline">Tagline / สโลแกน</Label>
                    <Input
                      id="tagline"
                      type="text"
                      placeholder="เราพัฒนาซอฟต์แวร์ที่ตอบโจทย์ธุรกิจคุณ"
                      value={tagline}
                      onChange={(e) => setTagline(e.target.value)}
                      data-testid="input-tagline"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <BusinessTypeSelector
                      value={businessTypeCode}
                      onChange={setBusinessTypeCode}
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="goal">
                      <Target className="inline h-4 w-4 mr-2" />
                      เป้าหมาย / ลูกค้าที่ต้องการ
                    </Label>
                    <Textarea
                      id="goal"
                      placeholder="กำลังมองหาลูกค้าที่เป็น SME ที่ต้องการระบบ ERP..."
                      value={goal}
                      onChange={(e) => setGoal(e.target.value)}
                      rows={2}
                      data-testid="input-goal"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <TagInput
                      value={tags}
                      onChange={setTags}
                    />
                  </div>
                </div>

                <Separator />

                {/* Contact & Social */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
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

                  <div className="space-y-2">
                    <Label htmlFor="linkedin">
                      <Linkedin className="inline h-4 w-4 mr-2" />
                      LinkedIn
                    </Label>
                    <Input
                      id="linkedin"
                      type="url"
                      placeholder="https://linkedin.com/in/yourprofile"
                      value={linkedin}
                      onChange={(e) => setLinkedin(e.target.value)}
                      data-testid="input-linkedin"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="facebook">
                      <Facebook className="inline h-4 w-4 mr-2" />
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
                    <Label htmlFor="instagram">
                      <Instagram className="inline h-4 w-4 mr-2" />
                      Instagram
                    </Label>
                    <Input
                      id="instagram"
                      type="url"
                      placeholder="https://instagram.com/yourpage"
                      value={instagram}
                      onChange={(e) => setInstagram(e.target.value)}
                      data-testid="input-instagram"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="line-id">
                      <MessageCircle className="inline h-4 w-4 mr-2" />
                      LINE ID
                    </Label>
                    <Input
                      id="line-id"
                      type="text"
                      placeholder="mylineid"
                      value={lineId}
                      onChange={(e) => setLineId(e.target.value.replace(/^@/, ''))}
                      data-testid="input-line-id"
                    />
                    <p className="text-xs text-muted-foreground">
                      LINE ID สาธารณะ (ไม่ต้องใส่ @) เพื่อให้คนอื่นเปิดโปรไฟล์ LINE ของคุณได้
                    </p>
                    {!lineId && (
                      <div className="flex items-center gap-2 mt-2 p-2 bg-amber-50 dark:bg-amber-950/30 rounded-md border border-amber-200 dark:border-amber-800">
                        <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                        <p className="text-xs text-amber-700 dark:text-amber-300">
                          กรุณากรอก LINE ID เพื่อให้สมาชิกท่านอื่นติดต่อคุณผ่าน LINE ได้สะดวก
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="address">
                      <MapPin className="inline h-4 w-4 mr-2" />
                      ที่อยู่ธุรกิจ
                    </Label>
                    <Textarea
                      id="address"
                      placeholder="123/45 อาคาร ABC ถนนสุขุมวิท กรุงเทพฯ 10110"
                      value={businessAddress}
                      onChange={(e) => setBusinessAddress(e.target.value)}
                      rows={2}
                      data-testid="input-address"
                    />
                  </div>
                </div>

                <Separator />

                {/* Referral Section */}
                <div className="space-y-4 p-4 border rounded-md bg-muted/30">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    <Users className="h-4 w-4" />
                    แหล่งที่มา / ผู้แนะนำ
                  </Label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: "central", label: "ส่วนกลาง" },
                      { value: "member", label: "สมาชิกแนะนำ" },
                      { value: "external", label: "ภายนอก" },
                    ].map((option) => (
                      <Button
                        key={option.value}
                        type="button"
                        variant={referralOrigin === option.value ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          setReferralOrigin(option.value as "member" | "central" | "external");
                          if (option.value !== "member") {
                            setReferredByParticipantId(null);
                          }
                        }}
                        data-testid={`button-referral-${option.value}`}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                  {referralOrigin === "member" && (
                    <div className="space-y-2">
                      <Label htmlFor="referred-by">ผู้แนะนำ</Label>
                      <MemberSearchSelect
                        members={members}
                        value={referredByParticipantId || ""}
                        onChange={(value) => setReferredByParticipantId(value || null)}
                        placeholder="เลือกสมาชิกผู้แนะนำ..."
                        data-testid="select-referred-by"
                      />
                    </div>
                  )}
                </div>

                {/* Notes Section */}
                <div className="space-y-2">
                  <Label htmlFor="notes" className="flex items-center gap-2">
                    <StickyNote className="h-4 w-4" />
                    หมายเหตุ
                  </Label>
                  <Textarea
                    id="notes"
                    placeholder="บันทึกเพิ่มเติม..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    data-testid="input-notes"
                  />
                  <p className="text-xs text-muted-foreground">
                    ข้อมูลนี้จะถูกเก็บเป็นบันทึกส่วนตัว
                  </p>
                </div>

                <Separator />

                {/* Submit */}
                <div className="pt-2">
                  <Button 
                    type="submit" 
                    disabled={saving || !fullNameTh || !phone}
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
              </CardContent>
            </Card>
          </div>
        </form>
      </div>

      {selectedImage && (
        <ImageCropper
          image={selectedImage}
          open={cropperOpen}
          onClose={() => {
            setCropperOpen(false);
            setSelectedImage(null);
          }}
          onCropComplete={handleCroppedImage}
          aspectRatio={1}
          cropShape="round"
        />
      )}
    </div>
  );
}
