import { useEffect, useState } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Calendar, 
  MapPin, 
  Clock, 
  ArrowLeft, 
  UserPlus, 
  Users, 
  TrendingUp, 
  Briefcase,
  CheckCircle,
  ExternalLink
} from "lucide-react";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import VisitorRegistrationDialog from "@/components/dialogs/VisitorRegistrationDialog";

interface ChapterData {
  tenant_id: string;
  name: string;
  subdomain: string;
  logo_url?: string;
  branding_color: string;
  visitor_fee?: number | null;
}

interface ChapterStats {
  member_count: number;
  referral_count: number;
  checkin_count: number;
  category_count: number;
}

interface NextMeeting {
  meeting_id: string;
  meeting_date: string;
  meeting_time?: string;
  theme?: string;
  venue?: string;
  visitor_fee?: number | null;
}

interface ChapterResponse {
  success: boolean;
  chapter: ChapterData;
  stats: ChapterStats;
  next_meeting: NextMeeting | null;
}

export default function ChapterProfile() {
  const { subdomain } = useParams<{ subdomain: string }>();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [chapter, setChapter] = useState<ChapterData | null>(null);
  const [stats, setStats] = useState<ChapterStats | null>(null);
  const [nextMeeting, setNextMeeting] = useState<NextMeeting | null>(null);
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
      const response = await fetch(`/api/public/chapter-stats/${subdomain}`);
      if (!response.ok) {
        throw new Error("Failed to load chapter data");
      }
      
      const data: ChapterResponse = await response.json();
      
      if (data.success) {
        setChapter(data.chapter);
        setStats(data.stats);
        setNextMeeting(data.next_meeting);
      }
    } catch (error: any) {
      console.error("Error loading chapter data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterClick = (meetingId?: string) => {
    setSelectedMeetingId(meetingId);
    setShowRegistrationDialog(true);
  };

  const formatMeetingTime = (time?: string) => {
    if (!time) return "07:00";
    return time.substring(0, 5);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="text-lg text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  if (!chapter) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Chapter Not Found</h1>
          <p className="text-muted-foreground">The chapter you're looking for doesn't exist.</p>
          <Button asChild>
            <Link to="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const brandColor = chapter.branding_color || "#1e3a5f";

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      {/* Hero Section */}
      <section 
        className="relative py-12 md:py-16"
        style={{ backgroundColor: brandColor }}
      >
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center gap-6 text-white">
            {/* Logo */}
            {chapter.logo_url ? (
              <img
                src={chapter.logo_url}
                alt={`${chapter.name} logo`}
                className="w-24 h-24 md:w-32 md:h-32 rounded-xl object-cover bg-white/10 border-2 border-white/20"
              />
            ) : (
              <div 
                className="w-24 h-24 md:w-32 md:h-32 rounded-xl bg-white/10 border-2 border-white/20 flex items-center justify-center"
              >
                <Users className="w-12 h-12 text-white/60" />
              </div>
            )}

            {/* Chapter Info */}
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-3xl md:text-4xl font-bold mb-2">{chapter.name}</h1>
              <p className="text-white/80 text-lg mb-4">Business Networking Chapter</p>
              
              {/* Next Meeting Highlight */}
              {nextMeeting && (
                <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2 text-sm md:text-base">
                  <Calendar className="h-5 w-5" />
                  <span>Next Meeting:</span>
                  <span className="font-semibold">
                    {format(new Date(nextMeeting.meeting_date), "d MMM yyyy", { locale: th })}
                  </span>
                  <span className="text-white/60">|</span>
                  <Clock className="h-4 w-4" />
                  <span>{formatMeetingTime(nextMeeting.meeting_time)}</span>
                </div>
              )}
            </div>

            {/* Primary CTA */}
            <div className="flex-shrink-0">
              <Button 
                size="lg" 
                className="bg-white text-foreground hover:bg-white/90 shadow-lg"
                onClick={() => handleRegisterClick(nextMeeting?.meeting_id)}
                data-testid="button-register-visitor-hero"
              >
                <UserPlus className="mr-2 h-5 w-5" />
                Register as Visitor
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Strip */}
      {stats && (
        <section className="border-b bg-card">
          <div className="container mx-auto px-4 py-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <span className="text-2xl font-bold" style={{ color: brandColor }}>
                    {stats.member_count}
                  </span>
                </div>
                <span className="text-sm text-muted-foreground">Members</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-muted-foreground" />
                  <span className="text-2xl font-bold" style={{ color: brandColor }}>
                    {stats.referral_count}
                  </span>
                </div>
                <span className="text-sm text-muted-foreground">Referrals</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-muted-foreground" />
                  <span className="text-2xl font-bold" style={{ color: brandColor }}>
                    {stats.checkin_count}
                  </span>
                </div>
                <span className="text-sm text-muted-foreground">Check-ins</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-muted-foreground" />
                  <span className="text-2xl font-bold" style={{ color: brandColor }}>
                    {stats.category_count}
                  </span>
                </div>
                <span className="text-sm text-muted-foreground">Industries</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Meeting Details Card */}
          {nextMeeting && (
            <Card className="md:col-span-1">
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Calendar className="h-5 w-5" style={{ color: brandColor }} />
                  Next Meeting
                </h2>
                
                <div className="space-y-4">
                  {/* Date & Time */}
                  <div className="flex items-start gap-3">
                    <div 
                      className="flex-shrink-0 w-14 h-14 rounded-lg flex flex-col items-center justify-center text-white"
                      style={{ backgroundColor: brandColor }}
                    >
                      <span className="text-xl font-bold leading-none">
                        {format(new Date(nextMeeting.meeting_date), "d")}
                      </span>
                      <span className="text-xs uppercase">
                        {format(new Date(nextMeeting.meeting_date), "MMM", { locale: th })}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium">
                        {format(new Date(nextMeeting.meeting_date), "EEEE", { locale: th })}
                      </p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatMeetingTime(nextMeeting.meeting_time)}
                      </p>
                    </div>
                  </div>

                  {/* Venue */}
                  {nextMeeting.venue && (
                    <div className="flex items-start gap-3">
                      <MapPin className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">{nextMeeting.venue}</p>
                        <Button 
                          variant="link" 
                          size="sm" 
                          className="h-auto p-0 text-xs"
                          asChild
                        >
                          <a 
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(nextMeeting.venue)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            data-testid="link-view-map"
                          >
                            View on Map <ExternalLink className="h-3 w-3 ml-1" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Theme */}
                  {nextMeeting.theme && (
                    <div className="pt-2 border-t">
                      <p className="text-sm text-muted-foreground">Theme</p>
                      <p className="font-medium">{nextMeeting.theme}</p>
                    </div>
                  )}

                  {/* Fee - from meeting or fallback to chapter default */}
                  {(nextMeeting.visitor_fee != null || chapter.visitor_fee != null) && (
                    <div className="pt-2 border-t">
                      <p className="text-sm text-muted-foreground">Visitor Fee</p>
                      <p className="font-medium">
                        {(() => {
                          const fee = nextMeeting.visitor_fee ?? chapter.visitor_fee;
                          if (fee === 0 || fee === null) return "Free";
                          return `${fee.toLocaleString()} THB`;
                        })()}
                      </p>
                    </div>
                  )}

                  <Button 
                    className="w-full mt-4"
                    style={{ backgroundColor: brandColor }}
                    onClick={() => handleRegisterClick(nextMeeting.meeting_id)}
                    data-testid="button-register-visitor-meeting"
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    Register for This Meeting
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Visitor Journey Card */}
          <Card className="md:col-span-1">
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold mb-4">What to Expect</h2>
              
              <div className="space-y-4">
                {[
                  { step: 1, title: "Register Online", desc: "Fill out the form before meeting day" },
                  { step: 2, title: "Arrive Early", desc: "Come 10-15 minutes before start time" },
                  { step: 3, title: "30-Second Intro", desc: "Prepare a brief introduction about yourself" },
                  { step: 4, title: "Network", desc: "Connect with members during open networking" },
                ].map((item) => (
                  <div key={item.step} className="flex items-start gap-3">
                    <div 
                      className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold"
                      style={{ backgroundColor: brandColor }}
                    >
                      {item.step}
                    </div>
                    <div>
                      <p className="font-medium">{item.title}</p>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-4 border-t">
                <h3 className="font-medium mb-2">Dress Code</h3>
                <Badge variant="secondary">Business Casual</Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* About Chapter */}
        <Card className="mt-6">
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold mb-4">About {chapter.name}</h2>
            <p className="text-muted-foreground leading-relaxed">
              We are a business networking chapter that meets regularly to share referrals, 
              build relationships, and grow our businesses together. Our members represent 
              diverse industries and are committed to helping each other succeed through 
              the power of word-of-mouth marketing.
            </p>
            
            {stats && stats.category_count > 0 && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Our chapter includes professionals from <span className="font-medium text-foreground">{stats.category_count} different industries</span>, 
                  creating a diverse network of business connections.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="border-t py-6 mb-16 md:mb-0">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>Powered by Meetdup</p>
        </div>
      </footer>

      {/* Sticky Mobile CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t md:hidden z-50">
        <Button 
          className="w-full"
          size="lg"
          style={{ backgroundColor: brandColor }}
          onClick={() => handleRegisterClick(nextMeeting?.meeting_id)}
          data-testid="button-register-visitor-sticky"
        >
          <UserPlus className="mr-2 h-5 w-5" />
          Register as Visitor
        </Button>
      </div>

      {/* Registration Dialog */}
      <VisitorRegistrationDialog
        open={showRegistrationDialog}
        onOpenChange={setShowRegistrationDialog}
        tenantId={chapter.tenant_id}
        meetingId={selectedMeetingId}
      />
    </div>
  );
}
