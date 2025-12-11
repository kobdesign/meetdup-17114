import { useEffect, useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ChevronRight, Loader2, Send, CheckCircle, Search, X } from "lucide-react";
import liff from "@line/liff";

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
  const [liffAccessToken, setLiffAccessToken] = useState<string | null>(null);
  const [liffReady, setLiffReady] = useState(false);
  const [sendingCategory, setSendingCategory] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const searchParams = new URLSearchParams(location.search);
  const tenantId = searchParams.get("tenant");

  // Filter categories based on search query
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) {
      return categories;
    }
    
    const query = searchQuery.toLowerCase().trim();
    return categories.filter(cat => {
      const matchNameTh = cat.name_th?.toLowerCase().includes(query);
      const matchNameEn = cat.name_en?.toLowerCase().includes(query);
      const matchCode = cat.category_code?.toLowerCase().includes(query);
      return matchNameTh || matchNameEn || matchCode;
    });
  }, [categories, searchQuery]);

  // Initialize LIFF
  useEffect(() => {
    const initLiff = async () => {
      try {
        // Get LIFF ID from settings
        const settingsRes = await fetch("/api/public/liff-config");
        const settings = await settingsRes.json();
        
        if (!settings.liff_id) {
          console.log("[LiffCategories] LIFF not configured, will use fallback mode");
          setLiffReady(true);
          return;
        }

        await liff.init({ liffId: settings.liff_id });
        
        if (liff.isLoggedIn()) {
          // Get access token for secure API calls
          const accessToken = liff.getAccessToken();
          if (accessToken) {
            setLiffAccessToken(accessToken);
            console.log("[LiffCategories] LIFF initialized with access token");
          }
        } else {
          console.log("[LiffCategories] User not logged in to LINE");
        }
        
        setLiffReady(true);
      } catch (err) {
        console.error("[LiffCategories] LIFF init error:", err);
        setLiffReady(true); // Continue anyway, will use fallback navigation
      }
    };

    initLiff();
  }, []);

  // Fetch categories
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

  const handleCategoryClick = async (code: string, categoryName: string) => {
    // If we have LIFF access token, push cards directly to chat
    if (liffAccessToken && tenantId) {
      setSendingCategory(code);
      setSuccessMessage(null);
      
      try {
        const response = await fetch("/api/public/liff/search-by-category", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            accessToken: liffAccessToken,
            tenantId,
            categoryCode: code,
          }),
        });

        const result = await response.json();

        if (response.ok && result.success) {
          console.log("[LiffCategories] Cards sent:", result);
          setSuccessMessage(`ส่งนามบัตร ${result.count} ใบไปที่แชทแล้ว`);
          
          // Close LIFF after short delay to show success message
          setTimeout(() => {
            if (liff.isInClient()) {
              liff.closeWindow();
            }
          }, 1500);
        } else {
          console.error("[LiffCategories] API error:", result);
          // Fallback to navigation if push fails
          navigate(`/liff/search/category/${code}?tenant=${tenantId}`);
        }
      } catch (err) {
        console.error("[LiffCategories] Request error:", err);
        // Fallback to navigation on error
        navigate(`/liff/search/category/${code}?tenant=${tenantId}`);
      } finally {
        setSendingCategory(null);
      }
    } else {
      // Fallback: navigate to list page if no LINE user ID
      navigate(`/liff/search/category/${code}?tenant=${tenantId}`);
    }
  };

  if (loading || !liffReady) {
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
          {liffAccessToken 
            ? "กดเลือกประเภทธุรกิจ เพื่อรับนามบัตรสมาชิกในแชทของคุณ"
            : "กรุณาเลือกประเภทธุรกิจจากลิสต์ด้านล่างเพื่อดูรายชื่อสมาชิก"}
        </p>
      </div>

      {/* Search Input */}
      <div className="p-4 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="ค้นหาประเภทธุรกิจ..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-9"
            data-testid="input-search-category"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => setSearchQuery("")}
              data-testid="button-clear-search"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        {searchQuery && (
          <p className="text-sm text-muted-foreground mt-2">
            พบ {filteredCategories.length} หมวดหมู่{filteredCategories.length !== categories.length && ` จาก ${categories.length} หมวดหมู่`}
          </p>
        )}
      </div>

      {successMessage && (
        <div className="mx-4 mt-4 p-4 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
          <span className="text-green-800 dark:text-green-300">{successMessage}</span>
        </div>
      )}

      <div className="p-4 pt-2 grid grid-cols-2 gap-4">
        {filteredCategories.map((category) => (
          <Card 
            key={category.category_code}
            className="overflow-hidden hover-elevate cursor-pointer"
            onClick={() => handleCategoryClick(category.category_code, category.name_th)}
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
                disabled={sendingCategory === category.category_code}
              >
                {sendingCategory === category.category_code ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    กำลังส่ง...
                  </>
                ) : liffAccessToken ? (
                  <>
                    <Send className="h-4 w-4 mr-1" />
                    ส่งนามบัตร
                  </>
                ) : (
                  <>
                    สมาชิกทั้งหมด
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredCategories.length === 0 && searchQuery && (
        <div className="p-8 text-center">
          <Search className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">ไม่พบหมวดหมู่ที่ตรงกับ "{searchQuery}"</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSearchQuery("")}
            className="mt-3"
          >
            ล้างการค้นหา
          </Button>
        </div>
      )}

      {categories.length === 0 && !searchQuery && (
        <div className="p-8 text-center">
          <p className="text-muted-foreground">ไม่พบประเภทธุรกิจที่มีสมาชิก</p>
        </div>
      )}
    </div>
  );
}
