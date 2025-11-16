import { useEffect, useState } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, MapPin, Clock, ArrowLeft, UserPlus } from "lucide-react";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import VisitorRegistrationDialog from "@/components/dialogs/VisitorRegistrationDialog";

interface ChapterData {
  tenant_id: string;
  name: string;
  subdomain: string;
  logo_url?: string;
  branding_color?: string;
}

interface Meeting {
  meeting_id: string;
  meeting_date: string;
  theme?: string;
  venue?: string;
}

export default function ChapterProfile() {
  const { subdomain } = useParams<{ subdomain: string }>();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [chapter, setChapter] = useState<ChapterData | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [showRegistrationDialog, setShowRegistrationDialog] = useState(false);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | undefined>();

  useEffect(() => {
    loadChapterData();
  }, [subdomain]);

  // Auto-open registration dialog if meeting param exists
  useEffect(() => {
    if (chapter && searchParams.get('meeting')) {
      const meetingId = searchParams.get('meeting');
      if (meetingId) {
        setSelectedMeetingId(meetingId);
        setShowRegistrationDialog(true);
      }
    }
  }, [chapter, searchParams]);

  const loadChapterData = async () => {
    try {
      // Fetch tenant/chapter data
      const { data: tenantData, error: tenantError } = await supabase
        .from("tenants")
        .select("tenant_id, tenant_name, subdomain")
        .eq("subdomain", subdomain)
        .single();

      if (tenantError) throw tenantError;
      if (!tenantData) {
        setLoading(false);
        return;
      }

      // Fetch tenant settings for branding
      const { data: settingsData } = await supabase
        .from("tenant_settings")
        .select("logo_url, branding_color")
        .eq("tenant_id", tenantData.tenant_id)
        .single();

      setChapter({
        tenant_id: tenantData.tenant_id,
        name: tenantData.tenant_name,
        subdomain: tenantData.subdomain,
        logo_url: settingsData?.logo_url || undefined,
        branding_color: settingsData?.branding_color || "#1e40af",
      });

      // Fetch upcoming meetings (next 3 months)
      const today = new Date();
      const threeMonthsLater = new Date();
      threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);

      const { data: meetingsData } = await supabase
        .from("meetings")
        .select("meeting_id, meeting_date, theme, venue")
        .eq("tenant_id", tenantData.tenant_id)
        .gte("meeting_date", today.toISOString().split("T")[0])
        .lte("meeting_date", threeMonthsLater.toISOString().split("T")[0])
        .order("meeting_date", { ascending: true });

      setMeetings(meetingsData || []);
    } catch (error: any) {
      console.error("Error loading chapter data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg text-muted-foreground">กำลังโหลด...</div>
        </div>
      </div>
    );
  }

  if (!chapter) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">ไม่พบ Chapter</h1>
          <p className="text-muted-foreground">Chapter ที่คุณค้นหาไม่มีอยู่ในระบบ</p>
          <Button asChild>
            <Link to="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              กลับหน้าหลัก
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            {chapter.logo_url && (
              <img
                src={chapter.logo_url}
                alt={`${chapter.name} logo`}
                className="w-16 h-16 rounded-lg object-cover border"
              />
            )}
            <div>
              <h1 className="text-3xl font-bold">{chapter.name}</h1>
              <p className="text-muted-foreground">
                BNI Chapter
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Chapter Info Card */}
          <Card className="md:col-span-2 lg:col-span-1">
            <CardHeader>
              <CardTitle>ข้อมูล Chapter</CardTitle>
              <CardDescription>รายละเอียดของ {chapter.name}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                BNI (Business Network International) เป็นองค์กรเครือข่ายธุรกิจที่ใหญ่ที่สุดในโลก
                ที่ช่วยให้ผู้ประกอบการสร้างโอกาสทางธุรกิจผ่านการแนะนำลูกค้า
              </p>
            </CardContent>
          </Card>

          {/* Upcoming Meetings */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>ปฏิทินการประชุม</CardTitle>
              <CardDescription>การประชุมที่กำลังจะมาถึง</CardDescription>
            </CardHeader>
            <CardContent>
              {meetings.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  ยังไม่มีการประชุมที่กำลังจะมาถึง
                </p>
              ) : (
                <div className="space-y-4">
                  {meetings.map((meeting) => (
                    <div
                      key={meeting.meeting_id}
                      className="flex items-start gap-4 p-4 border rounded-lg hover:bg-accent transition-colors"
                    >
                      <div className="flex-shrink-0 w-16 text-center">
                        <div className="text-2xl font-bold" style={{ color: chapter.branding_color }}>
                          {format(new Date(meeting.meeting_date), "dd", { locale: th })}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(meeting.meeting_date), "MMM", { locale: th })}
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">
                            {format(new Date(meeting.meeting_date), "EEEE, dd MMMM yyyy", { locale: th })}
                          </span>
                        </div>
                        {meeting.theme && (
                          <p className="text-sm text-muted-foreground mb-1">
                            หัวข้อ: {meeting.theme}
                          </p>
                        )}
                        {meeting.venue && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            <span>{meeting.venue}</span>
                          </div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedMeetingId(meeting.meeting_id);
                          setShowRegistrationDialog(true);
                        }}
                        style={{ backgroundColor: chapter.branding_color }}
                      >
                        <UserPlus className="h-4 w-4 mr-1" />
                        ลงทะเบียน
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* CTA Section */}
        <Card className="mt-6">
          <CardContent className="py-8 text-center">
            <h2 className="text-2xl font-bold mb-2">สนใจเข้าร่วม {chapter.name}?</h2>
            <p className="text-muted-foreground mb-6">
              ติดต่อสอบถามข้อมูลเพิ่มเติมหรือเข้าร่วมการประชุมในฐานะผู้เยี่ยมชม
            </p>
            <div className="flex gap-4 justify-center">
              <Button 
                size="lg" 
                style={{ backgroundColor: chapter.branding_color }}
                onClick={() => {
                  setSelectedMeetingId(undefined);
                  setShowRegistrationDialog(true);
                }}
              >
                <UserPlus className="mr-2 h-5 w-5" />
                ลงทะเบียนผู้เยี่ยมชม
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Registration Dialog */}
        <VisitorRegistrationDialog
          open={showRegistrationDialog}
          onOpenChange={setShowRegistrationDialog}
          tenantId={chapter.tenant_id}
          meetingId={selectedMeetingId}
        />
      </main>

      {/* Footer */}
      <footer className="border-t mt-12 py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; 2024 {chapter.name}. All rights reserved.</p>
          <p className="mt-1">Powered by BNI Management System</p>
        </div>
      </footer>
    </div>
  );
}
