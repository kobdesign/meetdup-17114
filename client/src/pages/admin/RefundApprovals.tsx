import { useEffect, useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, XCircle, Clock, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface RefundRequest {
  request_id: string;
  payment_id: string;
  requested_by: string;
  approved_by: string | null;
  reason: string;
  status: string;
  requested_at: string;
  processed_at: string | null;
  admin_notes: string | null;
  tenant_id: string;
  payment?: any;
  requester_email?: string;
  tenant_name?: string;
}

export default function RefundApprovals() {
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<RefundRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<RefundRequest | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [processing, setProcessing] = useState(false);
  const [showNotesDialog, setShowNotesDialog] = useState(false);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if user is super admin
      const { data: userRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "super_admin")
        .single();

      if (!userRole) {
        toast.error("คุณไม่มีสิทธิ์เข้าถึงหน้านี้");
        return;
      }

      // Load all refund requests
      const { data: requestsData, error: requestsError } = await supabase
        .from("refund_requests")
        .select(`
          *,
          payments!inner(amount, currency, participant_id, participants(full_name))
        `)
        .order("requested_at", { ascending: false });

      if (requestsError) throw requestsError;

      // Load additional data
      const enrichedRequests = await Promise.all(
        (requestsData || []).map(async (req) => {
          // Get requester email
          const { data: userData } = await supabase.functions.invoke('manage-user-roles', {
            body: { action: 'get_user_by_id', userId: req.requested_by }
          });

          // Get tenant name
          const { data: tenantData } = await supabase
            .from("tenants")
            .select("name")
            .eq("tenant_id", req.tenant_id)
            .single();

          return {
            ...req,
            requester_email: userData?.user?.email || "Unknown",
            tenant_name: tenantData?.name || "Unknown",
          };
        })
      );

      setRequests(enrichedRequests);
    } catch (error: any) {
      toast.error("เกิดข้อผิดพลาดในการโหลดข้อมูล: " + error.message);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId: string, withNotes: boolean = false) => {
    if (withNotes) {
      setShowNotesDialog(false);
    }

    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not found");

      const request = requests.find(r => r.request_id === requestId);
      if (!request) throw new Error("Request not found");

      // Update refund request status
      const { error: updateError } = await supabase
        .from("refund_requests")
        .update({
          status: "approved" as any,
          approved_by: user.id,
          processed_at: new Date().toISOString(),
          admin_notes: withNotes ? adminNotes : null,
        })
        .eq("request_id", requestId);

      if (updateError) throw updateError;

      // Update payment status to refunded
      const { error: paymentError } = await supabase
        .from("payments")
        .update({
          status: "refunded" as any,
          provider_ref: request.reason,
        })
        .eq("payment_id", request.payment_id);

      if (paymentError) throw paymentError;

      toast.success("อนุมัติคำขอคืนเงินสำเร็จ");
      setAdminNotes("");
      setSelectedRequest(null);
      loadRequests();
    } catch (error: any) {
      toast.error("เกิดข้อผิดพลาด: " + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (requestId: string, notes: string) => {
    if (!notes.trim()) {
      toast.error("กรุณาระบุเหตุผลในการปฏิเสธ");
      return;
    }

    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not found");

      const { error } = await supabase
        .from("refund_requests")
        .update({
          status: "rejected" as any,
          approved_by: user.id,
          processed_at: new Date().toISOString(),
          admin_notes: notes,
        })
        .eq("request_id", requestId);

      if (error) throw error;

      toast.success("ปฏิเสธคำขอคืนเงินสำเร็จ");
      setAdminNotes("");
      setSelectedRequest(null);
      setShowNotesDialog(false);
      loadRequests();
    } catch (error: any) {
      toast.error("เกิดข้อผิดพลาด: " + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; icon: any; label: string }> = {
      pending: { variant: "secondary", icon: Clock, label: "รอพิจารณา" },
      approved: { variant: "default", icon: CheckCircle, label: "อนุมัติ" },
      rejected: { variant: "destructive", icon: XCircle, label: "ปฏิเสธ" },
    };

    const config = variants[status] || variants.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1 w-fit">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  if (loading) {
    return (
      <AdminLayout>
        <div className="text-center py-8 text-muted-foreground">กำลังโหลด...</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">อนุมัติการคืนเงิน</h1>
          <p className="text-muted-foreground">พิจารณาและอนุมัติคำขอคืนเงินจาก Chapter Admins</p>
        </div>

        {pendingCount > 0 && (
          <Card className="bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800">
            <CardHeader>
              <CardTitle className="text-yellow-800 dark:text-yellow-200">
                มีคำขอคืนเงินรอพิจารณา {pendingCount} รายการ
              </CardTitle>
            </CardHeader>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>รายการคำขอคืนเงิน ({requests.length})</CardTitle>
            <CardDescription>คำขอคืนเงินทั้งหมดในระบบ</CardDescription>
          </CardHeader>
          <CardContent>
            {requests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                ยังไม่มีคำขอคืนเงิน
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>วันที่ขอ</TableHead>
                    <TableHead>Chapter</TableHead>
                    <TableHead>ผู้เยี่ยมชม</TableHead>
                    <TableHead>จำนวนเงิน</TableHead>
                    <TableHead>ผู้ขอคืนเงิน</TableHead>
                    <TableHead>เหตุผล</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead className="text-right">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((request) => (
                    <TableRow key={request.request_id}>
                      <TableCell>
                        {new Date(request.requested_at).toLocaleDateString("th-TH", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell>{request.tenant_name}</TableCell>
                      <TableCell className="font-medium">
                        {request.payment?.participants?.full_name || "-"}
                      </TableCell>
                      <TableCell>
                        {Number(request.payment?.amount || 0).toLocaleString()}{" "}
                        {request.payment?.currency || "THB"}
                      </TableCell>
                      <TableCell className="text-sm">{request.requester_email}</TableCell>
                      <TableCell className="max-w-[200px]">
                        <div className="truncate text-sm">{request.reason}</div>
                        {request.admin_notes && (
                          <div className="text-xs text-muted-foreground mt-1">
                            หมายเหตุ: {request.admin_notes}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(request.status)}</TableCell>
                      <TableCell className="text-right space-x-2">
                        {request.status === "pending" && (
                          <>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => {
                                setSelectedRequest(request);
                                setShowNotesDialog(true);
                              }}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              อนุมัติ
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleApprove(request.request_id)}
                              disabled={processing}
                            >
                              อนุมัติด่วน
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="destructive">
                                  <XCircle className="h-4 w-4 mr-1" />
                                  ปฏิเสธ
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>ปฏิเสธคำขอคืนเงิน</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    กรุณาระบุเหตุผลในการปฏิเสธคำขอคืนเงิน
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <div className="space-y-2">
                                  <Label htmlFor="reject-notes">เหตุผล</Label>
                                  <Textarea
                                    id="reject-notes"
                                    placeholder="ระบุเหตุผล..."
                                    value={adminNotes}
                                    onChange={(e) => setAdminNotes(e.target.value)}
                                    rows={3}
                                  />
                                </div>
                                <AlertDialogFooter>
                                  <AlertDialogCancel onClick={() => setAdminNotes("")}>
                                    ยกเลิก
                                  </AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleReject(request.request_id, adminNotes)}
                                    disabled={processing || !adminNotes.trim()}
                                    className="bg-destructive hover:bg-destructive/90"
                                  >
                                    {processing ? "กำลังดำเนินการ..." : "ปฏิเสธ"}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                        {request.status !== "pending" && (
                          <span className="text-sm text-muted-foreground">
                            {request.processed_at &&
                              new Date(request.processed_at).toLocaleDateString("th-TH")}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Approval with Notes Dialog */}
        <Dialog open={showNotesDialog} onOpenChange={setShowNotesDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>อนุมัติคำขอคืนเงิน</DialogTitle>
              <DialogDescription>
                เพิ่มหมายเหตุสำหรับการอนุมัติ (ถ้ามี)
              </DialogDescription>
            </DialogHeader>
            {selectedRequest && (
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span className="font-medium">ผู้เยี่ยมชม:</span>
                    <span>{selectedRequest.payment?.participants?.full_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">จำนวนเงิน:</span>
                    <span>
                      {Number(selectedRequest.payment?.amount || 0).toLocaleString()}{" "}
                      {selectedRequest.payment?.currency}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">เหตุผล:</span>
                    <p className="text-sm mt-1">{selectedRequest.reason}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-notes">หมายเหตุจากแอดมิน (ถ้ามี)</Label>
                  <Textarea
                    id="admin-notes"
                    placeholder="เพิ่มหมายเหตุ..."
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowNotesDialog(false);
                  setAdminNotes("");
                }}
              >
                ยกเลิก
              </Button>
              <Button
                onClick={() => selectedRequest && handleApprove(selectedRequest.request_id, true)}
                disabled={processing}
              >
                {processing ? "กำลังอนุมัติ..." : "อนุมัติ"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
