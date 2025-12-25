import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Calendar, 
  Users, 
  Search, 
  CheckCircle, 
  Clock,
  Loader2,
  UserCheck,
  DollarSign,
  UserX,
  RefreshCw,
  Filter,
  Building,
  Camera,
  XCircle,
  QrCode,
  Download,
  Undo2,
  RotateCcw,
  Copy,
  ExternalLink,
  UserPlus,
  Phone,
  Mail
} from "lucide-react";
import { useTenantContext } from "@/contexts/TenantContext";
import SelectTenantPrompt from "@/components/SelectTenantPrompt";
import { apiRequest } from "@/lib/queryClient";
import { IDetectedBarcode, Scanner } from "@yudiel/react-qr-scanner";
import QRCode from "react-qr-code";
import { Label } from "@/components/ui/label";

type FilterType = "all" | "members" | "visitors" | "not_checked_in" | "unpaid";

interface Participant {
  participant_id: string;
  full_name_th: string;
  nickname_th?: string;
  status: string;
  phone?: string;
  company?: string;
  photo_url?: string;
  referred_by_name?: string;
}

interface CheckinRecord {
  checkin_id: string;
  participant_id: string;
  checkin_time: string;
  is_late: boolean;
}

interface VisitorFee {
  fee_id: string;
  participant_id: string;
  amount_due: number;
  status: string;
}

interface ParticipantWithStatus extends Participant {
  is_checked_in: boolean;
  is_late: boolean;
  checkin_time?: string;
  fee_status?: string;
  fee_id?: string;
  amount_due?: number;
}

interface SubstituteRequest {
  request_id: string;
  substitute_name: string;
  substitute_phone: string;
  substitute_email?: string;
  status: string;
  created_at: string;
  member: {
    participant_id: string;
    full_name_th: string;
    nickname_th?: string;
    phone?: string;
    photo_url?: string;
  };
}

interface ParticipantSearchResult {
  participant_id: string;
  tenant_id: string;
  full_name_th: string;
  nickname_th?: string;
  status: string;
  phone?: string;
  email?: string;
  company?: string;
  position?: string;
  photo_url?: string;
  already_checked_in?: boolean;
}

