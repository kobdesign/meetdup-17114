import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import MemberListCard, { MemberListData } from "@/components/liff/MemberListCard";

interface FilterInfo {
  name_th: string;
  name_en: string | null;
}

interface Tenant {
  tenant_id: string;
  tenant_name: string;
  logo_url: string | null;
}

type SearchType = "category" | "position" | "powerteam";

export default function LiffMembersList() {
  const { code, id } = useParams<{ code?: string; id?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [members, setMembers] = useState<MemberListData[]>([]);
  const [filterInfo, setFilterInfo] = useState<FilterInfo | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchType, setSearchType] = useState<SearchType>("category");

  const searchParams = new URLSearchParams(location.search);
  const tenantId = searchParams.get("tenant");

  const getSearchType = (): SearchType => {
    if (location.pathname.includes("/position/")) return "position";
    if (location.pathname.includes("/powerteam/")) return "powerteam";
    return "category";
  };

  useEffect(() => {
    const currentSearchType = getSearchType();
    setSearchType(currentSearchType);
    
    const identifier = code || id;
    if (!tenantId || !identifier) {
      setError("Missing parameters");
      setLoading(false);
      return;
    }

    let membersApiUrl = "";
    switch (currentSearchType) {
      case "position":
        membersApiUrl = `/api/public/members/by-position/${identifier}?tenantId=${tenantId}`;
        break;
      case "powerteam":
        membersApiUrl = `/api/public/members/by-powerteam/${identifier}?tenantId=${tenantId}`;
        break;
      default:
        membersApiUrl = `/api/public/members/by-category/${identifier}?tenantId=${tenantId}`;
    }

    Promise.all([
      fetch(`/api/public/tenant/${tenantId}`).then(res => {
        if (!res.ok) throw new Error(`Tenant: HTTP ${res.status}`);
        return res.json();
      }),
      fetch(membersApiUrl).then(res => {
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
          if (membersData.category) {
            setFilterInfo(membersData.category);
          } else if (membersData.position) {
            setFilterInfo(membersData.position);
          } else if (membersData.powerTeam) {
            setFilterInfo({ name_th: membersData.powerTeam.name, name_en: membersData.powerTeam.description });
          }
        }
      })
      .catch(err => {
        console.error("Error fetching data:", err);
        setError("Failed to load members");
      })
      .finally(() => setLoading(false));
  }, [tenantId, code, id, location.pathname]);

  const handleBack = () => {
    switch (searchType) {
      case "position":
        navigate(`/liff/search/position?tenant=${tenantId}`);
        break;
      case "powerteam":
        navigate(`/liff/search/powerteam?tenant=${tenantId}`);
        break;
      default:
        navigate(`/liff/search/category?tenant=${tenantId}`);
    }
  };

  const getHeaderColor = () => {
    switch (searchType) {
      case "position": return "bg-[#FF6B6B]";
      case "powerteam": return "bg-[#5B8DEF]";
      default: return "bg-primary";
    }
  };

  const getHeaderTitle = () => {
    switch (searchType) {
      case "position": return "ตำแหน่งใน BNI";
      case "powerteam": return "Power Team";
      default: return "ประเภทธุรกิจ";
    }
  };

  const handleMemberClick = (participantId: string) => {
    navigate(`/liff/card/${participantId}?tenant=${tenantId}`);
  };

  const handleShare = (e: React.MouseEvent, member: MemberListData) => {
    e.stopPropagation();
    
    const baseUrl = window.location.origin;
    const flexJsonUrl = `${baseUrl}/api/public/share-flex/${member.participant_id}?tenantId=${tenantId}&format=raw`;
    const externalShareUrl = `https://line-share-flex-api.lovable.app/share?messages=${encodeURIComponent(flexJsonUrl)}`;
    
    console.log("[LiffMembersList] Opening external share service for:", member.full_name_th || member.full_name);
    window.location.href = externalShareUrl;
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
      <div className={`${getHeaderColor()} text-white p-4`}>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleBack}
          className="text-white hover:bg-white/20 mb-4"
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

        <p className="text-white/80 text-xs mb-1">{getHeaderTitle()}</p>
        <h2 className="text-2xl font-bold mb-1">
          {filterInfo?.name_th || "ไม่ระบุ"}
        </h2>
        {filterInfo?.name_en && (
          <p className="text-white/80 text-sm mb-2">
            {filterInfo.name_en}
          </p>
        )}
        <p className="text-white/80 text-sm">
          พบสมาชิก {members.length} คน
        </p>
      </div>

      <div className="p-4 space-y-3">
        {members.map((member) => (
          <MemberListCard
            key={member.participant_id}
            member={member}
            onClick={() => handleMemberClick(member.participant_id)}
            onShare={(e) => handleShare(e, member)}
          />
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
