import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Users, Briefcase, Award, Search, Loader2, Phone, Mail, ExternalLink, Share2, MessageCircle } from "lucide-react";
import { SiLine } from "react-icons/si";

interface Tenant {
  tenant_id: string;
  tenant_name: string;
  logo_url: string | null;
}

interface SearchResult {
  participant_id: string;
  full_name_th: string;
  nickname_th: string | null;
  position: string | null;
  company: string | null;
  phone: string | null;
  email: string | null;
  photo_url: string | null;
  tagline: string | null;
  line_id: string | null;
}

export default function LiffSearchHome() {
  const navigate = useNavigate();
  const location = useLocation();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Text search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);

  const searchParams = new URLSearchParams(location.search);
  const tenantId = searchParams.get("tenant");
  const tabParam = searchParams.get("tab");
  const viewParam = searchParams.get("view"); // Support for LIFF URL query parameter
  const initialQuery = searchParams.get("q"); // Pre-filled search query from "View More" button

  // Auto-redirect based on tab or view parameter
  useEffect(() => {
    if (!tenantId) return;
    
    // Support both 'tab' and 'view' parameters for backward compatibility
    const targetView = tabParam || viewParam;
    
    if (targetView === "category" || targetView === "categories") {
      navigate(`/liff/search/category?tenant=${tenantId}`, { replace: true });
      return;
    }
    if (targetView === "powerteam") {
      navigate(`/liff/search/powerteam?tenant=${tenantId}`, { replace: true });
      return;
    }
    if (targetView === "position") {
      navigate(`/liff/search/position?tenant=${tenantId}`, { replace: true });
      return;
    }
  }, [tenantId, tabParam, viewParam, navigate]);
  
  // Auto-search when initialQuery is provided (from "View More" button)
  useEffect(() => {
    if (initialQuery && tenantId) {
      setSearchQuery(initialQuery);
      performSearch(initialQuery);
    }
  }, [initialQuery, tenantId]);
  
  // Search function
  const performSearch = async (query: string) => {
    if (!query.trim() || !tenantId) return;
    
    setIsSearching(true);
    setShowSearchResults(true);
    
    try {
      const response = await fetch("/api/public/liff/search-members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          query: query.trim()
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSearchResults(data.participants || []);
      } else {
        console.error("Search error:", data.error);
        setSearchResults([]);
      }
    } catch (err) {
      console.error("Search failed:", err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };
  
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(searchQuery);
  };
  
  const handleClearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    setShowSearchResults(false);
  };

  useEffect(() => {
    if (!tenantId) {
      setError("Missing tenant parameter");
      setLoading(false);
      return;
    }

    // Skip fetching if we're redirecting
    if (tabParam || viewParam) return;

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
  }, [tenantId, tabParam, viewParam]);

  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      if (typeof window !== "undefined" && (window as any).liff) {
        (window as any).liff.closeWindow();
      }
    }
  };

  // Pre-compute baseUrl for share links (safe for SSR/test contexts)
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  
  // Helper function to generate share URL
  const getShareUrl = (participantId: string) => {
    if (!baseUrl || !tenantId) return "";
    const flexJsonUrl = `${baseUrl}/api/public/share-flex/${participantId}?tenantId=${tenantId}&format=raw`;
    return `https://line-share-flex-api.lovable.app/share?messages=${encodeURIComponent(flexJsonUrl)}`;
  };

  const searchOptions = [
    {
      id: "category",
      title: "ประเภทธุรกิจ",
      subtitle: "ค้นหาจาก",
      icon: Briefcase,
      path: `/liff/search/category?tenant=${tenantId}`,
      disabled: false,
    },
    {
      id: "powerteam",
      title: "Power Team",
      subtitle: "ค้นหาจาก",
      icon: Users,
      path: `/liff/search/powerteam?tenant=${tenantId}`,
      disabled: false,
    },
    {
      id: "position",
      title: "ตำแหน่งใน BNI",
      subtitle: "ค้นหาจาก",
      icon: Award,
      path: `/liff/search/position?tenant=${tenantId}`,
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

        {/* Text Search Form */}
        <form onSubmit={handleSearchSubmit} className="mt-4">
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="พิมพ์ชื่อ, ชื่อเล่น, บริษัท..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/50"
              data-testid="input-search"
            />
            <Button 
              type="submit" 
              variant="secondary"
              disabled={isSearching || !searchQuery.trim()}
              data-testid="button-search"
            >
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
        </form>
      </div>

      {/* Search Results */}
      {showSearchResults && (
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground">
              {isSearching ? "กำลังค้นหา..." : `ผลการค้นหา "${searchQuery}" (${searchResults.length} คน)`}
            </h2>
            <Button variant="ghost" size="sm" onClick={handleClearSearch} data-testid="button-clear-search">
              ล้างผลลัพธ์
            </Button>
          </div>
          
          {isSearching ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : searchResults.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                ไม่พบสมาชิกที่ตรงกับคำค้นหา
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {searchResults.map((member) => (
                <Card 
                  key={member.participant_id} 
                  className="overflow-hidden hover-elevate cursor-pointer"
                  onClick={() => navigate(`/p/${member.participant_id}`)}
                  data-testid={`card-member-${member.participant_id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {member.photo_url ? (
                        <img 
                          src={member.photo_url} 
                          alt={member.full_name_th}
                          className="h-14 w-14 rounded-full object-cover border-2 border-primary/20"
                        />
                      ) : (
                        <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center border-2 border-primary/20">
                          <span className="text-lg font-bold text-muted-foreground">
                            {member.full_name_th?.charAt(0)}
                          </span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground truncate">
                          {member.full_name_th}
                          {member.nickname_th && (
                            <span className="text-primary ml-2">"{member.nickname_th}"</span>
                          )}
                        </p>
                        {(member.position || member.company) && (
                          <p className="text-sm text-muted-foreground truncate">
                            {[member.position, member.company].filter(Boolean).join(" | ")}
                          </p>
                        )}
                        {member.tagline && (
                          <p className="text-xs text-muted-foreground italic mt-1 line-clamp-2">
                            "{member.tagline}"
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          {member.phone && (
                            <a 
                              href={`tel:${member.phone}`} 
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-1 text-xs text-primary"
                              data-testid={`link-phone-${member.participant_id}`}
                            >
                              <Phone className="h-3 w-3" />
                              โทร
                            </a>
                          )}
                          {member.email && (
                            <a 
                              href={`mailto:${member.email}`}
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-1 text-xs text-primary"
                              data-testid={`link-email-${member.participant_id}`}
                            >
                              <Mail className="h-3 w-3" />
                              Email
                            </a>
                          )}
                          {member.line_id && (
                            <a 
                              href={member.line_id.startsWith("@") 
                                ? `https://line.me/R/ti/p/@${member.line_id.substring(1)}`
                                : `https://line.me/ti/p/~${member.line_id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-1 text-xs text-[#00B900]"
                              data-testid={`link-line-${member.participant_id}`}
                            >
                              <SiLine className="h-3 w-3" />
                              LINE
                            </a>
                          )}
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <ExternalLink className="h-3 w-3" />
                            ดูโปรไฟล์
                          </span>
                          {getShareUrl(member.participant_id) && (
                            <a
                              href={getShareUrl(member.participant_id)}
                              onClick={(e) => e.stopPropagation()}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-xs text-green-600"
                              data-testid={`link-share-${member.participant_id}`}
                            >
                              <Share2 className="h-3 w-3" />
                              แชร์
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Category Search Options */}
      {!showSearchResults && (
        <div className="p-4">
          <p className="text-sm text-muted-foreground mb-4">หรือค้นหาจากหมวดหมู่</p>
          <div className="grid grid-cols-1 gap-4">
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
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4">
        <p className="text-center text-sm text-muted-foreground">
          Search Member
        </p>
      </div>
    </div>
  );
}
