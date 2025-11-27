import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Users, Briefcase, Award, Search, Loader2 } from "lucide-react";

interface Tenant {
  tenant_id: string;
  tenant_name: string;
  logo_url: string | null;
}

export default function LiffSearchHome() {
  const navigate = useNavigate();
  const location = useLocation();
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

    fetch(`/api/public/tenant/${tenantId}`)
      .then(res => res.json())
      .then(data => {
        if (data.tenant) {
          setTenant(data.tenant);
        } else {
          setError("Chapter not found");
        }
      })
      .catch(err => {
        console.error("Error fetching tenant:", err);
        setError("Failed to load chapter");
      })
      .finally(() => setLoading(false));
  }, [tenantId]);

  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      if (typeof window !== "undefined" && (window as any).liff) {
        (window as any).liff.closeWindow();
      }
    }
  };

  const searchOptions = [
    {
      id: "position",
      title: "ตำแหน่งใน BNI",
      subtitle: "ค้นหาจาก",
      icon: Award,
      path: `/liff/search/position?tenant=${tenantId}`,
      disabled: true,
    },
    {
      id: "powerteam",
      title: "Power Team",
      subtitle: "ค้นหาจาก",
      icon: Users,
      path: `/liff/search/powerteam?tenant=${tenantId}`,
      disabled: true,
    },
    {
      id: "category",
      title: "ประเภทธุรกิจ",
      subtitle: "ค้นหาจาก",
      icon: Briefcase,
      path: `/liff/search/category?tenant=${tenantId}`,
      disabled: false,
    },
  ];

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
    <div className="min-h-screen bg-background">
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
              className="h-12 w-auto"
            />
          ) : (
            <div className="h-12 w-12 bg-primary-foreground/20 rounded-md flex items-center justify-center">
              <span className="text-xl font-bold">{tenant?.tenant_name?.charAt(0)}</span>
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold">{tenant?.tenant_name}</h1>
          </div>
        </div>

        <p className="text-primary-foreground/80">
          ค้นหาสมาชิกจากเมนู
        </p>
        <p className="text-sm text-primary-foreground/60">
          หรือสามารถพิมพ์ Keywords เช่นชื่อเล่นได้เลย
        </p>
      </div>

      <div className="p-4 grid grid-cols-1 gap-4">
        {searchOptions.map((option) => (
          <Card 
            key={option.id}
            className={`overflow-hidden hover-elevate cursor-pointer ${option.disabled ? "opacity-50" : ""}`}
            onClick={() => !option.disabled && navigate(option.path)}
            data-testid={`card-search-${option.id}`}
          >
            <CardContent className="p-0">
              <div className="flex items-center gap-4 p-4">
                <div className="h-16 w-16 bg-muted rounded-md flex items-center justify-center">
                  <option.icon className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">{option.subtitle}</p>
                  <p className="text-lg font-semibold">{option.title}</p>
                  {option.disabled && (
                    <p className="text-xs text-muted-foreground">เร็วๆ นี้</p>
                  )}
                </div>
                <Search className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4">
        <p className="text-center text-sm text-muted-foreground">
          Search Member
        </p>
      </div>
    </div>
  );
}
