import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
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

export interface MemberData {
  participant_id: string;
  tenant_id: string;
  full_name: string;
  full_name_th?: string;
  nickname?: string | null;
  nickname_th?: string | null;
  company: string | null;
  position: string | null;
  tagline: string | null;
  photo_url: string | null;
  company_logo_url?: string | null;
  business_type: string | null;
  business_type_code?: string | null;
  phone: string | null;
  email: string | null;
  website_url?: string | null;
  facebook_url?: string | null;
  instagram_url?: string | null;
  line_id?: string | null;
  business_address?: string | null;
  notes?: string | null;
  tags?: string[] | null;
  onepage_url?: string | null;
  tenants?: {
    tenant_name: string;
    logo_url: string | null;
  };
}

export interface CategoryData {
  name_th: string;
  name_en: string | null;
}

interface MemberProfileCardProps {
  member: MemberData;
  category?: CategoryData | null;
  onShare?: () => void;
  onCall?: () => void;
  sharing?: boolean;
  showActions?: boolean;
  className?: string;
}

export default function MemberProfileCard({
  member,
  category,
  onShare,
  onCall,
  sharing = false,
  showActions = true,
  className = ""
}: MemberProfileCardProps) {
  const displayName = member.full_name_th || member.full_name;
  const displayNickname = member.nickname_th || member.nickname;

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const handleLineChat = () => {
    if (member.line_id) {
      const lineId = member.line_id.startsWith("@") 
        ? member.line_id.substring(1) 
        : member.line_id;
      window.location.href = `https://line.me/R/ti/p/@${lineId}`;
    }
  };

  return (
    <Card className={`overflow-hidden ${className}`}>
      <CardContent className="p-6">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-24 h-32 mb-4 rounded-xl border-4 border-background shadow-lg overflow-hidden bg-muted">
            {member.photo_url ? (
              <img 
                src={member.photo_url} 
                alt={displayName}
                className="w-full h-full object-contain"
                data-testid="img-member-photo"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl font-bold bg-primary text-primary-foreground">
                {getInitials(displayName)}
              </div>
            )}
          </div>
          <h1 className="text-2xl font-bold">{displayName}</h1>
          {displayNickname && (
            <p className="text-muted-foreground">({displayNickname})</p>
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
            <button
              onClick={handleLineChat}
              className="w-full flex items-center gap-3 p-3 bg-[#00B900] hover:bg-[#00A000] text-white rounded-lg transition-colors"
              data-testid="button-line-chat"
            >
              <SiLine className="h-5 w-5" />
              <span className="flex-1 text-left">แชท LINE: {member.line_id}</span>
              <MessageCircle className="h-4 w-4" />
            </button>
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

      {showActions && (
        <div className="border-t p-4 bg-background">
          <div className="flex gap-3">
            {member.phone && onCall && (
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={onCall}
                data-testid="button-call"
              >
                <Phone className="h-4 w-4 mr-2" />
                โทร
              </Button>
            )}
            {onShare && (
              <Button 
                className="flex-1"
                onClick={onShare}
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
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
