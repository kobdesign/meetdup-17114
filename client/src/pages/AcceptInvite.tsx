import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Loader2, XCircle, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useTenantContext } from "@/contexts/TenantContext";

export default function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { setSelectedChapter } = useTenantContext();
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const acceptInviteMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      // If not logged in, redirect to auth with return path
      if (!session) {
        navigate(`/auth?redirect=/invite/${token}`);
        throw new Error("Please login first");
      }

      return apiRequest(
        `/api/chapters/invite/accept/${token}`,
        "POST",
        {},
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );
    },
    onSuccess: async (data) => {
      setAccepted(true);
      toast.success(data.message || "เข้าร่วม Chapter สำเร็จ!");
      
      // Wait for cache to refresh completely before switching chapter
      console.log("[AcceptInvite] Invalidating and refetching user-tenant-info...");
      await queryClient.invalidateQueries({ queryKey: ["/api/user-tenant-info"] });
      
      // CRITICAL: Must await refetch to complete so userChapters includes new chapter
      await queryClient.refetchQueries({ queryKey: ["/api/user-tenant-info"], type: 'all' });
      console.log("[AcceptInvite] Refetch complete, userChapters now includes new chapter");
      
      // Small delay to ensure context updates
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Auto-switch to new chapter (now safe because userChapters is updated)
      if (data.tenant_id) {
        console.log("[AcceptInvite] Auto-switching to new chapter:", data.tenant_id);
        setSelectedChapter(data.tenant_id);
      }
      
      console.log("[AcceptInvite] Cache refreshed, navigating to /admin");
      navigate("/admin");
    },
    onError: (error: any) => {
      setError(error.message || "เกิดข้อผิดพลาด");
      toast.error(error.message || "ไม่สามารถเข้าร่วม Chapter ได้");
    },
  });

  const handleAcceptInvite = async () => {
    setAccepting(true);
    try {
      await acceptInviteMutation.mutateAsync();
    } finally {
      setAccepting(false);
    }
  };

  // Note: Removed eager redirect - let mutation handle auth check
  // This prevents redirect loop after login when session is still hydrating

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="text-2xl">ไม่สามารถใช้คำเชิญได้</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate("/welcome")}
              data-testid="button-back-to-welcome"
            >
              กลับไปหน้าแรก
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
            <CardTitle className="text-2xl">กำลังตั้งค่าบัญชีของคุณ...</CardTitle>
            <CardDescription>
              กรุณารอสักครู่
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-accent/10 flex items-center justify-center">
            <UserPlus className="h-8 w-8 text-accent" />
          </div>
          <CardTitle className="text-2xl">คุณได้รับเชิญเข้าร่วม Chapter</CardTitle>
          <CardDescription>
            คลิกปุ่มด้านล่างเพื่อยอมรับคำเชิญและเข้าร่วม Chapter
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            className="w-full"
            size="lg"
            onClick={handleAcceptInvite}
            disabled={accepting}
            data-testid="button-accept-invite"
          >
            {accepting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            ยอมรับคำเชิญ
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => navigate("/welcome")}
            disabled={accepting}
            data-testid="button-decline"
          >
            ปฏิเสธ
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
