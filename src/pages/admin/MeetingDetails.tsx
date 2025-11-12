import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AdminLayout from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Calendar, MapPin, Clock, Users, ArrowLeft, DollarSign } from "lucide-react";
import MapDisplay from "@/components/MapDisplay";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useTenantContext } from "@/contexts/TenantContext";

export default function MeetingDetails() {
  const { meetingId } = useParams();
  const navigate = useNavigate();
  const { effectiveTenantId, isSuperAdmin } = useTenantContext();
  const [loading, setLoading] = useState(true);
  const [meeting, setMeeting] = useState<any>(null);
  const [attendees, setAttendees] = useState<any[]>([]);

  useEffect(() => {
    if (effectiveTenantId && meetingId) {
      loadMeetingDetails();
    }
  }, [meetingId, effectiveTenantId]);

  const loadMeetingDetails = async () => {
    if (!effectiveTenantId) {
      setLoading(false);
      return;
    }

    try {
      // Load meeting details
      const { data: meetingData, error: meetingError } = await supabase
        .from("meetings")
        .select("*")
        .eq("meeting_id", meetingId)
        .eq("tenant_id", effectiveTenantId)
        .single();

      if (meetingError) throw meetingError;
      
      // Security check: if no meeting found or tenant_id doesn't match
      if (!meetingData || meetingData.tenant_id !== effectiveTenantId) {
        setMeeting(null);
        setLoading(false);
        return;
      }
      
      setMeeting(meetingData);

      // Load attendees (checked-in participants)
      const { data: checkinsData, error: checkinsError } = await supabase
        .from("checkins")
        .select(`
          checkin_id,
          checkin_time,
          source,
          participants:participant_id (
            participant_id,
            full_name,
            company,
            status,
            email
          )
        `)
        .eq("meeting_id", meetingId)
        .eq("tenant_id", effectiveTenantId)
        .order("checkin_time", { ascending: false });

      if (checkinsError) throw checkinsError;
      setAttendees(checkinsData || []);
    } catch (error: any) {
      toast.error("เกิดข้อผิดพลาดในการโหลดข้อมูล");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getRecurrenceText = (pattern: string) => {
    const patterns: Record<string, string> = {
      none: "ไม่ซ้ำ",
      daily: "ทุกวัน",
      weekly: "ทุกสัปดาห์",
      monthly: "ทุกเดือน",
      yearly: "ทุกปี",
      weekdays: "ทุกวันจันทร์-ศุกร์",
      custom: "กำหนดเอง",
    };
    return patterns[pattern] || pattern;
  };

  const getInitials = (name: string) => {
    if (!name) return "?";
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
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
          <div>
            <Button variant="ghost" onClick={() => navigate("/admin/meetings")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              กลับ
            </Button>
          </div>
          <div>
            <h1 className="text-3xl font-bold">รายละเอียดการประชุม</h1>
          </div>
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

  if (!meeting) {
    return (
      <AdminLayout>
        <div className="text-center py-8 text-muted-foreground">ไม่พบข้อมูลการประชุม</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <Button variant="ghost" onClick={() => navigate("/admin/meetings")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            กลับ
          </Button>
        </div>

        <div>
          <h1 className="text-3xl font-bold">รายละเอียดการประชุม</h1>
          <p className="text-muted-foreground">
            {new Date(meeting.meeting_date).toLocaleDateString("th-TH", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Meeting Info Card */}
          <Card>
            <CardHeader>
              <CardTitle>ข้อมูลการประชุม</CardTitle>
              <CardDescription>รายละเอียดและการตั้งค่า</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">วันที่</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(meeting.meeting_date).toLocaleDateString("th-TH", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
              </div>

              {meeting.meeting_time && (
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">เวลา</p>
                    <p className="text-sm text-muted-foreground">{meeting.meeting_time}</p>
                  </div>
                </div>
              )}

              {meeting.theme && (
                <div className="flex items-start gap-3">
                  <div className="h-5 w-5 text-muted-foreground mt-0.5">📋</div>
                  <div>
                    <p className="font-medium">หัวข้อ</p>
                    <p className="text-sm text-muted-foreground">{meeting.theme}</p>
                  </div>
                </div>
              )}

              {meeting.venue && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">สถานที่</p>
                    <p className="text-sm text-muted-foreground">{meeting.venue}</p>
                    {meeting.location_details && (
                      <p className="text-sm text-muted-foreground mt-1">{meeting.location_details}</p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <DollarSign className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">ค่าเข้าร่วมสำหรับผู้เยี่ยมชม</p>
                  <p className="text-sm text-muted-foreground">฿{meeting.visitor_fee}</p>
                </div>
              </div>

              {meeting.recurrence_pattern && meeting.recurrence_pattern !== "none" && (
                <div className="flex items-start gap-3">
                  <div className="h-5 w-5 text-muted-foreground mt-0.5">🔁</div>
                  <div>
                    <p className="font-medium">การทำซ้ำ</p>
                    <p className="text-sm text-muted-foreground">
                      {getRecurrenceText(meeting.recurrence_pattern)}
                      {meeting.recurrence_end_date && (
                        <> ถึง {new Date(meeting.recurrence_end_date).toLocaleDateString("th-TH")}</>
                      )}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stats Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                ผู้เข้าร่วม
              </CardTitle>
              <CardDescription>รายชื่อผู้ที่เช็คอินแล้ว</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold mb-4">{attendees.length} คน</div>
              <div className="text-sm text-muted-foreground">
                เช็คอินแล้วทั้งหมด {attendees.length} คน
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Map Card */}
        {meeting.location_lat && meeting.location_lng && (
          <Card>
            <CardHeader>
              <CardTitle>แผนที่</CardTitle>
              <CardDescription>ตำแหน่งสถานที่จัดการประชุม</CardDescription>
            </CardHeader>
            <CardContent>
              <MapDisplay
                lat={parseFloat(meeting.location_lat)}
                lng={parseFloat(meeting.location_lng)}
                venue={meeting.venue}
                locationDetails={meeting.location_details}
              />
            </CardContent>
          </Card>
        )}

        {/* Attendees List */}
        <Card>
          <CardHeader>
            <CardTitle>รายชื่อผู้เข้าร่วม ({attendees.length})</CardTitle>
            <CardDescription>รายชื่อผู้ที่ลงทะเบียนเข้าร่วมการประชุมแล้ว</CardDescription>
          </CardHeader>
          <CardContent>
            {attendees.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">ยังไม่มีผู้เข้าร่วม</div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {attendees.map((checkin) => (
                  <div
                    key={checkin.checkin_id}
                    className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent transition-colors"
                  >
                    <Avatar>
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {getInitials(checkin.participants?.full_name || "")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{checkin.participants?.full_name || "ไม่ระบุชื่อ"}</p>
                      {checkin.participants?.company && (
                        <p className="text-sm text-muted-foreground truncate">{checkin.participants.company}</p>
                      )}
                      {checkin.participants?.status && (
                        <Badge variant="secondary" className="mt-1 text-xs">
                          {checkin.participants.status}
                        </Badge>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        เช็คอิน: {new Date(checkin.checkin_time).toLocaleTimeString("th-TH", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}