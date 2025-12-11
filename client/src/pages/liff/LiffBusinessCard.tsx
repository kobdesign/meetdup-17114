import { useEffect, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLiff } from "@/hooks/useLiff";
import MemberProfileCard, { MemberData, CategoryData } from "@/components/liff/MemberProfileCard";

export default function LiffBusinessCard() {
  const { participantId } = useParams<{ participantId: string }>();
  const location = useLocation();
  const { toast } = useToast();
  const { isInLiff, closeWindow } = useLiff();
  const [member, setMember] = useState<MemberData | null>(null);
  const [category, setCategory] = useState<CategoryData | null>(null);
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

  const handleShare = async () => {
    if (!member) return;
    
    setSharing(true);
    try {
      const baseUrl = window.location.origin;
      const flexJsonUrl = `${baseUrl}/api/public/share-flex/${member.participant_id}?tenantId=${member.tenant_id}&format=raw`;
      const externalShareUrl = `https://line-share-flex-api.lovable.app/share?messages=${encodeURIComponent(flexJsonUrl)}`;
      
      console.log("[LiffBusinessCard] Opening external share service for:", member.full_name_th || member.full_name);
      window.location.href = externalShareUrl;
    } catch (err: any) {
      console.error("Share error:", err);
      toast({
        variant: "destructive",
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถแชร์ได้ กรุณาลองใหม่อีกครั้ง"
      });
      setSharing(false);
    }
  };

  const handleCall = () => {
    if (member?.phone) {
      window.open(`tel:${member.phone}`);
    }
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
    <div className="min-h-screen bg-background pb-4">
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
        <MemberProfileCard
          member={member}
          category={category}
          onShare={handleShare}
          onCall={member.phone ? handleCall : undefined}
          sharing={sharing}
          showActions={true}
        />
      </div>
    </div>
  );
}
