import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AdminLayout from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, RefreshCw, FileText, CheckCircle, XCircle, AlertCircle, Edit } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface Payment {
  payment_id: string;
  amount: number;
  method: string;
  status: string;
  paid_at: string | null;
  created_at: string;
  currency: string;
  slip_url: string | null;
  meeting_id: string | null;
  provider_ref: string | null;
  notes?: string | null;
}

interface Participant {
  participant_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  status: string;
}

export default function PaymentHistory() {
  const { participantId } = useParams<{ participantId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [refundReason, setRefundReason] = useState("");
  const [processingRefund, setProcessingRefund] = useState(false);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    loadData();
  }, [participantId]);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userRole } = await supabase
        .from("user_roles")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();

      if (!userRole?.tenant_id) {
        toast.error("ไม่พบข้อมูล tenant");
        return;
      }

      // Load participant data
      const { data: participantData, error: participantError } = await supabase
        .from("participants")
        .select("*")
        .eq("participant_id", participantId)
        .eq("tenant_id", userRole.tenant_id)
        .single();

      if (participantError) throw participantError;
      setParticipant(participantData);

      // Load payment history
      const { data: paymentsData, error: paymentsError } = await supabase
        .from("payments")
        .select("*")
        .eq("participant_id", participantId)
        .eq("tenant_id", userRole.tenant_id)
        .order("created_at", { ascending: false });

      if (paymentsError) throw paymentsError;
      setPayments(paymentsData || []);
    } catch (error: any) {
      toast.error("เกิดข้อผิดพลาดในการโหลดข้อมูล");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefund = async (paymentId: string) => {
    if (!refundReason.trim()) {
      toast.error("กรุณาระบุเหตุผลในการคืนเงิน");
      return;
    }

    setProcessingRefund(true);
    try {
      const { error } = await supabase
        .from("payments")
        .update({ 
          status: "refunded" as any,
          provider_ref: refundReason 
        })
        .eq("payment_id", paymentId);

      if (error) throw error;

      toast.success("ดำเนินการคืนเงินสำเร็จ");
      setRefundReason("");
      loadData();
    } catch (error: any) {
      toast.error("เกิดข้อผิดพลาด: " + error.message);
    } finally {
      setProcessingRefund(false);
    }
  };

  const handleSaveNote = async (paymentId: string) => {
    setSavingNote(true);
    try {
      const { error } = await supabase
        .from("payments")
        .update({ notes: noteText })
        .eq("payment_id", paymentId);

      if (error) throw error;

      toast.success("บันทึกหมายเหตุสำเร็จ");
      setEditingNote(null);
      setNoteText("");
      loadData();
    } catch (error: any) {
      toast.error("เกิดข้อผิดพลาด: " + error.message);
    } finally {
      setSavingNote(false);
    }
  };

  const startEditingNote = (paymentId: string, currentNote: string | null | undefined) => {
    setEditingNote(paymentId);
    setNoteText(currentNote || "");
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; icon: any; label: string }> = {
      paid: { variant: "default", icon: CheckCircle, label: "ชำระแล้ว" },
      pending: { variant: "secondary", icon: AlertCircle, label: "รอชำระ" },
      failed: { variant: "destructive", icon: XCircle, label: "ล้มเหลว" },
      refunded: { variant: "outline", icon: RefreshCw, label: "คืนเงินแล้ว" },
      waived: { variant: "secondary", icon: CheckCircle, label: "ยกเว้น" },
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

  const getMethodLabel = (method: string) => {
    const methods: Record<string, string> = {
      bank_transfer: "โอนเงิน",
      cash: "เงินสด",
      promptpay: "พร้อมเพย์",
      credit_card: "บัตรเครดิต",
    };
    return methods[method] || method;
  };

  const getTotalPaid = () => {
    return payments
      .filter(p => p.status === "paid")
      .reduce((sum, p) => sum + Number(p.amount), 0);
  };

  const getTotalRefunded = () => {
    return payments
      .filter(p => p.status === "refunded")
      .reduce((sum, p) => sum + Number(p.amount), 0);
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="text-center py-8 text-muted-foreground">กำลังโหลด...</div>
      </AdminLayout>
    );
  }

  if (!participant) {
    return (
      <AdminLayout>
        <div className="text-center py-8 text-muted-foreground">ไม่พบข้อมูลผู้เยี่ยมชม</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/visitors")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">ประวัติการชำระเงิน</h1>
            <p className="text-muted-foreground">{participant.full_name}</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">ข้อมูลติดต่อ</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {participant.email && <div>อีเมล: {participant.email}</div>}
              {participant.phone && <div>โทร: {participant.phone}</div>}
              {participant.company && <div>บริษัท: {participant.company}</div>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">ยอดชำระแล้ว</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {getTotalPaid().toLocaleString()} ฿
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">ยอดคืนเงิน</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {getTotalRefunded().toLocaleString()} ฿
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payment History Table */}
        <Card>
          <CardHeader>
            <CardTitle>ประวัติการทำรายการ</CardTitle>
            <CardDescription>รายการชำระเงินทั้งหมด ({payments.length})</CardDescription>
          </CardHeader>
          <CardContent>
            {payments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                ยังไม่มีประวัติการชำระเงิน
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>วันที่</TableHead>
                    <TableHead>จำนวนเงิน</TableHead>
                    <TableHead>วิธีชำระ</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead>วันที่ชำระ</TableHead>
                    <TableHead>หมายเหตุแอดมิน</TableHead>
                    <TableHead>หมายเหตุลูกค้า</TableHead>
                    <TableHead className="text-right">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.payment_id}>
                      <TableCell>
                        {new Date(payment.created_at).toLocaleDateString("th-TH", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell className="font-medium">
                        {Number(payment.amount).toLocaleString()} {payment.currency}
                      </TableCell>
                      <TableCell>{getMethodLabel(payment.method)}</TableCell>
                      <TableCell>{getStatusBadge(payment.status)}</TableCell>
                      <TableCell>
                        {payment.paid_at
                          ? new Date(payment.paid_at).toLocaleDateString("th-TH", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })
                          : "-"}
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 text-sm text-muted-foreground truncate">
                            {payment.notes || "-"}
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => startEditingNote(payment.payment_id, payment.notes)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">
                        {payment.provider_ref || "-"}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        {payment.slip_url && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(payment.slip_url!, "_blank")}
                          >
                            <FileText className="h-4 w-4 mr-1" />
                            ดูสลิป
                          </Button>
                        )}
                        {payment.status === "paid" && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="destructive">
                                <RefreshCw className="h-4 w-4 mr-1" />
                                คืนเงิน
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>ยืนยันการคืนเงิน</AlertDialogTitle>
                                <AlertDialogDescription>
                                  คุณต้องการคืนเงินจำนวน {Number(payment.amount).toLocaleString()}{" "}
                                  {payment.currency} ใช่หรือไม่?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <div className="space-y-2">
                                <label className="text-sm font-medium">
                                  เหตุผลในการคืนเงิน <span className="text-destructive">*</span>
                                </label>
                                <Textarea
                                  placeholder="ระบุเหตุผล..."
                                  value={refundReason}
                                  onChange={(e) => setRefundReason(e.target.value)}
                                  rows={3}
                                />
                              </div>
                              <AlertDialogFooter>
                                <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleRefund(payment.payment_id)}
                                  disabled={processingRefund || !refundReason.trim()}
                                  className="bg-destructive hover:bg-destructive/90"
                                >
                                  {processingRefund ? "กำลังดำเนินการ..." : "คืนเงิน"}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Edit Note Dialog */}
        <Dialog open={editingNote !== null} onOpenChange={(open) => !open && setEditingNote(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>แก้ไขหมายเหตุ</DialogTitle>
              <DialogDescription>
                เพิ่มหรือแก้ไขหมายเหตุสำหรับรายการชำระเงินนี้
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="note">หมายเหตุ</Label>
                <Textarea
                  id="note"
                  placeholder="ระบุหมายเหตุ..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingNote(null)}>
                ยกเลิก
              </Button>
              <Button 
                onClick={() => editingNote && handleSaveNote(editingNote)} 
                disabled={savingNote}
              >
                {savingNote ? "กำลังบันทึก..." : "บันทึก"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
