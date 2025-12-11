import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Building2, Phone, Mail, Share2, MessageCircle } from "lucide-react";
import { SiLine } from "react-icons/si";

export interface MemberListData {
  participant_id: string;
  full_name: string;
  full_name_th?: string;
  nickname?: string | null;
  nickname_th?: string | null;
  company: string | null;
  position: string | null;
  tagline: string | null;
  photo_url: string | null;
  business_type?: string | null;
  phone: string | null;
  email: string | null;
  line_id?: string | null;
}

interface MemberListCardProps {
  member: MemberListData;
  onClick?: () => void;
  onShare?: (e: React.MouseEvent) => void;
  className?: string;
}

export default function MemberListCard({
  member,
  onClick,
  onShare,
  className = ""
}: MemberListCardProps) {
  const displayName = member.full_name_th || member.full_name;
  const displayNickname = member.nickname_th || member.nickname;

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const handleLineChat = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (member.line_id) {
      const lineId = member.line_id.startsWith("@") 
        ? member.line_id.substring(1) 
        : member.line_id;
      window.location.href = `https://line.me/R/ti/p/@${lineId}`;
    }
  };

  return (
    <Card 
      className={`overflow-hidden hover-elevate cursor-pointer ${className}`}
      onClick={onClick}
      data-testid={`card-member-${member.participant_id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={member.photo_url || undefined} alt={displayName} />
            <AvatarFallback className="text-lg">
              {getInitials(displayName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-lg">
              {displayName}
              {displayNickname && (
                <span className="text-muted-foreground font-normal ml-2">
                  ({displayNickname})
                </span>
              )}
            </h3>
            {member.position && (
              <p className="text-sm text-muted-foreground">{member.position}</p>
            )}
            {member.company && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                <Building2 className="h-3 w-3" />
                <span className="truncate">{member.company}</span>
              </div>
            )}
            {member.tagline && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2 italic">
                "{member.tagline}"
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t">
          <div className="flex items-center gap-3 flex-wrap flex-1 min-w-0">
            {member.phone && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Phone className="h-3 w-3" />
                <span>{member.phone}</span>
              </div>
            )}
            {member.email && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Mail className="h-3 w-3" />
                <span className="truncate max-w-[120px]">{member.email}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {member.line_id && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLineChat}
                className="text-[#00B900] hover:text-[#00B900] hover:bg-[#00B900]/10"
                data-testid={`button-line-${member.participant_id}`}
              >
                <SiLine className="h-4 w-4" />
              </Button>
            )}
            {onShare && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onShare}
                data-testid={`button-share-${member.participant_id}`}
              >
                <Share2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
