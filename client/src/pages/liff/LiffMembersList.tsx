import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Building2, Phone, Mail, Loader2 } from "lucide-react";

interface Member {
  participant_id: string;
  full_name: string;
  nickname: string | null;
  company: string | null;
  position: string | null;
  tagline: string | null;
  photo_url: string | null;
  business_type: string | null;
  phone: string | null;
  email: string | null;
}

interface Category {
  name_th: string;
  name_en: string | null;
}

interface Tenant {
  tenant_id: string;
  tenant_name: string;
  logo_url: string | null;
}

export default function LiffMembersList() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [members, setMembers] = useState<Member[]>([]);
  const [category, setCategory] = useState<Category | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const searchParams = new URLSearchParams(location.search);
  const tenantId = searchParams.get("tenant");

  useEffect(() => {
    if (!tenantId || !code) {
      setError("Missing parameters");
      setLoading(false);
      return;
    }

    Promise.all([
      fetch(`/api/public/tenant/${tenantId}`).then(res => {
        if (!res.ok) throw new Error(`Tenant: HTTP ${res.status}`);
        return res.json();
      }),
      fetch(`/api/public/members/by-category/${code}?tenantId=${tenantId}`).then(res => {
        if (!res.ok) throw new Error(`Members: HTTP ${res.status}`);
        return res.json();
      })
    ])
      .then(([tenantData, membersData]) => {
        if (tenantData.error) {
          setError(tenantData.error);
          return;
        }
        if (membersData.error) {
          setError(membersData.error);
          return;
        }
        if (tenantData.tenant) {
          setTenant(tenantData.tenant);
        }
        if (membersData.members) {
          setMembers(membersData.members);
          setCategory(membersData.category);
        }
      })
      .catch(err => {
        console.error("Error fetching data:", err);
        setError("Failed to load members");
      })
      .finally(() => setLoading(false));
  }, [tenantId, code]);

  const handleBack = () => {
    navigate(`/liff/search/category?tenant=${tenantId}`);
  };

  const handleMemberClick = (participantId: string) => {
    navigate(`/liff/card/${participantId}?tenant=${tenantId}`);
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

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-primary text-primary-foreground p-4">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleBack}
          className="text-primary-foreground hover:bg-primary/80 mb-4"
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          ย้อนกลับ
        </Button>

        <div className="flex items-center gap-3 mb-4">
          {tenant?.logo_url ? (
            <img 
              src={tenant.logo_url} 
              alt={tenant.tenant_name}
              className="h-10 w-auto"
            />
          ) : null}
          <h1 className="text-xl font-bold">{tenant?.tenant_name}</h1>
        </div>

        <h2 className="text-2xl font-bold mb-1">
          {category?.name_th || "ไม่ระบุ"}
        </h2>
        {category?.name_en && (
          <p className="text-primary-foreground/80 text-sm mb-2">
            {category.name_en}
          </p>
        )}
        <p className="text-primary-foreground/80 text-sm">
          พบสมาชิก {members.length} คน
        </p>
      </div>

      <div className="p-4 space-y-3">
        {members.map((member) => (
          <Card 
            key={member.participant_id}
            className="overflow-hidden hover-elevate cursor-pointer"
            onClick={() => handleMemberClick(member.participant_id)}
            data-testid={`card-member-${member.participant_id}`}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={member.photo_url || undefined} alt={member.full_name} />
                  <AvatarFallback className="text-lg">
                    {getInitials(member.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-lg">
                    {member.full_name}
                    {member.nickname && (
                      <span className="text-muted-foreground font-normal ml-2">
                        ({member.nickname})
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
              <div className="flex items-center gap-4 mt-3 pt-3 border-t">
                {member.phone && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    <span>{member.phone}</span>
                  </div>
                )}
                {member.email && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Mail className="h-3 w-3" />
                    <span className="truncate max-w-[150px]">{member.email}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {members.length === 0 && (
        <div className="p-8 text-center">
          <p className="text-muted-foreground">ไม่พบสมาชิกในประเภทธุรกิจนี้</p>
        </div>
      )}
    </div>
  );
}
