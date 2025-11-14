import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Search, Loader2, Building2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface Chapter {
  tenant_id: string;
  tenant_name: string;
  subdomain: string;
  created_at: string;
}

export default function DiscoverChapters() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: chapters = [], isLoading } = useQuery({
    queryKey: ["/api/chapters/discover", searchQuery],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("ไม่พบ session");

      const url = searchQuery
        ? `/api/chapters/discover?search=${encodeURIComponent(searchQuery)}`
        : "/api/chapters/discover";

      return apiRequest(
        url,
        "GET",
        undefined,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );
    },
  });

  const joinRequestMutation = useMutation({
    mutationFn: async ({ tenantId, message }: { tenantId: string; message?: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("ไม่พบ session");

      return apiRequest(
        `/api/chapters/join-request`,
        "POST",
        { tenant_id: tenantId, message },
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );
    },
    onSuccess: () => {
      toast.success("ส่งคำขอเข้าร่วมแล้ว รอการอนุมัติจาก Admin");
      queryClient.invalidateQueries({ queryKey: ["/api/chapters/discover"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "เกิดข้อผิดพลาด");
    },
  });

  const handleJoinRequest = (tenantId: string) => {
    joinRequestMutation.mutate({ tenantId });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 p-4">
      <div className="max-w-4xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate("/welcome")}
          className="mb-4"
          data-testid="button-back"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          ย้อนกลับ
        </Button>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">ค้นหา Chapter</h1>
          <p className="text-muted-foreground">
            เลือก Chapter ที่คุณต้องการเข้าร่วมและส่งคำขอ
          </p>
        </div>

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="ค้นหาชื่อ Chapter..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : chapters.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                {searchQuery ? "ไม่พบ Chapter ที่ตรงกับการค้นหา" : "ยังไม่มี Chapter ในระบบ"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {chapters.map((chapter: Chapter) => (
              <Card
                key={chapter.tenant_id}
                className="hover-elevate transition-all"
                data-testid={`chapter-card-${chapter.tenant_id}`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex gap-4">
                      <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Building2 className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{chapter.tenant_name}</CardTitle>
                        <CardDescription>
                          Subdomain: {chapter.subdomain}
                        </CardDescription>
                      </div>
                    </div>
                    <Button
                      onClick={() => handleJoinRequest(chapter.tenant_id)}
                      disabled={joinRequestMutation.isPending}
                      data-testid={`button-request-join-${chapter.tenant_id}`}
                    >
                      {joinRequestMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                      )}
                      ขอเข้าร่วม
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
