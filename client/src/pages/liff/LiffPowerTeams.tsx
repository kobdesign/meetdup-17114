import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronRight, Loader2, Users } from "lucide-react";

interface PowerTeam {
  power_team_id: string;
  name: string;
  description: string | null;
  member_count: number;
}

interface Tenant {
  tenant_id: string;
  tenant_name: string;
  logo_url: string | null;
}

export default function LiffPowerTeams() {
  const navigate = useNavigate();
  const location = useLocation();
  const [powerTeams, setPowerTeams] = useState<PowerTeam[]>([]);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const searchParams = new URLSearchParams(location.search);
  const tenantId = searchParams.get("tenant");

  useEffect(() => {
    if (!tenantId) {
      setError("Missing tenant parameter");
      setLoading(false);
      return;
    }

    Promise.all([
      fetch(`/api/public/tenant/${tenantId}`).then(res => {
        if (!res.ok) throw new Error(`Tenant: HTTP ${res.status}`);
        return res.json();
      }),
      fetch(`/api/public/power-teams?tenantId=${tenantId}`).then(res => {
        if (!res.ok) throw new Error(`Power Teams: HTTP ${res.status}`);
        return res.json();
      })
    ])
      .then(([tenantData, powerTeamsData]) => {
        if (tenantData.error) {
          setError(tenantData.error);
          return;
        }
        if (tenantData.tenant) {
          setTenant(tenantData.tenant);
        }
        if (powerTeamsData.powerTeams) {
          setPowerTeams(powerTeamsData.powerTeams.filter((pt: PowerTeam) => pt.member_count > 0));
        }
      })
      .catch(err => {
        console.error("Error fetching data:", err);
        setError("Failed to load power teams");
      })
      .finally(() => setLoading(false));
  }, [tenantId]);

  const handleBack = () => {
    navigate(`/liff/search?tenant=${tenantId}`);
  };

  const handlePowerTeamClick = (id: string) => {
    navigate(`/liff/search/powerteam/${id}?tenant=${tenantId}`);
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
      <div className="bg-[#5B8DEF] text-white p-4">
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

        <div className="flex items-center gap-2 mb-2">
          <Users className="h-6 w-6" />
          <h2 className="text-2xl font-bold">Power Team</h2>
        </div>
        <p className="text-white/80 text-sm">
          เลือก Power Team เพื่อดูรายชื่อสมาชิก
        </p>
      </div>

      <div className="p-4 space-y-3">
        {powerTeams.map((powerTeam) => (
          <Card 
            key={powerTeam.power_team_id}
            className="overflow-hidden hover-elevate cursor-pointer"
            onClick={() => handlePowerTeamClick(powerTeam.power_team_id)}
            data-testid={`card-powerteam-${powerTeam.power_team_id}`}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 bg-[#5B8DEF]/10 rounded-full flex items-center justify-center">
                    <Users className="h-6 w-6 text-[#5B8DEF]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{powerTeam.name}</h3>
                    {powerTeam.description && (
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {powerTeam.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {powerTeam.member_count} คน
                  </span>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {powerTeams.length === 0 && (
        <div className="p-8 text-center">
          <p className="text-muted-foreground">ยังไม่มี Power Team ในระบบ</p>
        </div>
      )}
    </div>
  );
}