export default function MeetingOperations() {
  const { effectiveTenantId, isSuperAdmin } = useTenantContext();
  const [loading, setLoading] = useState(true);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>("");
  const [participants, setParticipants] = useState<ParticipantWithStatus[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  const [activeOperationTab, setActiveOperationTab] = useState<"scanner" | "search" | "walkin">("scanner");
  const [scannerActive, setScannerActive] = useState(false);
  const [validatingQr, setValidatingQr] = useState(false);
  const [scanResult, setScanResult] = useState<{success: boolean; message: string; name?: string} | null>(null);
  
  const [manualSearchQuery, setManualSearchQuery] = useState("");
  const [manualSearchResults, setManualSearchResults] = useState<ParticipantSearchResult[]>([]);
  const [manualSearchLoading, setManualSearchLoading] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);

  const [pendingSubstitutes, setPendingSubstitutes] = useState<SubstituteRequest[]>([]);
  const [confirmingSubId, setConfirmingSubId] = useState<string | null>(null);

  const [walkinName, setWalkinName] = useState("");
  const [walkinPhone, setWalkinPhone] = useState("");
  const [walkinEmail, setWalkinEmail] = useState("");
  const [walkinMemberId, setWalkinMemberId] = useState("");
  const [walkinMemberSearch, setWalkinMemberSearch] = useState("");
  const [walkinMemberResults, setWalkinMemberResults] = useState<{participant_id: string; full_name_th: string; nickname_th?: string; phone?: string; status: string}[]>([]);
  const [walkinSearching, setWalkinSearching] = useState(false);
  const [walkinSubmitting, setWalkinSubmitting] = useState(false);

  const qrRef = useRef<HTMLDivElement>(null);
  const selectedMeeting = meetings.find(m => m.meeting_id === selectedMeetingId);

  useEffect(() => {
    if (effectiveTenantId) {
      loadMeetings();
    }
  }, [effectiveTenantId]);

  useEffect(() => {
    if (selectedMeetingId) {
      loadParticipantsWithStatus();
      loadPendingSubstitutes();
    }
  }, [selectedMeetingId]);

  const loadMeetings = async () => {
    if (!effectiveTenantId) {
      setLoading(false);
      return;
    }

    try {
      const today = new Date();
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const thirtyDaysLater = new Date(today);
      thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);

      const { data, error } = await supabase
        .from("meetings")
        .select("*")
        .eq("tenant_id", effectiveTenantId)
        .gte("meeting_date", sevenDaysAgo.toISOString().split("T")[0])
        .lte("meeting_date", thirtyDaysLater.toISOString().split("T")[0])
        .order("meeting_date", { ascending: false });

      if (error) throw error;
      setMeetings(data || []);

      const todayStr = today.toISOString().split("T")[0];
      const todayMeeting = data?.find(m => m.meeting_date === todayStr);
      
      if (todayMeeting) {
        setSelectedMeetingId(todayMeeting.meeting_id);
      } else if (data && data.length > 0) {
        const upcomingMeetings = data
          .filter(m => m.meeting_date >= todayStr)
          .sort((a, b) => a.meeting_date.localeCompare(b.meeting_date));
        
        if (upcomingMeetings.length > 0) {
          setSelectedMeetingId(upcomingMeetings[0].meeting_id);
        } else {
          const pastMeetings = data
            .filter(m => m.meeting_date < todayStr)
            .sort((a, b) => b.meeting_date.localeCompare(a.meeting_date));
          if (pastMeetings.length > 0) {
            setSelectedMeetingId(pastMeetings[0].meeting_id);
          }
        }
      }
    } catch (error: any) {
      toast.error("เกิดข้อผิดพลาดในการโหลดข้อมูล");
    } finally {
      setLoading(false);
    }
  };

  const loadParticipantsWithStatus = async () => {
    if (!selectedMeetingId || !effectiveTenantId) return;

    setRefreshing(true);
    try {
      const { data: registrations, error: regError } = await supabase
        .from("meeting_registrations")
        .select(`
          participant_id,
          participant:participants!inner(
            participant_id,
            full_name_th,
            nickname_th,
            status,
            phone,
            company,
            photo_url
          )
        `)
        .eq("meeting_id", selectedMeetingId);

      if (regError) throw regError;

      const { data: members, error: memberError } = await supabase
        .from("participants")
        .select("participant_id, full_name_th, nickname_th, status, phone, company, photo_url")
        .eq("tenant_id", effectiveTenantId)
        .eq("status", "member");

      if (memberError) throw memberError;

      const { data: checkins, error: checkinError } = await supabase
        .from("checkins")
        .select("checkin_id, participant_id, checkin_time, is_late")
        .eq("meeting_id", selectedMeetingId);

      if (checkinError) throw checkinError;

      const { data: { session } } = await supabase.auth.getSession();
      let visitorFees: VisitorFee[] = [];
      if (session?.access_token) {
        try {
          const feesResponse = await fetch(`/api/payments/visitor-fees/${selectedMeetingId}`, {
            headers: { "Authorization": `Bearer ${session.access_token}` }
          });
          const feesData = await feesResponse.json();
          if (feesData.success) {
            visitorFees = feesData.data || [];
          }
        } catch (e) {
          console.error("Failed to load visitor fees:", e);
        }
      }

      const checkinMap = new Map<string, CheckinRecord>();
      (checkins || []).forEach((c: any) => checkinMap.set(c.participant_id, c));

      const feeMap = new Map<string, VisitorFee>();
      visitorFees.forEach(f => feeMap.set(f.participant_id, f));

      const registeredVisitors = (registrations || [])
        .map((r: any) => r.participant)
        .filter((p: any) => p && (p.status === "visitor" || p.status === "prospect"));

      const allParticipants = [...(members || []), ...registeredVisitors];
      const uniqueParticipants = Array.from(
        new Map(allParticipants.map(p => [p.participant_id, p])).values()
      );

      const participantsWithStatus: ParticipantWithStatus[] = uniqueParticipants.map(p => {
        const checkin = checkinMap.get(p.participant_id);
        const fee = feeMap.get(p.participant_id);
        return {
          ...p,
          is_checked_in: !!checkin,
          is_late: checkin?.is_late || false,
          checkin_time: checkin?.checkin_time,
          fee_status: fee?.status,
          fee_id: fee?.fee_id,
          amount_due: fee?.amount_due
        };
      });

      participantsWithStatus.sort((a, b) => {
        if (a.status === "member" && b.status !== "member") return -1;
        if (a.status !== "member" && b.status === "member") return 1;
        return (a.full_name_th || "").localeCompare(b.full_name_th || "");
      });

      setParticipants(participantsWithStatus);
      setSelectedIds([]);
    } catch (error: any) {
      console.error("Error loading participants:", error);
      toast.error("เกิดข้อผิดพลาดในการโหลดข้อมูล");
    } finally {
      setRefreshing(false);
    }
  };

  const loadPendingSubstitutes = async () => {
    if (!selectedMeetingId) return;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      
      const response = await fetch(`/api/palms/meeting/${selectedMeetingId}/substitute-requests`, {
        headers: { "Authorization": `Bearer ${session.access_token}` }
      });
      
      const data = await response.json();
      if (data.success) {
        setPendingSubstitutes(data.pending || []);
      }
    } catch (error: any) {
      console.error("Error loading substitutes:", error);
    }
  };

  const stats = useMemo(() => {
    const members = participants.filter(p => p.status === "member");
    const visitors = participants.filter(p => p.status === "visitor" || p.status === "prospect");
    const membersCheckedIn = members.filter(p => p.is_checked_in);
    const visitorsCheckedIn = visitors.filter(p => p.is_checked_in);
    const late = participants.filter(p => p.is_late);
    const unpaidVisitors = visitors.filter(p => p.fee_status === "pending");
    const paidVisitors = visitors.filter(p => p.fee_status === "paid");
    const totalFees = visitors.reduce((sum, p) => sum + (p.amount_due || 0), 0);
    const paidFees = paidVisitors.reduce((sum, p) => sum + (p.amount_due || 0), 0);

    return {
      totalMembers: members.length,
      membersCheckedIn: membersCheckedIn.length,
      totalVisitors: visitors.length,
      visitorsCheckedIn: visitorsCheckedIn.length,
      late: late.length,
      unpaidVisitors: unpaidVisitors.length,
      paidVisitors: paidVisitors.length,
      totalFees,
      paidFees,
      outstandingFees: totalFees - paidFees
    };
  }, [participants]);

  const filteredParticipants = useMemo(() => {
    let result = participants;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p => 
        p.full_name_th?.toLowerCase().includes(q) ||
        p.nickname_th?.toLowerCase().includes(q) ||
        p.phone?.includes(q) ||
        p.company?.toLowerCase().includes(q)
      );
    }

    switch (filter) {
      case "members":
        result = result.filter(p => p.status === "member");
        break;
      case "visitors":
        result = result.filter(p => p.status === "visitor" || p.status === "prospect");
        break;
      case "not_checked_in":
        result = result.filter(p => !p.is_checked_in);
        break;
      case "unpaid":
        result = result.filter(p => p.fee_status === "pending");
        break;
    }

    return result;
  }, [participants, searchQuery, filter]);

  const handleCheckin = async (participantId: string, isLate: boolean = false) => {
    if (!selectedMeetingId) return;
    setActionLoading(participantId);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("กรุณาเข้าสู่ระบบใหม่");
        return;
      }

      const response = await fetch("/api/participants/pos-manual-checkin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          meeting_id: selectedMeetingId,
          participant_id: participantId,
          is_late: isLate,
          expected_tenant_id: effectiveTenantId
        })
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success(isLate ? "บันทึกการมาสายสำเร็จ" : "เช็คอินสำเร็จ");
        setParticipants(prev => prev.map(p => 
          p.participant_id === participantId 
            ? { ...p, is_checked_in: true, is_late: isLate, checkin_time: new Date().toISOString() }
            : p
        ));
      } else {
        toast.error(data.error || "เกิดข้อผิดพลาด");
      }
    } catch (error) {
      toast.error("เกิดข้อผิดพลาดในการเช็คอิน");
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkPaid = async (feeId: string, participantId: string) => {
    setActionLoading(participantId);

    try {
      const response = await apiRequest(`/api/payments/visitor-fees/${feeId}/mark-paid`, "PATCH", {});
      if (response.success) {
        toast.success("บันทึกการชำระเงินสำเร็จ");
        setParticipants(prev => prev.map(p => 
          p.participant_id === participantId 
            ? { ...p, fee_status: "paid" }
            : p
        ));
      } else {
        toast.error("เกิดข้อผิดพลาด");
      }
    } catch (error) {
      toast.error("เกิดข้อผิดพลาดในการบันทึก");
    } finally {
      setActionLoading(null);
    }
  };

  const handleUndoCheckin = async (participantId: string) => {
    if (!selectedMeetingId) return;
    setActionLoading(participantId);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("กรุณาเข้าสู่ระบบใหม่");
        return;
      }

      const response = await fetch("/api/participants/undo-checkin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          meeting_id: selectedMeetingId,
          participant_id: participantId,
          expected_tenant_id: effectiveTenantId
        })
      });

      const data = await response.json();
      if (data.success) {
        toast.success("ยกเลิกการเช็คอินสำเร็จ");
        await loadParticipantsWithStatus();
      } else {
        toast.error(data.error || "เกิดข้อผิดพลาด");
      }
    } catch (error) {
      toast.error("เกิดข้อผิดพลาดในการยกเลิกเช็คอิน");
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleLate = async (participantId: string, currentIsLate: boolean) => {
    if (!selectedMeetingId) return;
    setActionLoading(participantId);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("กรุณาเข้าสู่ระบบใหม่");
        return;
      }

      const response = await fetch("/api/participants/update-checkin-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          meeting_id: selectedMeetingId,
          participant_id: participantId,
          expected_tenant_id: effectiveTenantId,
          is_late: !currentIsLate
        })
      });

      const data = await response.json();
      if (data.success) {
        toast.success(data.message);
        await loadParticipantsWithStatus();
      } else {
        toast.error(data.error || "เกิดข้อผิดพลาด");
      }
    } catch (error) {
      toast.error("เกิดข้อผิดพลาดในการอัปเดต");
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnmarkPaid = async (feeId: string, participantId: string) => {
    setActionLoading(participantId);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("กรุณาเข้าสู่ระบบใหม่");
        return;
      }

      const response = await fetch(`/api/payments/visitor-fees/${feeId}/unmark-paid`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          expected_tenant_id: effectiveTenantId
        })
      });
      
      const data = await response.json();
      if (data.success) {
        toast.success("ยกเลิกการจ่ายเงินสำเร็จ");
        await loadParticipantsWithStatus();
      } else {
        toast.error(data.error || "เกิดข้อผิดพลาด");
      }
    } catch (error) {
      toast.error("เกิดข้อผิดพลาดในการยกเลิก");
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkCheckin = async (isLate: boolean = false) => {
    if (selectedIds.length === 0) return;
    
    for (const id of selectedIds) {
      const p = participants.find(p => p.participant_id === id);
      if (p && !p.is_checked_in) {
        await handleCheckin(id, isLate);
      }
    }
    setSelectedIds([]);
  };

  const handleBulkMarkPaid = async () => {
    const unpaidSelected = selectedIds
      .map(id => participants.find(p => p.participant_id === id))
      .filter(p => p && p.fee_id && p.fee_status === "pending");

    if (unpaidSelected.length === 0) return;

    try {
      const feeIds = unpaidSelected.map(p => p!.fee_id!);
      const response = await apiRequest("/api/payments/visitor-fees/bulk-mark-paid", "POST", { fee_ids: feeIds });
      if (response.success) {
        toast.success(`บันทึกการชำระเงิน ${unpaidSelected.length} รายการ`);
        await loadParticipantsWithStatus();
      }
    } catch (error) {
      toast.error("เกิดข้อผิดพลาด");
    }
    setSelectedIds([]);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const selectAllFiltered = () => {
    setSelectedIds(filteredParticipants.map(p => p.participant_id));
  };

  const handleQrScan = async (result: IDetectedBarcode[]) => {
    if (result.length === 0 || validatingQr) return;
    
    const scannedData = result[0].rawValue;
    setValidatingQr(true);
    setScanResult(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("กรุณาเข้าสู่ระบบใหม่");
        setValidatingQr(false);
        return;
      }

      const response = await fetch("/api/pos-checkin", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ 
          token: scannedData,
          meeting_id: selectedMeetingId
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setScanResult({ 
          success: true, 
          message: "เช็คอินสำเร็จ", 
          name: data.participant?.full_name_th 
        });
        toast.success(`เช็คอินสำเร็จ: ${data.participant?.full_name_th || ""}`);
        await loadParticipantsWithStatus();
      } else {
        setScanResult({ 
          success: false, 
          message: data.error || "QR ไม่ถูกต้อง" 
        });
        toast.error(data.error || "QR ไม่ถูกต้อง");
      }
    } catch (error) {
      setScanResult({ success: false, message: "เกิดข้อผิดพลาด" });
      toast.error("เกิดข้อผิดพลาดในการตรวจสอบ QR");
    } finally {
      setValidatingQr(false);
      setTimeout(() => setScanResult(null), 3000);
    }
  };

  const handleManualSearch = async () => {
    if (!manualSearchQuery.trim() || !selectedMeetingId) return;
    
    setManualSearchLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const response = await fetch(`/api/participants/search-for-checkin?q=${encodeURIComponent(manualSearchQuery)}&meeting_id=${selectedMeetingId}`, {
        headers: { "Authorization": `Bearer ${session.access_token}` }
      });
      
      const data = await response.json();
      if (data.success) {
        setManualSearchResults(data.data || []);
      }
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setManualSearchLoading(false);
    }
  };

  const handleManualCheckin = async (participant: ParticipantSearchResult) => {
    if (!selectedMeetingId) return;
    setCheckingIn(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("กรุณาเข้าสู่ระบบใหม่");
        return;
      }

      const response = await fetch("/api/participants/pos-manual-checkin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          meeting_id: selectedMeetingId,
          participant_id: participant.participant_id,
          is_late: false,
          expected_tenant_id: effectiveTenantId
        })
      });

      const data = await response.json();
      if (data.success) {
        toast.success(`เช็คอินสำเร็จ: ${participant.full_name_th}`);
        setManualSearchResults([]);
        setManualSearchQuery("");
        await loadParticipantsWithStatus();
      } else {
        toast.error(data.error || "เกิดข้อผิดพลาด");
      }
    } catch (error) {
      toast.error("เกิดข้อผิดพลาดในการเช็คอิน");
    } finally {
      setCheckingIn(false);
    }
  };

  const handleWalkinMemberSearch = async () => {
    if (!walkinMemberSearch.trim()) return;
    
    setWalkinSearching(true);
    try {
      const { data, error } = await supabase
        .from("participants")
        .select("participant_id, full_name_th, nickname_th, phone, status")
        .eq("tenant_id", effectiveTenantId)
        .eq("status", "member")
        .or(`full_name_th.ilike.%${walkinMemberSearch}%,nickname_th.ilike.%${walkinMemberSearch}%,phone.ilike.%${walkinMemberSearch}%`)
        .limit(10);

      if (error) throw error;
      setWalkinMemberResults(data || []);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setWalkinSearching(false);
    }
  };

  const handleWalkinSubmit = async () => {
    if (!walkinName.trim() || !walkinPhone.trim() || !walkinMemberId) {
      toast.error("กรุณากรอกข้อมูลให้ครบ");
      return;
    }

    setWalkinSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("กรุณาเข้าสู่ระบบใหม่");
        return;
      }

      const response = await fetch("/api/palms/walkin-substitute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          meeting_id: selectedMeetingId,
          member_participant_id: walkinMemberId,
          substitute_name: walkinName,
          substitute_phone: walkinPhone,
          substitute_email: walkinEmail || null
        })
      });

      const data = await response.json();
      if (data.success) {
        toast.success("บันทึกตัวแทนเรียบร้อย");
        setWalkinName("");
        setWalkinPhone("");
        setWalkinEmail("");
        setWalkinMemberId("");
        setWalkinMemberSearch("");
        setWalkinMemberResults([]);
        await loadParticipantsWithStatus();
      } else {
        toast.error(data.error || "เกิดข้อผิดพลาด");
      }
    } catch (error) {
      toast.error("เกิดข้อผิดพลาด");
    } finally {
      setWalkinSubmitting(false);
    }
  };

  const handleConfirmSubstitute = async (requestId: string) => {
    setConfirmingSubId(requestId);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("กรุณาเข้าสู่ระบบใหม่");
        return;
      }
      
      const response = await fetch("/api/palms/confirm-substitute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ request_id: requestId })
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success("ยืนยันตัวแทนเรียบร้อย");
        await loadParticipantsWithStatus();
        await loadPendingSubstitutes();
      } else {
        toast.error(data.error || "ไม่สามารถยืนยันตัวแทนได้");
      }
    } catch (error: any) {
      toast.error("เกิดข้อผิดพลาดในการยืนยัน");
    } finally {
      setConfirmingSubId(null);
    }
  };

  const checkinUrl = selectedMeetingId 
    ? `${window.location.origin}/checkin/${selectedMeetingId}`
    : "";

  const downloadQRCode = () => {
    const svg = document.getElementById("meeting-checkin-qr");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL("image/png");

      const downloadLink = document.createElement("a");
      downloadLink.download = `checkin-qr-${selectedMeeting?.meeting_date || "meeting"}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();

      toast.success("ดาวน์โหลด QR Code สำเร็จ");
    };

    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  const copyCheckinLink = () => {
    if (!checkinUrl) return;
    navigator.clipboard.writeText(checkinUrl);
    toast.success("คัดลอกลิงก์สำเร็จ");
  };

  const getInitials = (name: string) => {
    return name?.charAt(0)?.toUpperCase() || "?";
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
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Meeting Operations</h1>
            <p className="text-muted-foreground">จัดการเช็คอิน, ดาวน์โหลด QR และดูสถิติการประชุม</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedMeetingId} onValueChange={setSelectedMeetingId}>
              <SelectTrigger className="w-[280px]" data-testid="select-meeting">
                <SelectValue placeholder="เลือกการประชุม" />
              </SelectTrigger>
              <SelectContent>
                {meetings.length === 0 ? (
                  <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                    ไม่มีข้อมูลการประชุม
                  </div>
                ) : (
                  meetings.map((meeting) => (
                    <SelectItem key={meeting.meeting_id} value={meeting.meeting_id}>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {new Date(meeting.meeting_date).toLocaleDateString("th-TH", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                        {meeting.theme && ` - ${meeting.theme}`}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => loadParticipantsWithStatus()}
              disabled={refreshing}
              data-testid="button-refresh"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {selectedMeetingId && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                      <UserCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">สมาชิก</p>
                      <p className="text-lg font-bold">{stats.membersCheckedIn}/{stats.totalMembers}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                      <Users className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">ผู้เยี่ยมชม</p>
                      <p className="text-lg font-bold">{stats.visitorsCheckedIn}/{stats.totalVisitors}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-amber-100 dark:bg-amber-900 rounded-lg">
                      <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">มาสาย</p>
                      <p className="text-lg font-bold">{stats.late}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-emerald-100 dark:bg-emerald-900 rounded-lg">
                      <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">ค้างจ่าย</p>
                      <p className="text-lg font-bold">{stats.unpaidVisitors}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
                <CardHeader className="pb-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">รายชื่อผู้เข้าร่วม</CardTitle>
                      <span className="text-xs text-muted-foreground">({filteredParticipants.length})</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={selectAllFiltered}
                        disabled={filteredParticipants.length === 0}
                        data-testid="button-select-all"
                      >
                        เลือกทั้งหมด
                      </Button>
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="ค้นหา..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-8 w-[150px]"
                          data-testid="input-roster-search"
                        />
                      </div>
                      <Select value={filter} onValueChange={(v) => setFilter(v as FilterType)}>
                        <SelectTrigger className="w-[130px]" data-testid="select-filter">
                          <Filter className="h-3 w-3 mr-1" />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">ทั้งหมด</SelectItem>
                          <SelectItem value="members">สมาชิก</SelectItem>
                          <SelectItem value="visitors">ผู้เยี่ยมชม</SelectItem>
                          <SelectItem value="not_checked_in">ยังไม่เช็คอิน</SelectItem>
                          <SelectItem value="unpaid">ค้างจ่าย</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {selectedIds.length > 0 && (
                    <div className="flex items-center gap-2 mb-3 p-2 bg-muted rounded-lg flex-wrap">
                      <span className="text-sm">เลือก {selectedIds.length} คน</span>
                      <Button size="sm" variant="outline" onClick={() => handleBulkCheckin(false)} data-testid="button-bulk-checkin">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        เช็คอิน
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleBulkCheckin(true)} data-testid="button-bulk-late">
                        <Clock className="h-3 w-3 mr-1" />
                        มาสาย
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleBulkMarkPaid} data-testid="button-bulk-paid">
                        <DollarSign className="h-3 w-3 mr-1" />
                        จ่ายแล้ว
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])} data-testid="button-clear-selection">
                        ยกเลิก
                      </Button>
                    </div>
                  )}
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-2">
                      {filteredParticipants.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          ไม่พบข้อมูล
                        </div>
                      ) : (
                        filteredParticipants.map((p) => (
                          <div
                            key={p.participant_id}
                            className={`flex items-center gap-2 p-2 border rounded-lg ${p.is_checked_in ? "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800" : ""}`}
                            data-testid={`row-participant-${p.participant_id}`}
                          >
                            <Checkbox
                              checked={selectedIds.includes(p.participant_id)}
                              onCheckedChange={() => toggleSelect(p.participant_id)}
                              data-testid={`checkbox-${p.participant_id}`}
                            />
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={p.photo_url || undefined} />
                              <AvatarFallback>{getInitials(p.full_name_th)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1 flex-wrap">
                                <span className="text-sm font-medium truncate">{p.nickname_th || p.full_name_th}</span>
                                <Badge variant={p.status === "member" ? "default" : "secondary"} className="text-[10px]">
                                  {p.status === "member" ? "สมาชิก" : "ผู้เยี่ยมชม"}
                                </Badge>
                                {p.is_late && <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">สาย</Badge>}
                                {p.fee_status === "paid" && <Badge variant="outline" className="text-[10px] text-green-600 border-green-300">จ่ายแล้ว</Badge>}
                                {p.fee_status === "pending" && <Badge variant="outline" className="text-[10px] text-red-600 border-red-300">ค้างจ่าย</Badge>}
                              </div>
                              {p.company && <p className="text-xs text-muted-foreground truncate">{p.company}</p>}
                            </div>
                            <div className="flex items-center gap-1">
                              {actionLoading === p.participant_id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : p.is_checked_in ? (
                                <>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => handleToggleLate(p.participant_id, p.is_late)}
                                    title={p.is_late ? "ยกเลิกสาย" : "ทำเครื่องหมายสาย"}
                                    data-testid={`button-toggle-late-${p.participant_id}`}
                                  >
                                    <Clock className={`h-4 w-4 ${p.is_late ? "text-amber-500" : ""}`} />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => handleUndoCheckin(p.participant_id)}
                                    title="ยกเลิกเช็คอิน"
                                    data-testid={`button-undo-checkin-${p.participant_id}`}
                                  >
                                    <Undo2 className="h-4 w-4" />
                                  </Button>
                                  {p.fee_id && p.fee_status === "paid" && (
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => handleUnmarkPaid(p.fee_id!, p.participant_id)}
                                      title="ยกเลิกจ่ายเงิน"
                                      data-testid={`button-undo-paid-${p.participant_id}`}
                                    >
                                      <RotateCcw className="h-4 w-4" />
                                    </Button>
                                  )}
                                </>
                              ) : (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() => handleCheckin(p.participant_id, false)}
                                    data-testid={`button-checkin-${p.participant_id}`}
                                  >
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    เช็คอิน
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleCheckin(p.participant_id, true)}
                                    data-testid={`button-late-${p.participant_id}`}
                                  >
                                    <Clock className="h-3 w-3 mr-1" />
                                    สาย
                                  </Button>
                                </>
                              )}
                              {p.fee_id && p.fee_status === "pending" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleMarkPaid(p.fee_id!, p.participant_id)}
                                  data-testid={`button-mark-paid-${p.participant_id}`}
                                >
                                  <DollarSign className="h-3 w-3 mr-1" />
                                  จ่าย
                                </Button>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

            <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">เช็คอิน</CardTitle>
                </CardHeader>
                <CardContent>
                  <Tabs value={activeOperationTab} onValueChange={(v) => setActiveOperationTab(v as any)}>
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="scanner" className="text-xs" data-testid="tab-scanner">
                        <Camera className="h-3 w-3 mr-1" />
                        สแกน
                      </TabsTrigger>
                      <TabsTrigger value="search" className="text-xs" data-testid="tab-search">
                        <Search className="h-3 w-3 mr-1" />
                        ค้นหา
                      </TabsTrigger>
                      <TabsTrigger value="walkin" className="text-xs" data-testid="tab-walkin">
                        <UserPlus className="h-3 w-3 mr-1" />
                        ตัวแทน
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="scanner" className="mt-3">
                      <div className="space-y-3">
                        {!scannerActive ? (
                          <Button 
                            onClick={() => setScannerActive(true)} 
                            className="w-full"
                            data-testid="button-start-scanner"
                          >
                            <Camera className="mr-2 h-4 w-4" />
                            เปิดกล้องสแกน
                          </Button>
                        ) : (
                          <div className="space-y-2">
                            <div className="relative aspect-square max-h-[200px] rounded-lg overflow-hidden border">
                              <Scanner
                                onScan={handleQrScan}
                                onError={(error) => console.error("Scanner error:", error)}
                                constraints={{ facingMode: "environment" }}
                                styles={{ container: { width: "100%", height: "100%" } }}
                              />
                              {validatingQr && (
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                  <Loader2 className="h-8 w-8 animate-spin text-white" />
                                </div>
                              )}
                            </div>
                            <Button 
                              onClick={() => setScannerActive(false)} 
                              variant="outline" 
                              size="sm" 
                              className="w-full"
                              data-testid="button-stop-scanner"
                            >
                              ปิดกล้อง
                            </Button>
                          </div>
                        )}
                        {scanResult && (
                          <div className={`p-3 rounded-lg text-center ${scanResult.success ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"}`}>
                            {scanResult.success ? <CheckCircle className="h-5 w-5 mx-auto mb-1" /> : <XCircle className="h-5 w-5 mx-auto mb-1" />}
                            <p className="text-sm font-medium">{scanResult.message}</p>
                            {scanResult.name && <p className="text-xs">{scanResult.name}</p>}
                          </div>
                        )}
                      </div>
                    </TabsContent>

                    <TabsContent value="search" className="mt-3">
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <Input
                            placeholder="ชื่อ, เบอร์โทร..."
                            value={manualSearchQuery}
                            onChange={(e) => setManualSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleManualSearch()}
                            data-testid="input-manual-search"
                          />
                          <Button onClick={handleManualSearch} disabled={manualSearchLoading} data-testid="button-search">
                            {manualSearchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                          </Button>
                        </div>
                        {manualSearchResults.length > 0 && (
                          <div className="space-y-2 max-h-[200px] overflow-y-auto">
                            {manualSearchResults.map((p) => (
                              <div key={p.participant_id} className="flex items-center justify-between p-2 border rounded-lg">
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-8 w-8">
                                    <AvatarImage src={p.photo_url || undefined} />
                                    <AvatarFallback>{getInitials(p.full_name_th)}</AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <p className="text-sm font-medium">{p.nickname_th || p.full_name_th}</p>
                                    <p className="text-xs text-muted-foreground">{p.company}</p>
                                  </div>
                                </div>
                                {p.already_checked_in ? (
                                  <Badge variant="secondary">เช็คอินแล้ว</Badge>
                                ) : (
                                  <Button 
                                    size="sm" 
                                    onClick={() => handleManualCheckin(p)}
                                    disabled={checkingIn}
                                    data-testid={`button-checkin-${p.participant_id}`}
                                  >
                                    {checkingIn ? <Loader2 className="h-3 w-3 animate-spin" /> : "เช็คอิน"}
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </TabsContent>

                    <TabsContent value="walkin" className="mt-3">
                      <div className="space-y-3">
                        {pendingSubstitutes.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs font-medium text-muted-foreground">รอยืนยัน ({pendingSubstitutes.length})</p>
                            {pendingSubstitutes.map((sub) => (
                              <div key={sub.request_id} className="flex items-center justify-between p-2 border rounded-lg bg-amber-50 dark:bg-amber-950">
                                <div>
                                  <p className="text-sm font-medium">{sub.substitute_name}</p>
                                  <p className="text-xs text-muted-foreground">แทน {sub.member.nickname_th || sub.member.full_name_th}</p>
                                </div>
                                <Button 
                                  size="sm" 
                                  onClick={() => handleConfirmSubstitute(sub.request_id)}
                                  disabled={confirmingSubId === sub.request_id}
                                  data-testid={`button-confirm-sub-${sub.request_id}`}
                                >
                                  {confirmingSubId === sub.request_id ? <Loader2 className="h-3 w-3 animate-spin" /> : "ยืนยัน"}
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="border-t pt-3 space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">เพิ่มตัวแทน Walk-in</p>
                          <div className="flex gap-2">
                            <Input
                              placeholder="ค้นหาสมาชิก..."
                              value={walkinMemberSearch}
                              onChange={(e) => setWalkinMemberSearch(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && handleWalkinMemberSearch()}
                              data-testid="input-walkin-member-search"
                            />
                            <Button size="icon" variant="outline" onClick={handleWalkinMemberSearch} disabled={walkinSearching}>
                              {walkinSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                            </Button>
                          </div>
                          {walkinMemberResults.length > 0 && (
                            <div className="space-y-1 max-h-[100px] overflow-y-auto">
                              {walkinMemberResults.map((m) => (
                                <Button
                                  key={m.participant_id}
                                  variant={walkinMemberId === m.participant_id ? "default" : "outline"}
                                  size="sm"
                                  className="w-full justify-start text-xs"
                                  onClick={() => {
                                    setWalkinMemberId(m.participant_id);
                                    setWalkinMemberSearch(m.nickname_th || m.full_name_th);
                                    setWalkinMemberResults([]);
                                  }}
                                  data-testid={`button-select-member-${m.participant_id}`}
                                >
                                  {m.nickname_th || m.full_name_th}
                                </Button>
                              ))}
                            </div>
                          )}
                          <Input
                            placeholder="ชื่อตัวแทน"
                            value={walkinName}
                            onChange={(e) => setWalkinName(e.target.value)}
                            data-testid="input-walkin-name"
                          />
                          <Input
                            placeholder="เบอร์โทรตัวแทน"
                            value={walkinPhone}
                            onChange={(e) => setWalkinPhone(e.target.value)}
                            data-testid="input-walkin-phone"
                          />
                          <Input
                            placeholder="อีเมล (ไม่บังคับ)"
                            value={walkinEmail}
                            onChange={(e) => setWalkinEmail(e.target.value)}
                            data-testid="input-walkin-email"
                          />
                          <Button 
                            className="w-full" 
                            onClick={handleWalkinSubmit}
                            disabled={walkinSubmitting || !walkinMemberId || !walkinName || !walkinPhone}
                            data-testid="button-submit-walkin"
                          >
                            {walkinSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
                            บันทึกตัวแทน
                          </Button>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>

            <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <QrCode className="h-4 w-4" />
                    QR Code สำหรับปริ้น
                  </CardTitle>
                  <CardDescription className="text-xs">
                    ให้สมาชิกสแกนเพื่อเช็คอิน
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-center p-4 bg-white rounded-lg border" ref={qrRef}>
                    <QRCode
                      id="meeting-checkin-qr"
                      value={checkinUrl}
                      size={180}
                      level="H"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Button onClick={downloadQRCode} size="sm" data-testid="button-download-qr">
                      <Download className="mr-1 h-4 w-4" />
                      ดาวน์โหลด
                    </Button>
                    <Button onClick={copyCheckinLink} variant="outline" size="sm" data-testid="button-copy-link">
                      <Copy className="mr-1 h-4 w-4" />
                      คัดลอก
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => window.open(checkinUrl, "_blank")}
                      data-testid="button-open-checkin"
                    >
                      <ExternalLink className="mr-1 h-4 w-4" />
                      เปิด
                    </Button>
                  </div>
                </CardContent>
              </Card>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
