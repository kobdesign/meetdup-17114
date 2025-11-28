import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronRight, Loader2, Award } from "lucide-react";

interface Position {
  position_code: string;
  name_th: string;
  name_en: string;
  member_count: number;
}

interface Tenant {
  tenant_id: string;
  tenant_name: string;
  logo_url: string | null;
}

const BNI_POSITIONS: Position[] = [
  { position_code: "president", name_th: "ประธาน", name_en: "President", member_count: 0 },
  { position_code: "vice_president", name_th: "รองประธาน", name_en: "Vice President", member_count: 0 },
  { position_code: "secretary", name_th: "เลขานุการ", name_en: "Secretary/Treasurer", member_count: 0 },
  { position_code: "membership", name_th: "ฝ่ายสมาชิก", name_en: "Membership Committee", member_count: 0 },
  { position_code: "visitor", name_th: "ฝ่ายต้อนรับ", name_en: "Visitor Host", member_count: 0 },
  { position_code: "education", name_th: "ฝ่ายการศึกษา", name_en: "Education Coordinator", member_count: 0 },
  { position_code: "mentor", name_th: "พี่เลี้ยง", name_en: "Mentor Coordinator", member_count: 0 },
  { position_code: "member", name_th: "สมาชิก", name_en: "Member", member_count: 0 },
];

export default function LiffPositions() {
  const navigate = useNavigate();
  const location = useLocation();
  const [positions, setPositions] = useState<Position[]>(BNI_POSITIONS);
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
      fetch(`/api/public/positions?tenantId=${tenantId}`).then(res => {
        if (!res.ok) throw new Error(`Positions: HTTP ${res.status}`);
        return res.json();
      })
    ])
      .then(([tenantData, positionsData]) => {
        if (tenantData.error) {
          setError(tenantData.error);
          return;
        }
        if (tenantData.tenant) {
          setTenant(tenantData.tenant);
        }
        if (positionsData.positions) {
          const positionsWithCount = BNI_POSITIONS.map(pos => {
            const found = positionsData.positions.find((p: any) => p.position_code === pos.position_code);
            return { ...pos, member_count: found?.member_count || 0 };
          }).filter(p => p.member_count > 0);
          setPositions(positionsWithCount);
        }
      })
      .catch(err => {
        console.error("Error fetching data:", err);
        setError("Failed to load positions");
      })
      .finally(() => setLoading(false));
  }, [tenantId]);

  const handleBack = () => {
    navigate(`/liff/search?tenant=${tenantId}`);
  };

  const handlePositionClick = (code: string) => {
    navigate(`/liff/search/position/${code}?tenant=${tenantId}`);
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
      <div className="bg-[#FF6B6B] text-white p-4">
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
          <Award className="h-6 w-6" />
          <h2 className="text-2xl font-bold">ตำแหน่งใน BNI</h2>
        </div>
        <p className="text-white/80 text-sm">
          เลือกตำแหน่งเพื่อดูรายชื่อสมาชิก
        </p>
      </div>

      <div className="p-4 space-y-3">
        {positions.map((position) => (
          <Card 
            key={position.position_code}
            className="overflow-hidden hover-elevate cursor-pointer"
            onClick={() => handlePositionClick(position.position_code)}
            data-testid={`card-position-${position.position_code}`}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 bg-[#FF6B6B]/10 rounded-full flex items-center justify-center">
                    <Award className="h-6 w-6 text-[#FF6B6B]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{position.name_th}</h3>
                    <p className="text-sm text-muted-foreground">{position.name_en}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {position.member_count} คน
                  </span>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {positions.length === 0 && (
        <div className="p-8 text-center">
          <p className="text-muted-foreground">ไม่พบสมาชิกตามตำแหน่ง</p>
        </div>
      )}
    </div>
  );
}
