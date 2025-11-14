import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AdminLayout from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, RefreshCw, FileText, CheckCircle, XCircle, AlertCircle, Edit, Clock, Plus, Trash2, Upload } from "lucide-react";
import SelectTenantPrompt from "@/components/SelectTenantPrompt";
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
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTenantContext } from "@/contexts/TenantContext";

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
  const { effectiveTenantId, isSuperAdmin } = useTenantContext();
  const [loading, setLoading] = useState(true);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [refundReason, setRefundReason] = useState("");
  const [processingRefund, setProcessingRefund] = useState(false);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [refundRequests, setRefundRequests] = useState<any[]>([]);
  
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newAmount, setNewAmount] = useState("");
  const [newMethod, setNewMethod] = useState("bank_transfer");
  const [newPaidAt, setNewPaidAt] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newSlipFile, setNewSlipFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  useEffect(() => {
    if (!effectiveTenantId) {
      setLoading(false);
      return;
    }
    if (participantId) {
      loadData();
    }
  }, [participantId, effectiveTenantId]);

  const loadData = async () => {
    if (!effectiveTenantId) {
      setLoading(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      setCurrentUserRole(userRole?.role || null);

      // Load participant data
      const { data: participantData, error: participantError } = await supabase
        .from("participants")
        .select("*")
        .eq("participant_id", participantId)
        .eq("tenant_id", effectiveTenantId)
        .single();

      if (participantError) throw participantError;
      setParticipant(participantData);

      // Load payment history
      const { data: paymentsData, error: paymentsError } = await supabase
        .from("payments")
        .select("*")
        .eq("participant_id", participantId)
        .eq("tenant_id", effectiveTenantId)
        .order("created_at", { ascending: false });

      if (paymentsError) throw paymentsError;
      setPayments(paymentsData || []);

      // Load refund requests for this participant
      const { data: refundData, error: refundError } = await supabase
        .from("refund_requests")
        .select("*")
        .in("payment_id", paymentsData?.map(p => p.payment_id) || [])
        .order("created_at", { ascending: false });

      if (refundError) throw refundError;
      setRefundRequests(refundData || []);
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

    if (!effectiveTenantId) {
      toast.error(isSuperAdmin 
        ? "กรุณาเลือก Chapter ที่ต้องการจัดการก่อน" 
        : "ไม่พบข้อมูล Tenant"
      );
      return;
    }

    setProcessingRefund(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not found");

      // Create refund request for approval
      const { error } = await supabase
        .from("refund_requests")
        .insert({
          payment_id: paymentId,
          requested_by: user.id,
          reason: refundReason,
          tenant_id: effectiveTenantId,
          status: "pending" as any,
        });

      if (error) throw error;

      toast.success("ส่งคำขอคืนเงินเรียบร้อย รอการอนุมัติจาก Super Admin");
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
        .update({ notes: noteText } as any)
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

  const getRefundRequestStatus = (paymentId: string) => {
    return refundRequests.find(r => r.payment_id === paymentId);
  };

  const getStatusBadge = (status: string, paymentId: string) => {
    const refundRequest = getRefundRequestStatus(paymentId);
    
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
      <div className="space-y-1">
        <Badge variant={config.variant} className="flex items-center gap-1 w-fit">
          <Icon className="h-3 w-3" />
          {config.label}
        </Badge>
        {refundRequest && refundRequest.status === 'pending' && (
          <Badge variant="secondary" className="flex items-center gap-1 w-fit">
            <Clock className="h-3 w-3" />
            รอการอนุมัติคืนเงิน
          </Badge>
        )}
      </div>
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

  const handleCreatePayment = async () => {
    if (!newAmount || !newMethod || !newPaidAt) {
      toast.error("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }

    if (!effectiveTenantId) {
      toast.error(isSuperAdmin 
        ? "กรุณาเลือก Chapter ที่ต้องการจัดการก่อน" 
        : "ไม่พบข้อมูล Tenant"
      );
      return;
    }

    const amount = parseFloat(newAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("กรุณาระบุจำนวนเงินที่ถูกต้อง");
      return;
    }

    setCreating(true);
    try {
      let slipUrl = null;

      // Upload slip if provided
      if (newSlipFile) {
        const fileExt = newSlipFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${effectiveTenantId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('payment-slips')
          .upload(filePath, newSlipFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('payment-slips')
          .getPublicUrl(filePath);

        slipUrl = publicUrl;
      }

      // Insert payment record
      const { error: insertError } = await supabase
        .from("payments")
        .insert({
          participant_id: participantId,
          tenant_id: effectiveTenantId,
          amount,
          method: newMethod as any,
          status: "paid" as any,
          paid_at: new Date(newPaidAt).toISOString(),
          currency: "THB",
          notes: newNotes || null,
          slip_url: slipUrl,
        });

      if (insertError) throw insertError;

      toast.success("เพิ่มรายการชำระเงินสำเร็จ");
      setShowCreateDialog(false);
      setNewAmount("");
      setNewMethod("bank_transfer");
      setNewPaidAt("");
      setNewNotes("");
      setNewSlipFile(null);
      loadData();
    } catch (error: any) {
      toast.error("เกิดข้อผิดพลาด: " + error.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    // Check if there's a pending refund request
    const refundRequest = refundRequests.find(r => r.payment_id === paymentId && r.status === 'pending');
    if (refundRequest) {
      toast.error("ไม่สามารถลบรายการที่มีคำขอคืนเงินรออนุมัติ");
      return;
    }

    try {
      const { error } = await supabase
        .from("payments")
        .delete()
        .eq("payment_id", paymentId);

      if (error) throw error;

      toast.success("ลบรายการชำระเงินสำเร็จ");
      loadData();
    } catch (error: any) {
      toast.error("เกิดข้อผิดพลาด: " + error.message);
    }
  };

  if (!effectiveTenantId && isSuperAdmin) {
    return (
      <AdminLayout>
        <SelectTenantPrompt />
      </AdminLayout>
    );
  }

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
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>ประวัติการทำรายการ</CardTitle>
                <CardDescription>รายการชำระเงินทั้งหมด ({payments.length})</CardDescription>
              </div>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                เพิ่มการชำระเงิน
              </Button>
            </div>
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
                      <TableCell>{getStatusBadge(payment.status, payment.payment_id)}</TableCell>
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
                        {payment.status === "paid" && !getRefundRequestStatus(payment.payment_id) && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="destructive">
                                <RefreshCw className="h-4 w-4 mr-1" />
                                ขอคืนเงิน
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>ส่งคำขอคืนเงิน</AlertDialogTitle>
                                <AlertDialogDescription>
                                  ส่งคำขอคืนเงินจำนวน {Number(payment.amount).toLocaleString()}{" "}
                                  {payment.currency} ไปยัง Super Admin เพื่อพิจารณาอนุมัติ
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
                                >
                                  {processingRefund ? "กำลังส่งคำขอ..." : "ส่งคำขอคืนเงิน"}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                        {currentUserRole === "super_admin" && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="outline">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>ยืนยันการลบรายการชำระเงิน</AlertDialogTitle>
                                <AlertDialogDescription>
                                  คุณต้องการลบรายการชำระเงินจำนวน {Number(payment.amount).toLocaleString()} {payment.currency} ใช่หรือไม่?
                                  การดำเนินการนี้ไม่สามารถย้อนกลับได้
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeletePayment(payment.payment_id)}
                                  className="bg-destructive hover:bg-destructive/90"
                                >
                                  ลบรายการ
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

        {/* Create Payment Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>เพิ่มการชำระเงิน</DialogTitle>
              <DialogDescription>
                บันทึกรายการชำระเงินแบบ Manual
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="amount">จำนวนเงิน (บาท) <span className="text-destructive">*</span></Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  placeholder="650.00"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="method">วิธีชำระ <span className="text-destructive">*</span></Label>
                <Select value={newMethod} onValueChange={setNewMethod}>
                  <SelectTrigger id="method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank_transfer">โอนเงิน</SelectItem>
                    <SelectItem value="promptpay">พร้อมเพย์</SelectItem>
                    <SelectItem value="cash">เงินสด</SelectItem>
                    <SelectItem value="credit_card">บัตรเครดิต</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="paid_at">วันที่ชำระ <span className="text-destructive">*</span></Label>
                <Input
                  id="paid_at"
                  type="datetime-local"
                  value={newPaidAt}
                  onChange={(e) => setNewPaidAt(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">หมายเหตุ</Label>
                <Textarea
                  id="notes"
                  placeholder="ระบุรายละเอียดเพิ่มเติม..."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slip">อัพโหลดสลิป (ถ้ามี)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="slip"
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setNewSlipFile(e.target.files?.[0] || null)}
                    className="cursor-pointer"
                  />
                  {newSlipFile && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setNewSlipFile(null)}
                    >
                      ✕
                    </Button>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                ยกเลิก
              </Button>
              <Button onClick={handleCreatePayment} disabled={creating}>
                {creating ? "กำลังบันทึก..." : "บันทึก"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
