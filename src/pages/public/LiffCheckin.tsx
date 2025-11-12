import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, AlertCircle, User, Calendar, MapPin } from 'lucide-react';
import { toast } from 'sonner';

// @ts-ignore - LIFF SDK loaded via script tag
declare const liff: any;

interface LiffProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
}

interface Participant {
  participant_id: string;
  full_name: string;
  nickname?: string;
  email?: string;
  phone?: string;
  company?: string;
  status: string;
}

interface Meeting {
  meeting_id: string;
  meeting_date: string;
  meeting_time?: string;
  venue?: string;
  theme?: string;
  location_details?: string;
}

interface CheckInResult {
  ok?: boolean;
  checkin_time?: string;
  status?: string;
  require_payment?: boolean;
  pay_url?: string;
  amount?: number;
  currency?: string;
  error?: string;
  details?: string;
  message?: string;
}

export default function LiffCheckin() {
  const [searchParams] = useSearchParams();
  const tenant = searchParams.get('tenant');
  const pid = searchParams.get('pid');
  const meetingId = searchParams.get('meeting');

  const [liffReady, setLiffReady] = useState(false);
  const [liffError, setLiffError] = useState<string | null>(null);
  const [lineProfile, setLineProfile] = useState<LiffProfile | null>(null);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkInResult, setCheckInResult] = useState<CheckInResult | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize LIFF
  useEffect(() => {
    const initLiff = async () => {
      try {
        if (!tenant) {
          setLiffError('ไม่พบข้อมูล tenant');
          setLoading(false);
          return;
        }

        console.log('Fetching LIFF ID for tenant:', tenant);

        // Fetch liff_id_checkin from resolve-tenant-secrets
        const { data, error } = await supabase.functions.invoke('resolve-tenant-secrets', {
          body: { tenant_slug: tenant }
        });

        if (error) throw error;

        const liffId = data?.liff_id_checkin;

        if (!liffId) {
          setLiffError('ระบบ Check-in ยังไม่ได้ตั้งค่า LIFF ID');
          setLoading(false);
          return;
        }

        console.log('Initializing LIFF with ID:', liffId);

        await liff.init({ liffId });

        if (!liff.isLoggedIn()) {
          console.log('User not logged in, redirecting to LINE login');
          liff.login();
          return;
        }

        const profile = await liff.getProfile();
        console.log('LINE profile obtained:', profile.displayName);
        setLineProfile(profile);
        setLiffReady(true);
        setLoading(false);
      } catch (err) {
        console.error('LIFF initialization error:', err);
        setLiffError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการเชื่อมต่อ LINE');
        setLoading(false);
      }
    };

    // Load LIFF SDK
    if (typeof liff === 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://static.line-scdn.net/liff/edge/2/sdk.js';
      script.async = true;
      script.onload = () => initLiff();
      script.onerror = () => {
        setLiffError('ไม่สามารถโหลด LINE SDK ได้');
        setLoading(false);
      };
      document.body.appendChild(script);
    } else {
      initLiff();
    }
  }, [tenant]);

  // Fetch participant and meeting data
  useEffect(() => {
    if (!liffReady || !pid || !meetingId || !tenant) return;

    const fetchData = async () => {
      try {
        console.log('Fetching participant and meeting data');

        // Fetch participant
        const { data: participantData, error: participantError } = await supabase
          .from('participants')
          .select('*')
          .eq('participant_id', pid)
          .single();

        if (participantError) throw participantError;
        setParticipant(participantData);

        // Fetch meeting
        const { data: meetingData, error: meetingError } = await supabase
          .from('meetings')
          .select('*')
          .eq('meeting_id', meetingId)
          .single();

        if (meetingError) throw meetingError;
        setMeeting(meetingData);

      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('ไม่สามารถโหลดข้อมูลได้');
        setLiffError('ไม่สามารถโหลดข้อมูลได้');
      }
    };

    fetchData();
  }, [liffReady, pid, meetingId, tenant]);

  const handleCheckIn = async () => {
    if (!tenant || !pid || !meetingId || !lineProfile) return;

    setChecking(true);
    try {
      console.log('Attempting check-in');

      const { data, error } = await supabase.functions.invoke('unified-check-in', {
        body: {
          tenant_slug: tenant,
          participant_id: pid,
          meeting_id: meetingId,
          source: 'liff',
          line_user_id: lineProfile.userId
        }
      });

      if (error) throw error;

      const result = data as CheckInResult;

      if (result.require_payment) {
        // Redirect to payment page
        console.log('Payment required, redirecting to:', result.pay_url);
        window.location.href = result.pay_url!;
      } else if (result.ok) {
        setCheckInResult(result);
        toast.success('เช็คอินสำเร็จ!');
      } else if (result.error) {
        toast.error(result.details || result.error);
      }
    } catch (error) {
      console.error('Check-in error:', error);
      toast.error(error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการเช็คอิน');
    } finally {
      setChecking(false);
    }
  };

  const handleClose = () => {
    if (typeof liff !== 'undefined' && liff.isInClient()) {
      liff.closeWindow();
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
      });
    } catch {
      return dateStr;
    }
  };

  const formatTime = (timeStr?: string) => {
    if (!timeStr) return '';
    try {
      const [hours, minutes] = timeStr.split(':');
      return `${hours}:${minutes} น.`;
    } catch {
      return timeStr;
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-muted-foreground">กำลังเชื่อมต่อ LINE...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (liffError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center space-x-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <CardTitle>เกิดข้อผิดพลาด</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertDescription>{liffError}</AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (checkInResult?.ok) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex flex-col items-center space-y-4">
              <div className="rounded-full bg-green-100 p-4">
                <CheckCircle2 className="h-12 w-12 text-green-600" />
              </div>
              <CardTitle className="text-2xl text-center">เช็คอินสำเร็จ!</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {checkInResult.message && (
              <Alert>
                <AlertDescription>{checkInResult.message}</AlertDescription>
              </Alert>
            )}
            
            <div className="text-center text-muted-foreground">
              <p>เวลาเช็คอิน</p>
              <p className="text-lg font-semibold text-foreground">
                {checkInResult.checkin_time
                  ? new Date(checkInResult.checkin_time).toLocaleTimeString('th-TH')
                  : 'เพิ่งเช็คอิน'}
              </p>
            </div>

            {meeting && (
              <div className="space-y-2 pt-4 border-t">
                <div className="flex items-start space-x-2">
                  <Calendar className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">การประชุม</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(meeting.meeting_date)}
                      {meeting.meeting_time && ` ${formatTime(meeting.meeting_time)}`}
                    </p>
                  </div>
                </div>
                {meeting.venue && (
                  <div className="flex items-start space-x-2">
                    <MapPin className="h-4 w-4 mt-1 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">สถานที่</p>
                      <p className="text-sm text-muted-foreground">{meeting.venue}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            <Button onClick={handleClose} className="w-full" size="lg">
              ปิดหน้าต่าง
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check-in form
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">เช็คอินเข้าประชุม</CardTitle>
          <CardDescription className="text-center">กรุณายืนยันการเช็คอิน</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* LINE Profile */}
          {lineProfile && (
            <div className="flex items-center space-x-4 p-4 bg-muted/50 rounded-lg">
              {lineProfile.pictureUrl ? (
                <img
                  src={lineProfile.pictureUrl}
                  alt={lineProfile.displayName}
                  className="h-12 w-12 rounded-full"
                />
              ) : (
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-6 w-6 text-primary" />
                </div>
              )}
              <div className="flex-1">
                <p className="font-medium">{lineProfile.displayName}</p>
                <p className="text-sm text-muted-foreground">LINE Account</p>
              </div>
            </div>
          )}

          {/* Participant Info */}
          {participant && (
            <div className="space-y-2">
              <div>
                <p className="text-sm text-muted-foreground">ชื่อ</p>
                <p className="font-medium">
                  {participant.full_name}
                  {participant.nickname && ` (${participant.nickname})`}
                </p>
              </div>
              {participant.company && (
                <div>
                  <p className="text-sm text-muted-foreground">บริษัท</p>
                  <p className="font-medium">{participant.company}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">สถานะ</p>
                <p className="font-medium capitalize">{participant.status}</p>
              </div>
            </div>
          )}

          {/* Meeting Info */}
          {meeting && (
            <div className="space-y-2 pt-4 border-t">
              <div className="flex items-start space-x-2">
                <Calendar className="h-4 w-4 mt-1 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">การประชุม</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(meeting.meeting_date)}
                    {meeting.meeting_time && ` ${formatTime(meeting.meeting_time)}`}
                  </p>
                  {meeting.theme && (
                    <p className="text-sm text-muted-foreground mt-1">{meeting.theme}</p>
                  )}
                </div>
              </div>
              {meeting.venue && (
                <div className="flex items-start space-x-2">
                  <MapPin className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">สถานที่</p>
                    <p className="text-sm text-muted-foreground">{meeting.venue}</p>
                    {meeting.location_details && (
                      <p className="text-xs text-muted-foreground mt-1">{meeting.location_details}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Check-in Button */}
          <Button
            onClick={handleCheckIn}
            disabled={checking || !participant || !meeting}
            className="w-full"
            size="lg"
          >
            {checking ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                กำลังเช็คอิน...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-5 w-5" />
                เช็คอิน
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
