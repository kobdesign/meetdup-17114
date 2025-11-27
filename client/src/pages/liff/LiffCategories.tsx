import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronRight, Loader2 } from "lucide-react";

interface Category {
  category_code: string;
  name_th: string;
  name_en: string | null;
  member_count: number;
}

interface Tenant {
  tenant_id: string;
  tenant_name: string;
  logo_url: string | null;
}

export default function LiffCategories() {
  const navigate = useNavigate();
  const location = useLocation();
  const [categories, setCategories] = useState<Category[]>([]);
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
      fetch(`/api/public/categories?tenantId=${tenantId}`).then(res => {
        if (!res.ok) throw new Error(`Categories: HTTP ${res.status}`);
        return res.json();
      })
    ])
      .then(([tenantData, categoriesData]) => {
        if (tenantData.error) {
          setError(tenantData.error);
          return;
        }
        if (categoriesData.error) {
          setError(categoriesData.error);
          return;
        }
        if (tenantData.tenant) {
          setTenant(tenantData.tenant);
        }
        if (categoriesData.categories) {
          setCategories(categoriesData.categories.filter((c: Category) => c.member_count > 0));
        }
      })
      .catch(err => {
        console.error("Error fetching data:", err);
        setError("Failed to load categories");
      })
      .finally(() => setLoading(false));
  }, [tenantId]);

  const handleBack = () => {
    navigate(`/liff/search?tenant=${tenantId}`);
  };

  const handleCategoryClick = (code: string) => {
    navigate(`/liff/search/category/${code}?tenant=${tenantId}`);
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

        <h2 className="text-2xl font-bold mb-2">ประเภทธุรกิจ</h2>
        <p className="text-primary-foreground/80 text-sm">
          กรุณาเลือกประเภทธุรกิจจากลิสต์ด้านล่างเพื่อดูรายชื่อสมาชิกของ ประเภทธุรกิจนั้นๆ
        </p>
      </div>

      <div className="p-4 grid grid-cols-2 gap-4">
        {categories.map((category, index) => (
          <Card 
            key={category.category_code}
            className="overflow-hidden hover-elevate cursor-pointer"
            onClick={() => handleCategoryClick(category.category_code)}
            data-testid={`card-category-${category.category_code}`}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-primary font-medium">
                  ประเภทที่ {category.category_code}
                </span>
                <span className="text-xs text-muted-foreground">
                  ({category.member_count} คน)
                </span>
              </div>
              <h3 className="font-bold text-lg mb-2 line-clamp-2">
                {category.name_th}
              </h3>
              {category.name_en && (
                <p className="text-xs text-muted-foreground line-clamp-1 mb-3">
                  {category.name_en}
                </p>
              )}
              <Button 
                variant="default" 
                size="sm" 
                className="w-full"
              >
                สมาชิกทั้งหมด
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {categories.length === 0 && (
        <div className="p-8 text-center">
          <p className="text-muted-foreground">ไม่พบประเภทธุรกิจที่มีสมาชิก</p>
        </div>
      )}
    </div>
  );
}
