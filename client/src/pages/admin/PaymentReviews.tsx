import { useEffect, useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCw, CheckCircle, XCircle, AlertCircle, Search, Image as ImageIcon } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  notes?: string | null;
  participants: {
    participant_id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    company: string | null;
    status: string;
  };
}

export default function PaymentReviews() {
  const { effectiveTenantId, isSuperAdmin } = useTenantContext();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [filteredPayments, setFilteredPayments] = useState<Payment[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (effectiveTenantId) {
      loadPaymentSlips();
    }
  }, [effectiveTenantId]);

  useEffect(() => {
    filterPayments();
  }, [payments, searchQuery, statusFilter]);

  const loadPaymentSlips = async () => {
    if (!effectiveTenantId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("payments")
        .select(`
          *,
          participants:participant_id (
            participant_id,
            full_name,
            email,
            phone,
            company,
            status
          )
        `)
        .eq("tenant_id", effectiveTenantId)
        .not("slip_url", "is", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPayments(data || []);
    } catch (error: any) {
      toast.error("เกิดข้อผิดพลาดในการโหลดข้อมูล");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const filterPayments = () => {
    let filtered = payments;

    // Filter by status
    if (statusFilter !== "all") {
      filtered = filtered.filter(p => p.status === statusFilter);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.participants.full_name.toLowerCase().includes(query) ||
        p.participants.email?.toLowerCase().includes(query) ||
        p.participants.phone?.toLowerCase().includes(query)
      );
    }

    setFilteredPayments(filtered);
  };

  const handleApprove = async () => {
    if (!selectedPayment) return;

    setProcessing(true);
    try {
      // Update payment status to "paid"
      const { error: paymentError } = await supabase
        .from("payments")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
          notes: approvalNotes || null,
        })
        .eq("payment_id", selectedPayment.payment_id);

      if (paymentError) throw paymentError;

      // Participant status is no longer updated here (payment status tracked in payments table only)

      toast.success("อนุมัติการชำระเงินสำเร็จ");
      setShowApproveDialog(false);
      setApprovalNotes("");
      setSelectedPayment(null);
      loadPaymentSlips();
    } catch (error: any) {
      toast.error("เกิดข้อผิดพลาด: " + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedPayment || !rejectionReason.trim()) {
      toast.error("กรุณาระบุเหตุผลในการปฏิเสธ");
      return;
    }

    setProcessing(true);
    try {
      // Update payment status to "failed"
      const { error } = await supabase
        .from("payments")
        .update({
          status: "failed",
          notes: `ปฏิเสธ: ${rejectionReason}`,
        })
        .eq("payment_id", selectedPayment.payment_id);

      if (error) throw error;

      toast.info("ปฏิเสธการชำระเงิน - ผู้เยี่ยมชมสามารถอัปโหลดสลิปใหม่ได้");
      setShowRejectDialog(false);
      setRejectionReason("");
      setSelectedPayment(null);
      loadPaymentSlips();
    } catch (error: any) {
      toast.error("เกิดข้อผิดพลาด: " + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; icon: any; label: string; color: string }> = {
      paid: { variant: "default", icon: CheckCircle, label: "อนุมัติแล้ว", color: "text-green-600" },
      pending: { variant: "secondary", icon: AlertCircle, label: "รอตรวจสอบ", color: "text-yellow-600" },
      failed: { variant: "destructive", icon: XCircle, label: "ปฏิเสธ", color: "text-red-600" },
      waived: { variant: "outline", icon: CheckCircle, label: "ยกเว้น", color: "text-gray-600" },
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

  const getStats = () => {
    const pending = payments.filter(p => p.status === "pending").length;
    const approvedToday = payments.filter(p => 
      p.status === "paid" && 
      p.paid_at && 
      new Date(p.paid_at).toDateString() === new Date().toDateString()
    ).length;
    const totalToday = payments
      .filter(p => p.status === "paid" && p.paid_at && new Date(p.paid_at).toDateString() === new Date().toDateString())
      .reduce((sum, p) => sum + Number(p.amount), 0);

    return { pending, approvedToday, totalToday };
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="text-center py-8 text-muted-foreground">กำลังโหลด...</div>
      </AdminLayout>
    );
  }

  if (!effectiveTenantId && isSuperAdmin) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <h1 className="text-3xl font-bold">ตรวจสอบการชำระเงิน</h1>
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">
                กรุณาเลือก Chapter ที่ต้องการจัดการ
              </p>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    );
  }

  const stats = getStats();

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">ตรวจสอบการชำระเงิน</h1>
            <p className="text-muted-foreground">ตรวจสอบและอนุมัติสลิปการโอนเงินจากผู้เยี่ยมชม</p>
          </div>
          <Button variant="outline" size="icon" onClick={loadPaymentSlips}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">รอตรวจสอบ</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-600">
                {stats.pending} <span className="text-base font-normal text-muted-foreground">รายการ</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">อนุมัติวันนี้</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {stats.approvedToday} <span className="text-base font-normal text-muted-foreground">รายการ</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">ยอดรวมวันนี้</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">
                {stats.totalToday.toLocaleString()} <span className="text-base font-normal text-muted-foreground">฿</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search Bar */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="ค้นหาด้วยชื่อ, อีเมล, หรือเบอร์โทร..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList>
            <TabsTrigger value="pending">รอตรวจสอบ ({payments.filter(p => p.status === "pending").length})</TabsTrigger>
            <TabsTrigger value="paid">อนุมัติแล้ว ({payments.filter(p => p.status === "paid").length})</TabsTrigger>
            <TabsTrigger value="failed">ปฏิเสธ ({payments.filter(p => p.status === "failed").length})</TabsTrigger>
            <TabsTrigger value="all">ทั้งหมด ({payments.length})</TabsTrigger>
          </TabsList>

          <TabsContent value={statusFilter} className="mt-6">
            {filteredPayments.length === 0 ? (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center text-muted-foreground">
                    {statusFilter === "pending" ? "ไม่มีรายการรอตรวจสอบ" : "ไม่พบรายการที่ค้นหา"}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredPayments.map((payment) => (
                  <Card key={payment.payment_id} className="overflow-hidden hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
                      {/* Slip Image Preview */}
                      {payment.slip_url && (
                        <div 
                          className="relative -mx-6 -mt-6 mb-4 cursor-pointer group"
                          onClick={() => {
                            setSelectedPayment(payment);
                            setShowImageDialog(true);
                          }}
                        >
                          <img
                            src={payment.slip_url}
                            alt="Payment Slip"
                            className="w-full h-48 object-cover"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                            <ImageIcon className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>
                      )}
                      
                      <div className="space-y-2">
                        <CardTitle className="text-lg">{payment.participants.full_name}</CardTitle>
                        <CardDescription className="space-y-1">
                          {payment.participants.email && <div>📧 {payment.participants.email}</div>}
                          {payment.participants.phone && <div>📱 {payment.participants.phone}</div>}
                          {payment.participants.company && <div>🏢 {payment.participants.company}</div>}
                        </CardDescription>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="space-y-4">
                      {/* Payment Info */}
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <div className="text-muted-foreground">จำนวนเงิน</div>
                          <div className="font-semibold text-lg">{payment.amount.toLocaleString()} {payment.currency}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">วันที่</div>
                          <div className="font-medium">
                            {new Date(payment.created_at).toLocaleDateString("th-TH", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <div>
                        {getStatusBadge(payment.status)}
                      </div>

                      {/* Notes */}
                      {payment.notes && (
                        <div className="text-sm p-2 bg-muted rounded">
                          <div className="font-medium mb-1">หมายเหตุ:</div>
                          <div className="text-muted-foreground">{payment.notes}</div>
                        </div>
                      )}

                      {/* Action Buttons */}
                      {payment.status === "pending" && (
                        <div className="flex gap-2 pt-2">
                          <Button 
                            size="sm" 
                            className="flex-1"
                            onClick={() => {
                              setSelectedPayment(payment);
                              setShowApproveDialog(true);
                            }}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            อนุมัติ
                          </Button>
                          <Button 
                            size="sm" 
                            variant="destructive" 
                            className="flex-1"
                            onClick={() => {
                              setSelectedPayment(payment);
                              setShowRejectDialog(true);
                            }}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            ปฏิเสธ
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Approve Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>อนุมัติการชำระเงิน</DialogTitle>
            <DialogDescription>
              ยืนยันการอนุมัติสลิปการโอนเงินของ {selectedPayment?.participants.full_name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>จำนวนเงิน</Label>
              <div className="text-2xl font-bold">{selectedPayment?.amount.toLocaleString()} {selectedPayment?.currency}</div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="approval-notes">หมายเหตุ (ถ้ามี)</Label>
              <Textarea
                id="approval-notes"
                placeholder="เพิ่มหมายเหตุเกี่ยวกับการอนุมัติ..."
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveDialog(false)}>
              ยกเลิก
            </Button>
            <Button onClick={handleApprove} disabled={processing}>
              {processing ? "กำลังดำเนินการ..." : "อนุมัติการชำระเงิน"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ปฏิเสธการชำระเงิน</DialogTitle>
            <DialogDescription>
              ระบุเหตุผลในการปฏิเสธสลิปการโอนเงินของ {selectedPayment?.participants.full_name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rejection-reason">เหตุผล <span className="text-destructive">*</span></Label>
              <Textarea
                id="rejection-reason"
                placeholder="เช่น: ไม่สามารถอ่านข้อมูลได้ชัดเจน, จำนวนเงินไม่ตรง, หลักฐานไม่ถูกต้อง..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              ยกเลิก
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleReject} 
              disabled={processing || !rejectionReason.trim()}
            >
              {processing ? "กำลังดำเนินการ..." : "ปฏิเสธการชำระเงิน"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Viewer Dialog */}
      <Dialog open={showImageDialog} onOpenChange={setShowImageDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>สลิปการโอนเงิน - {selectedPayment?.participants.full_name}</DialogTitle>
            <DialogDescription>
              {selectedPayment?.amount.toLocaleString()} {selectedPayment?.currency} • {" "}
              {selectedPayment && new Date(selectedPayment.created_at).toLocaleDateString("th-TH", {
                day: "numeric",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </DialogDescription>
          </DialogHeader>
          
          {selectedPayment?.slip_url && (
            <div className="mt-4">
              <img
                src={selectedPayment.slip_url}
                alt="Payment Slip"
                className="w-full rounded-lg"
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImageDialog(false)}>
              ปิด
            </Button>
            {selectedPayment?.status === "pending" && (
              <>
                <Button 
                  variant="destructive"
                  onClick={() => {
                    setShowImageDialog(false);
                    setShowRejectDialog(true);
                  }}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  ปฏิเสธ
                </Button>
                <Button 
                  onClick={() => {
                    setShowImageDialog(false);
                    setShowApproveDialog(true);
                  }}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  อนุมัติ
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
