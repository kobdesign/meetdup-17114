import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Phone, 
  Mail, 
  Globe, 
  MapPin, 
  Download, 
  Share2,
  Facebook,
  Instagram,
  MessageCircle,
  ExternalLink,
  FileText,
  Building2,
  User
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ProfileData {
  participant_id: string;
  tenant_id: string;
  full_name: string;
  nickname?: string;
  position?: string;
  company?: string;
  company_logo_url?: string;
  tagline?: string;
  photo_url?: string;
  email?: string;
  phone?: string;
  website_url?: string;
  facebook_url?: string;
  instagram_url?: string;
  line_id?: string;
  business_address?: string;
  tags?: string[];
  onepage_url?: string;
  tenant: {
    name: string;
    subdomain?: string;
    logo_url?: string;
    branding_color: string;
  };
}

export default function PublicProfile() {
  const { participantId } = useParams<{ participantId: string }>();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadProfile();
  }, [participantId]);

  const loadProfile = async () => {
    try {
      const response = await fetch(`/api/participants/public/${participantId}`);
      const data = await response.json();
      
      if (!data.success) {
        setError(data.error || "Profile not found");
        return;
      }
      
      setProfile(data.profile);
      
      // Update document title for SEO
      const p = data.profile;
      const title = p.company 
        ? `${p.full_name} - ${p.position || ""} | ${p.company}`.trim()
        : `${p.full_name}${p.position ? ` - ${p.position}` : ""}`;
      document.title = title;
      
    } catch (err) {
      setError("Failed to load profile");
      console.error("Error loading profile:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadVCard = () => {
    window.open(`/api/participants/public/${participantId}/vcard`, "_blank");
    toast({
      title: "กำลังดาวน์โหลด",
      description: "กำลังบันทึกข้อมูลติดต่อ...",
    });
  };

  const handleShare = async () => {
    const shareUrl = window.location.href;
    const shareText = profile ? `${profile.full_name} - ${profile.position || ""} ${profile.company || ""}`.trim() : "Business Card";
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: profile?.full_name || "Business Card",
          text: shareText,
          url: shareUrl,
        });
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          copyToClipboard(shareUrl);
        }
      }
    } else {
      copyToClipboard(shareUrl);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "คัดลอกลิงก์แล้ว",
      description: "สามารถนำไปวางเพื่อแชร์ได้",
    });
  };

  const formatPhoneDisplay = (phone: string) => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 10) {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">กำลังโหลดโปรไฟล์...</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto">
            <User className="w-10 h-10 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold">ไม่พบโปรไฟล์</h1>
          <p className="text-muted-foreground">
            ลิงก์อาจไม่ถูกต้องหรือโปรไฟล์ไม่เปิดใช้งาน
          </p>
        </div>
      </div>
    );
  }

  const brandingColor = profile.tenant.branding_color || "#1e40af";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div 
        className="h-48 sm:h-56 relative overflow-hidden"
        style={{ 
          background: `linear-gradient(135deg, ${brandingColor} 0%, ${brandingColor}dd 50%, ${brandingColor}aa 100%)`
        }}
      >
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }} />
        </div>
        
        {profile.tenant.logo_url && (
          <div className="absolute top-4 left-4 sm:top-6 sm:left-6">
            <img 
              src={profile.tenant.logo_url} 
              alt={profile.tenant.name}
              className="h-10 sm:h-12 object-contain opacity-90"
            />
          </div>
        )}

        <div className="absolute top-4 right-4 sm:top-6 sm:right-6 flex gap-2">
          <Button 
            size="sm" 
            variant="secondary"
            className="bg-white/20 backdrop-blur-sm border-white/30 text-white hover:bg-white/30"
            onClick={handleShare}
            data-testid="button-share"
          >
            <Share2 className="w-4 h-4 mr-1.5" />
            <span className="hidden sm:inline">แชร์</span>
          </Button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pb-8 -mt-20 relative z-10">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="pt-4 pb-6 px-6 text-center relative">
            <Avatar className="w-28 h-28 sm:w-32 sm:h-32 mx-auto border-4 border-white dark:border-slate-700 shadow-lg -mt-20">
              <AvatarImage 
                src={profile.photo_url || undefined} 
                alt={profile.full_name}
                className="object-cover"
              />
              <AvatarFallback 
                className="text-2xl sm:text-3xl font-bold"
                style={{ backgroundColor: brandingColor, color: "white" }}
              >
                {getInitials(profile.full_name)}
              </AvatarFallback>
            </Avatar>

            <div className="mt-4 space-y-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground" data-testid="text-full-name">
                {profile.full_name}
              </h1>
              {profile.nickname && (
                <p className="text-lg text-muted-foreground" data-testid="text-nickname">
                  ({profile.nickname})
                </p>
              )}
            </div>

            {(profile.position || profile.company) && (
              <div className="mt-3 space-y-2">
                {profile.position && (
                  <p className="text-lg font-medium text-foreground" data-testid="text-position">
                    {profile.position}
                  </p>
                )}
                {profile.company && (
                  <div className="flex items-center justify-center gap-2">
                    {profile.company_logo_url ? (
                      <img 
                        src={profile.company_logo_url} 
                        alt={profile.company}
                        className="h-6 w-auto object-contain"
                        data-testid="img-company-logo"
                      />
                    ) : (
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                    )}
                    <span className="text-muted-foreground" data-testid="text-company">{profile.company}</span>
                  </div>
                )}
              </div>
            )}

            {profile.tagline && (
              <p className="mt-4 text-sm text-muted-foreground italic px-4" data-testid="text-tagline">
                "{profile.tagline}"
              </p>
            )}

            {profile.tags && profile.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {profile.tags.map((tag, index) => (
                  <Badge 
                    key={index} 
                    variant="secondary"
                    className="text-xs"
                    data-testid={`badge-tag-${index}`}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-border/50">
            <div className="p-4 space-y-1">
              {profile.phone && (
                <a 
                  href={`tel:${profile.phone}`}
                  className="flex items-center gap-4 p-3 rounded-xl hover-elevate active-elevate-2 transition-colors"
                  data-testid="link-phone"
                >
                  <div 
                    className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${brandingColor}15` }}
                  >
                    <Phone className="w-5 h-5" style={{ color: brandingColor }} />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-xs text-muted-foreground">โทรศัพท์</p>
                    <p className="font-medium">{formatPhoneDisplay(profile.phone)}</p>
                  </div>
                </a>
              )}

              {profile.email && (
                <a 
                  href={`mailto:${profile.email}`}
                  className="flex items-center gap-4 p-3 rounded-xl hover-elevate active-elevate-2 transition-colors"
                  data-testid="link-email"
                >
                  <div 
                    className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${brandingColor}15` }}
                  >
                    <Mail className="w-5 h-5" style={{ color: brandingColor }} />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-xs text-muted-foreground">อีเมล</p>
                    <p className="font-medium truncate">{profile.email}</p>
                  </div>
                </a>
              )}

              {profile.line_id && (
                <a 
                  href={`https://line.me/R/ti/p/~${profile.line_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 p-3 rounded-xl hover-elevate active-elevate-2 transition-colors"
                  data-testid="link-line"
                >
                  <div className="w-11 h-11 rounded-full bg-[#06C755]/10 flex items-center justify-center shrink-0">
                    <MessageCircle className="w-5 h-5 text-[#06C755]" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-xs text-muted-foreground">LINE</p>
                    <p className="font-medium">@{profile.line_id}</p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-muted-foreground" />
                </a>
              )}

              {profile.website_url && (
                <a 
                  href={profile.website_url.startsWith("http") ? profile.website_url : `https://${profile.website_url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 p-3 rounded-xl hover-elevate active-elevate-2 transition-colors"
                  data-testid="link-website"
                >
                  <div 
                    className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${brandingColor}15` }}
                  >
                    <Globe className="w-5 h-5" style={{ color: brandingColor }} />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-xs text-muted-foreground">เว็บไซต์</p>
                    <p className="font-medium truncate">
                      {profile.website_url.replace(/^https?:\/\//, "")}
                    </p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-muted-foreground" />
                </a>
              )}

              {profile.business_address && (
                <div className="flex items-start gap-4 p-3 rounded-xl">
                  <div 
                    className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${brandingColor}15` }}
                  >
                    <MapPin className="w-5 h-5" style={{ color: brandingColor }} />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-xs text-muted-foreground">ที่อยู่</p>
                    <p className="text-sm leading-relaxed" data-testid="text-address">
                      {profile.business_address}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {(profile.facebook_url || profile.instagram_url) && (
            <div className="border-t border-border/50 p-4">
              <p className="text-xs text-muted-foreground text-center mb-3">โซเชียลมีเดีย</p>
              <div className="flex justify-center gap-3">
                {profile.facebook_url && (
                  <a
                    href={profile.facebook_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-12 h-12 rounded-full bg-[#1877F2]/10 flex items-center justify-center hover-elevate active-elevate-2"
                    data-testid="link-facebook"
                  >
                    <Facebook className="w-6 h-6 text-[#1877F2]" />
                  </a>
                )}
                {profile.instagram_url && (
                  <a
                    href={profile.instagram_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-12 h-12 rounded-full bg-gradient-to-br from-[#833AB4]/10 via-[#FD1D1D]/10 to-[#F77737]/10 flex items-center justify-center hover-elevate active-elevate-2"
                    data-testid="link-instagram"
                  >
                    <Instagram className="w-6 h-6 text-[#E4405F]" />
                  </a>
                )}
              </div>
            </div>
          )}

          <div className="p-4 space-y-3">
            <Button 
              className="w-full h-12 text-base font-medium"
              style={{ backgroundColor: brandingColor }}
              onClick={handleDownloadVCard}
              data-testid="button-save-contact"
            >
              <Download className="w-5 h-5 mr-2" />
              บันทึกเบอร์ลงโทรศัพท์
            </Button>

            {profile.onepage_url && (
              <Button
                variant="outline"
                className="w-full h-12 text-base font-medium"
                asChild
                data-testid="button-onepage"
              >
                <a 
                  href={profile.onepage_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  <FileText className="w-5 h-5 mr-2" />
                  ดู One Page
                </a>
              </Button>
            )}
          </div>

          <div className="border-t border-border/50 py-4 px-6">
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              {profile.tenant.logo_url ? (
                <img 
                  src={profile.tenant.logo_url} 
                  alt={profile.tenant.name}
                  className="h-5 object-contain"
                />
              ) : null}
              <span>{profile.tenant.name}</span>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Powered by Meetdup
        </p>
      </div>
    </div>
  );
}
