import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import AdminLayout from "@/components/layout/AdminLayout";
import { useTenantContext } from "@/contexts/TenantContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, Loader2, Check, X, Link2, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function MembersManagement() {
  const { effectiveTenantId } = useTenantContext();
  const [copiedLink, setCopiedLink] = useState(false);

  const { data: invites = [] } = useQuery({
    queryKey: ["/api/chapters/invites", effectiveTenantId],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");

      return apiRequest(
        `/api/chapters/invites?tenant_id=${effectiveTenantId}`,
        "GET",
        undefined,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
    },
    enabled: !!effectiveTenantId,
  });

  const { data: joinRequests = [] } = useQuery({
    queryKey: ["/api/chapters/join-requests", effectiveTenantId],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");

      return apiRequest(
        `/api/chapters/join-requests?tenant_id=${effectiveTenantId}`,
        "GET",
        undefined,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
    },
    enabled: !!effectiveTenantId,
  });

  const createInviteMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");

      return apiRequest(
        "/api/chapters/invite/generate",
        "POST",
        { tenant_id: effectiveTenantId, max_uses: 100, expires_in_days: 30 },
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
    },
    onSuccess: (data) => {
      toast.success("สร้าง Invite Link สำเร็จ!");
      queryClient.invalidateQueries({ queryKey: ["/api/chapters/invites"] });
      copyToClipboard(data.inviteUrl);
    },
    onError: (error: any) => {
      toast.error(error.message || "เกิดข้อผิดพลาด");
    },
  });

  const handleJoinRequestMutation = useMutation({
    mutationFn: async ({ requestId, action }: { requestId: string; action: "approve" | "reject" }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");

      return apiRequest(
        `/api/chapters/join-request/${requestId}/${action}`,
        "POST",
        {},
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
    },
    onSuccess: (_, variables) => {
      toast.success(variables.action === "approve" ? "อนุมัติสำเร็จ!" : "ปฏิเสธสำเร็จ!");
      queryClient.invalidateQueries({ queryKey: ["/api/chapters/join-requests"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "เกิดข้อผิดพลาด");
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(true);
    toast.success("คัดลอก link แล้ว!");
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">จัดการสมาชิก</h1>
          <p className="text-muted-foreground">เชิญสมาชิกใหม่และอนุมัติคำขอเข้าร่วม</p>
        </div>

        <Tabs defaultValue="invites" className="space-y-4">
          <TabsList>
            <TabsTrigger value="invites" data-testid="tab-invites">
              <Link2 className="mr-2 h-4 w-4" />
              Invite Links
            </TabsTrigger>
            <TabsTrigger value="requests" data-testid="tab-join-requests">
              <UserPlus className="mr-2 h-4 w-4" />
              คำขอเข้าร่วม
              {joinRequests.filter((r: any) => r.status === "pending").length > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {joinRequests.filter((r: any) => r.status === "pending").length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="invites" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>สร้าง Invite Link</CardTitle>
                <CardDescription>
                  สร้างลิงก์เชิญสมาชิกเข้าร่วม Chapter (ใช้ได้ 100 ครั้ง, หมดอายุ 30 วัน)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => createInviteMutation.mutate()}
                  disabled={createInviteMutation.isPending}
                  data-testid="button-create-invite"
                >
                  {createInviteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  สร้าง Invite Link
                </Button>
              </CardContent>
            </Card>

            <div className="grid gap-4">
              {invites.map((invite: any) => (
                <Card key={invite.invite_id}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-mono text-muted-foreground truncate">
                          {window.location.origin}/invite/{invite.token}
                        </p>
                        <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                          <span>ใช้ไป: {invite.uses_count}/{invite.max_uses}</span>
                          <span>หมดอายุ: {new Date(invite.expires_at).toLocaleDateString('th-TH')}</span>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(`${window.location.origin}/invite/${invite.token}`)}
                        data-testid={`button-copy-${invite.invite_id}`}
                      >
                        {copiedLink ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="requests" className="space-y-4">
            <div className="grid gap-4">
              {joinRequests.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    ไม่มีคำขอเข้าร่วม
                  </CardContent>
                </Card>
              ) : (
                joinRequests.map((request: any) => (
                  <Card key={request.request_id} data-testid={`request-card-${request.request_id}`}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-semibold">{request.user_email || "User"}</p>
                          <p className="text-sm text-muted-foreground">
                            ส่งคำขอเมื่อ: {new Date(request.created_at).toLocaleString('th-TH')}
                          </p>
                          {request.message && (
                            <p className="text-sm mt-2">{request.message}</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {request.status === "pending" ? (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleJoinRequestMutation.mutate({ 
                                  requestId: request.request_id, 
                                  action: "approve" 
                                })}
                                disabled={handleJoinRequestMutation.isPending}
                                data-testid={`button-approve-${request.request_id}`}
                              >
                                <Check className="mr-2 h-4 w-4" />
                                อนุมัติ
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleJoinRequestMutation.mutate({ 
                                  requestId: request.request_id, 
                                  action: "reject" 
                                })}
                                disabled={handleJoinRequestMutation.isPending}
                                data-testid={`button-reject-${request.request_id}`}
                              >
                                <X className="mr-2 h-4 w-4" />
                                ปฏิเสธ
                              </Button>
                            </>
                          ) : (
                            <Badge variant={request.status === "approved" ? "default" : "destructive"}>
                              {request.status === "approved" ? "อนุมัติแล้ว" : "ปฏิเสธแล้ว"}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
