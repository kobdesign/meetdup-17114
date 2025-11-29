import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import AdminLayout from "@/components/layout/AdminLayout";
import { useTenantContext } from "@/contexts/TenantContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Copy, Loader2, Check, X, Link2, UserPlus, Mail, User, Building2, Briefcase, Phone, AtSign, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { apiRequest, queryClient } from "@/lib/queryClient";
import SelectTenantPrompt from "@/components/SelectTenantPrompt";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function MembersManagement() {
  const { effectiveTenantId, isSuperAdmin } = useTenantContext();
  const [copiedLink, setCopiedLink] = useState(false);
  const [activationDialogOpen, setActivationDialogOpen] = useState(false);
  const [selectedActivationLink, setSelectedActivationLink] = useState<string | null>(null);

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

  // Query for inactive members (imported members without user_id)
  const { data: inactiveMembers = [] } = useQuery({
    queryKey: ["/api/participants", effectiveTenantId, "inactive"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participants")
        .select("participant_id, full_name_th, phone, email, status, line_user_id")
        .eq("tenant_id", effectiveTenantId!)
        .eq("status", "member")
        .is("user_id", null)
        .order("full_name_th");

      if (error) throw error;
      return data;
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

  const generateActivationLinkMutation = useMutation({
    mutationFn: async ({ participantId }: { participantId: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");

      return apiRequest(
        "/api/participants/generate-activation-link",
        "POST",
        { participant_id: participantId, tenant_id: effectiveTenantId },
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
    },
    onSuccess: (data) => {
      setSelectedActivationLink(data.activation_url);
      setActivationDialogOpen(true);
      toast.success("สร้างลิงก์ลงทะเบียนสำเร็จ!");
    },
    onError: (error: any) => {
      toast.error(error.message || "เกิดข้อผิดพลาด");
    },
  });

  const sendLiffActivationMutation = useMutation({
    mutationFn: async ({ participantId }: { participantId: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");

      return apiRequest(
        "/api/participants/send-liff-activation",
        "POST",
        { participant_id: participantId, tenant_id: effectiveTenantId },
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
    },
    onSuccess: (data) => {
      toast.success("ส่งลิงก์ LIFF ผ่าน LINE สำเร็จ!");
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

  const handleCopyActivationLink = () => {
    if (selectedActivationLink) {
      copyToClipboard(selectedActivationLink);
    }
  };

  if (!effectiveTenantId && isSuperAdmin) {
    return (
      <AdminLayout>
        <SelectTenantPrompt />
      </AdminLayout>
    );
  }

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
            <TabsTrigger value="activation" data-testid="tab-activation">
              <Mail className="mr-2 h-4 w-4" />
              รอ Activate
              {inactiveMembers.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {inactiveMembers.length}
                </Badge>
              )}
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

          <TabsContent value="activation" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>สมาชิกที่รอ Activate บัญชี</CardTitle>
                <CardDescription>
                  สมาชิกที่นำเข้าจาก Excel แล้วยังไม่ได้ลงทะเบียนบัญชีผู้ใช้
                </CardDescription>
              </CardHeader>
            </Card>

            <div className="grid gap-4">
              {inactiveMembers.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    สมาชิกทุกคนมีบัญชีผู้ใช้แล้ว
                  </CardContent>
                </Card>
              ) : (
                inactiveMembers.map((member: any) => (
                  <Card key={member.participant_id} data-testid={`member-card-${member.participant_id}`}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">{member.full_name_th || member.full_name}</p>
                            {member.line_user_id && (
                              <Badge variant="outline" className="text-xs">
                                <MessageCircle className="mr-1 h-3 w-3" />
                                LINE
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {member.phone}
                          </p>
                          {member.email && (
                            <p className="text-sm text-muted-foreground">
                              {member.email}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {member.line_user_id && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => sendLiffActivationMutation.mutate({ 
                                participantId: member.participant_id 
                              })}
                              disabled={sendLiffActivationMutation.isPending}
                              data-testid={`button-send-liff-${member.participant_id}`}
                            >
                              {sendLiffActivationMutation.isPending && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              )}
                              <MessageCircle className="mr-2 h-4 w-4" />
                              Send via LINE
                            </Button>
                          )}
                          <Button
                            size="sm"
                            onClick={() => generateActivationLinkMutation.mutate({ 
                              participantId: member.participant_id 
                            })}
                            disabled={generateActivationLinkMutation.isPending}
                            data-testid={`button-generate-activation-${member.participant_id}`}
                          >
                            {generateActivationLinkMutation.isPending && (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            <Mail className="mr-2 h-4 w-4" />
                            ส่งลิงก์ลงทะเบียน
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
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
                joinRequests.map((request: any) => {
                  const participant = request.participant;
                  const displayName = participant?.full_name_th || participant?.full_name || request.user_email || "ผู้ใช้";
                  const initials = displayName
                    .split(' ')
                    .map((n: string) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2);

                  return (
                    <Card key={request.request_id} data-testid={`request-card-${request.request_id}`}>
                      <CardContent className="pt-6">
                        <div className="flex gap-4">
                          {/* Avatar */}
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={participant?.photo_url || undefined} alt={displayName} />
                            <AvatarFallback>
                              <User className="h-5 w-5" />
                            </AvatarFallback>
                          </Avatar>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            {/* Name */}
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-semibold text-lg">{displayName}</p>
                              {request.status !== "pending" && (
                                <Badge variant={request.status === "approved" ? "default" : "destructive"} className="text-xs">
                                  {request.status === "approved" ? "อนุมัติแล้ว" : "ปฏิเสธแล้ว"}
                                </Badge>
                              )}
                            </div>

                            {/* Company & Position */}
                            {(participant?.company || participant?.position) && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                                <Building2 className="h-4 w-4 flex-shrink-0" />
                                <span className="truncate">
                                  {participant?.position && participant?.company
                                    ? `${participant.position} ที่ ${participant.company}`
                                    : participant?.position || participant?.company}
                                </span>
                              </div>
                            )}

                            {/* Contact Info */}
                            <div className="space-y-1">
                              {participant?.phone && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Phone className="h-4 w-4 flex-shrink-0" />
                                  <span>{participant.phone}</span>
                                </div>
                              )}
                              {(participant?.email || request.user_email) && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <AtSign className="h-4 w-4 flex-shrink-0" />
                                  <span className="truncate">{participant?.email || request.user_email}</span>
                                </div>
                              )}
                            </div>

                            {/* Message */}
                            {request.message && (
                              <div className="mt-3 p-3 bg-muted rounded-md">
                                <p className="text-sm italic">"{request.message}"</p>
                              </div>
                            )}

                            {/* Request Date */}
                            <p className="text-xs text-muted-foreground mt-2">
                              ส่งคำขอเมื่อ: {new Date(request.created_at).toLocaleString('th-TH')}
                            </p>
                          </div>

                          {/* Action Buttons */}
                          {request.status === "pending" && (
                            <div className="flex gap-2 items-start">
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
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Activation Link Dialog */}
        <Dialog open={activationDialogOpen} onOpenChange={setActivationDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>ลิงก์ลงทะเบียนบัญชี</DialogTitle>
              <DialogDescription>
                ส่งลิงก์นี้ให้สมาชิกเพื่อลงทะเบียนบัญชีผู้ใช้
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-4 bg-muted rounded-md">
                <p className="text-sm font-mono flex-1 break-all">
                  {selectedActivationLink}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleCopyActivationLink}
                  className="flex-1"
                  data-testid="button-copy-activation-link"
                >
                  {copiedLink ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                  คัดลอกลิงก์
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setActivationDialogOpen(false)}
                  data-testid="button-close-dialog"
                >
                  ปิด
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
