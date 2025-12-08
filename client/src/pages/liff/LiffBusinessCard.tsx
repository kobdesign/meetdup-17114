import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  Building2, 
  Phone, 
  Mail, 
  Globe, 
  MapPin,
  Share2,
  MessageCircle,
  Loader2,
  ExternalLink
} from "lucide-react";
import { SiFacebook, SiInstagram, SiLine } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";
import { useLiff } from "@/hooks/useLiff";

interface Member {
  participant_id: string;
  tenant_id: string;
  full_name: string;
  full_name_th?: string;
  nickname: string | null;
  company: string | null;
  position: string | null;
  tagline: string | null;
  photo_url: string | null;
  company_logo_url: string | null;
  business_type: string | null;
  business_type_code: string | null;
  phone: string | null;
  email: string | null;
  website_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  line_id: string | null;
  business_address: string | null;
  notes: string | null;
  tags: string[] | null;
  onepage_url: string | null;
  tenants: {
    tenant_name: string;
    logo_url: string | null;
  };
}

interface Category {
  name_th: string;
  name_en: string | null;
}

export default function LiffBusinessCard() {
  const { participantId } = useParams<{ participantId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { isLiffReady, isInLiff, shareTargetPicker, closeWindow } = useLiff();
  const [member, setMember] = useState<Member | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  const searchParams = new URLSearchParams(location.search);
  const tenantId = searchParams.get("tenant");

  useEffect(() => {
    if (!participantId) {
      setError("Missing participant ID");
      setLoading(false);
      return;
    }

    if (!tenantId) {
      setError("Missing tenant parameter");
      setLoading(false);
      return;
    }

    fetch(`/api/public/member/${participantId}?tenantId=${tenantId}`)
      .then(res => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        if (data.member) {
          setMember(data.member);
          setCategory(data.category);
        } else if (data.error) {
          setError(data.error);
        } else {
          setError("Member not found");
        }
      })
      .catch(err => {
        console.error("Error fetching member:", err);
        setError("Failed to load member");
      })
      .finally(() => setLoading(false));
  }, [participantId, tenantId]);

  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else if (isInLiff) {
      closeWindow();
    }
  };

  const handleWebShare = async () => {
    if (!member) return;
    
    const title = `นามบัตรของ ${member.full_name_th || member.full_name}`;
    const text = `${member.full_name_th || member.full_name} - ${member.position || ""} @ ${member.company || ""}`;
    
    if (navigator.share) {
      await navigator.share({ title, text, url: window.location.href });
    } else {
      await navigator.clipboard.writeText(window.location.href);
      toast({
        title: "คัดลอก URL แล้ว",
        description: "สามารถนำไปแชร์ได้เลย"
      });
    }
  };

  const handleShare = async () => {
    if (!member) return;
    
    setSharing(true);
    try {
      if (isInLiff && isLiffReady) {
        const response = await fetch(`/api/public/share-flex/${member.participant_id}?tenant=${member.tenant_id}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch flex message: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.flexMessage) {
          throw new Error("No flex message returned");
        }
        
        await shareTargetPicker([data.flexMessage]);
        
        toast({
          title: "แชร์สำเร็จ",
          description: "ส่งนามบัตรเรียบร้อยแล้ว"
        });
      } else {
        await handleWebShare();
      }
    } catch (err: any) {
      console.error("Share error:", err);
      
      if (err.message?.includes("cancelled")) {
        toast({
          title: "ยกเลิกการแชร์",
          description: "คุณได้ยกเลิกการแชร์นามบัตร"
        });
      } else if (err.message === "LIFF is not configured" || err.message?.includes("not available")) {
        await handleWebShare();
      } else {
        toast({
          variant: "destructive",
          title: "เกิดข้อผิดพลาด",
          description: "ไม่สามารถแชร์ได้ กรุณาลองใหม่อีกครั้ง"
        });
      }
    } finally {
      setSharing(false);
    }
  };

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !member) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-destructive">{error || "Member not found"}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="bg-primary text-primary-foreground p-4">
        <div className="flex items-center justify-between mb-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleBack}
            className="text-primary-foreground hover:bg-primary/80"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            ย้อนกลับ
          </Button>
          <div className="flex items-center gap-2">
            {member.tenants?.logo_url ? (
              <img 
                src={member.tenants.logo_url} 
                alt={member.tenants.tenant_name}
                className="h-8 w-auto"
              />
            ) : null}
            <span className="text-sm">{member.tenants?.tenant_name}</span>
          </div>
        </div>
      </div>

      <div className="p-4 -mt-8">
        <Card className="overflow-hidden">
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-24 h-32 mb-4 rounded-xl border-4 border-background shadow-lg overflow-hidden bg-muted">
                {member.photo_url ? (
                  <img 
                    src={member.photo_url} 
                    alt={member.full_name_th || member.full_name}
                    className="w-full h-full object-contain"
                    data-testid="img-member-photo"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl font-bold bg-primary text-primary-foreground">
                    {getInitials(member.full_name_th || member.full_name)}
                  </div>
                )}
              </div>
              <h1 className="text-2xl font-bold">{member.full_name_th || member.full_name}</h1>
              {member.nickname && (
                <p className="text-muted-foreground">({member.nickname})</p>
              )}
              {member.position && (
                <p className="text-muted-foreground mt-1">{member.position}</p>
              )}
              {member.tagline && (
                <p className="text-sm text-muted-foreground mt-2 italic">
                  "{member.tagline}"
                </p>
              )}
            </div>

            {member.company && (
              <div className="mb-4 p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-4">
                  {member.company_logo_url ? (
                    <div className="flex-shrink-0 h-16 w-16 bg-background rounded-lg p-2 border flex items-center justify-center">
                      <img 
                        src={member.company_logo_url} 
                        alt={member.company}
                        className="max-h-12 max-w-12 object-contain"
                      />
                    </div>
                  ) : (
                    <div className="flex-shrink-0 h-16 w-16 bg-background rounded-lg border flex items-center justify-center">
                      <Building2 className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-lg truncate">{member.company}</p>
                    {category && (
                      <p className="text-sm text-muted-foreground">{category.name_th}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {member.phone && (
                <a 
                  href={`tel:${member.phone}`}
                  className="flex items-center gap-3 p-3 bg-muted rounded-lg hover-elevate"
                  data-testid="link-phone"
                >
                  <Phone className="h-5 w-5 text-primary" />
                  <span>{member.phone}</span>
                </a>
              )}

              {member.email && (
                <a 
                  href={`mailto:${member.email}`}
                  className="flex items-center gap-3 p-3 bg-muted rounded-lg hover-elevate"
                  data-testid="link-email"
                >
                  <Mail className="h-5 w-5 text-primary" />
                  <span className="truncate">{member.email}</span>
                </a>
              )}

              {member.line_id && (
                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  <SiLine className="h-5 w-5 text-[#00B900]" />
                  <span>LINE: {member.line_id}</span>
                </div>
              )}

              {member.website_url && (
                <a 
                  href={member.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 bg-muted rounded-lg hover-elevate"
                  data-testid="link-website"
                >
                  <Globe className="h-5 w-5 text-primary" />
                  <span className="truncate flex-1">{member.website_url}</span>
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </a>
              )}

              {member.business_address && (
                <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                  <MapPin className="h-5 w-5 text-primary mt-0.5" />
                  <span className="text-sm">{member.business_address}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 mt-4 pt-4 border-t">
              {member.facebook_url && (
                <a 
                  href={member.facebook_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 bg-muted rounded-lg hover-elevate"
                  data-testid="link-facebook"
                >
                  <SiFacebook className="h-5 w-5 text-[#1877F2]" />
                </a>
              )}
              {member.instagram_url && (
                <a 
                  href={member.instagram_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 bg-muted rounded-lg hover-elevate"
                  data-testid="link-instagram"
                >
                  <SiInstagram className="h-5 w-5 text-[#E4405F]" />
                </a>
              )}
            </div>

            {member.tags && member.tags.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs text-muted-foreground mb-2">Tags</p>
                <div className="flex flex-wrap gap-1">
                  {member.tags.map((tag, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {member.notes && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs text-muted-foreground mb-2">เกี่ยวกับธุรกิจ</p>
                <p className="text-sm">{member.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4">
        <div className="flex gap-3">
          {member.phone && (
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => window.open(`tel:${member.phone}`)}
              data-testid="button-call"
            >
              <Phone className="h-4 w-4 mr-2" />
              โทร
            </Button>
          )}
          <Button 
            className="flex-1"
            onClick={handleShare}
            disabled={sharing}
            data-testid="button-share"
          >
            {sharing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Share2 className="h-4 w-4 mr-2" />
            )}
            แชร์นามบัตร
          </Button>
        </div>
      </div>
    </div>
  );
}
