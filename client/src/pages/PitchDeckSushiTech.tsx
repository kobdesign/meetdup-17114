import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  ChevronLeft, 
  ChevronRight, 
  Maximize2, 
  Minimize2,
  Users,
  Target,
  TrendingUp,
  Zap,
  Globe,
  Rocket,
  CheckCircle,
  XCircle,
  Clock,
  MessageSquare,
  Calendar,
  LineChart,
  Building2,
  Award,
  Briefcase,
  MapPin,
  Sparkles,
  ArrowRight,
  Play,
  QrCode,
  Smartphone,
  BarChart3,
  Bot
} from "lucide-react";
import { SiLine } from "react-icons/si";
import QRCode from "react-qr-code";

interface SlideProps {
  children: React.ReactNode;
  className?: string;
}

function Slide({ children, className = "" }: SlideProps) {
  return (
    <div className={`w-full min-h-screen flex flex-col items-center justify-center p-8 md:p-12 ${className}`}>
      {children}
    </div>
  );
}

export default function PitchDeckSushiTech() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const totalSlides = 10;

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => Math.min(prev + 1, totalSlides - 1));
  }, []);

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => Math.max(prev - 1, 0));
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        nextSlide();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prevSlide();
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nextSlide, prevSlide, toggleFullscreen, isFullscreen]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const slides = [
    // Slide 1: Title - SuSHi Tech Focus
    <Slide key="title" className="bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] text-white">
      <div className="text-center max-w-4xl">
        <Badge className="mb-6 bg-red-500/20 text-red-300 border-red-500/30">
          <Sparkles className="w-3 h-3 mr-1" />
          SuSHi Tech Tokyo 2026
        </Badge>
        
        <div className="flex items-center justify-center gap-4 mb-6">
          <div className="w-20 h-20 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur">
            <Users className="w-12 h-12" />
          </div>
        </div>
        
        <h1 className="text-5xl md:text-7xl font-bold mb-4">Meetdup</h1>
        <p className="text-2xl md:text-3xl text-blue-200 mb-6">
          AI-Powered Business Networking Platform
        </p>
        <p className="text-lg text-blue-300/80 mb-10 max-w-2xl mx-auto">
          Transforming how 15,000+ business chapters worldwide manage meetings, members, and growth
        </p>
        
        <div className="flex flex-wrap justify-center gap-3">
          <Badge variant="secondary" className="text-sm px-4 py-2 bg-white/10 text-white border-0 gap-2">
            <Zap className="w-4 h-4" />
            AI + Text-to-SQL
          </Badge>
          <Badge variant="secondary" className="text-sm px-4 py-2 bg-white/10 text-white border-0 gap-2">
            <SiLine className="w-4 h-4" />
            LINE Ecosystem
          </Badge>
          <Badge variant="secondary" className="text-sm px-4 py-2 bg-white/10 text-white border-0 gap-2">
            <Globe className="w-4 h-4" />
            SEA → Japan
          </Badge>
        </div>
      </div>
    </Slide>,

    // Slide 2: Problem - Real Pain Points
    <Slide key="problem" className="bg-background">
      <div className="max-w-5xl w-full">
        <Badge variant="outline" className="mb-4">Pain Point</Badge>
        <h2 className="text-4xl md:text-5xl font-bold mb-4">
          Chapter Admins Waste <span className="text-destructive">10+ Hours/Week</span>
        </h2>
        <p className="text-xl text-muted-foreground mb-10">
          on manual operations that should be automated
        </p>
        
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="p-6 border-destructive/30 bg-destructive/5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-lg bg-destructive/20 flex items-center justify-center">
                <Clock className="w-6 h-6 text-destructive" />
              </div>
              <h3 className="font-semibold text-lg">Manual Operations</h3>
            </div>
            <ul className="space-y-2 text-muted-foreground text-sm">
              <li className="flex items-start gap-2">
                <XCircle className="w-4 h-4 mt-0.5 text-destructive shrink-0" />
                <span>Paper/Excel attendance tracking</span>
              </li>
              <li className="flex items-start gap-2">
                <XCircle className="w-4 h-4 mt-0.5 text-destructive shrink-0" />
                <span>Manual phone call reminders</span>
              </li>
              <li className="flex items-start gap-2">
                <XCircle className="w-4 h-4 mt-0.5 text-destructive shrink-0" />
                <span>Visitor follow-up falls through</span>
              </li>
            </ul>
          </Card>

          <Card className="p-6 border-destructive/30 bg-destructive/5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-lg bg-destructive/20 flex items-center justify-center">
                <LineChart className="w-6 h-6 text-destructive" />
              </div>
              <h3 className="font-semibold text-lg">No Data Insights</h3>
            </div>
            <ul className="space-y-2 text-muted-foreground text-sm">
              <li className="flex items-start gap-2">
                <XCircle className="w-4 h-4 mt-0.5 text-destructive shrink-0" />
                <span>Can't see attendance trends</span>
              </li>
              <li className="flex items-start gap-2">
                <XCircle className="w-4 h-4 mt-0.5 text-destructive shrink-0" />
                <span>Unknown visitor conversion rate</span>
              </li>
              <li className="flex items-start gap-2">
                <XCircle className="w-4 h-4 mt-0.5 text-destructive shrink-0" />
                <span>No KPIs for chapter health</span>
              </li>
            </ul>
          </Card>

          <Card className="p-6 border-destructive/30 bg-destructive/5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-lg bg-destructive/20 flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-destructive" />
              </div>
              <h3 className="font-semibold text-lg">Fragmented Tools</h3>
            </div>
            <ul className="space-y-2 text-muted-foreground text-sm">
              <li className="flex items-start gap-2">
                <XCircle className="w-4 h-4 mt-0.5 text-destructive shrink-0" />
                <span>Excel + LINE + Paper forms</span>
              </li>
              <li className="flex items-start gap-2">
                <XCircle className="w-4 h-4 mt-0.5 text-destructive shrink-0" />
                <span>Data scattered everywhere</span>
              </li>
              <li className="flex items-start gap-2">
                <XCircle className="w-4 h-4 mt-0.5 text-destructive shrink-0" />
                <span>Member info hard to find</span>
              </li>
            </ul>
          </Card>
        </div>

        <div className="mt-8 p-4 bg-muted/50 rounded-xl text-center">
          <p className="text-lg">
            <span className="font-bold">15,000+ chapters globally</span> face these problems daily
          </p>
        </div>
      </div>
    </Slide>,

    // Slide 3: Solution - Innovation Focus
    <Slide key="solution" className="bg-background">
      <div className="max-w-5xl w-full">
        <Badge variant="outline" className="mb-4 border-primary text-primary">Innovation</Badge>
        <h2 className="text-4xl md:text-5xl font-bold mb-4">
          AI-First Chapter Management
        </h2>
        <p className="text-xl text-muted-foreground mb-10">
          One platform to replace Excel, paper forms, and scattered tools
        </p>
        
        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                <Zap className="w-7 h-7 text-amber-500" />
              </div>
              <div>
                <h3 className="font-bold text-xl mb-1">AI Chapter Assistant</h3>
                <p className="text-muted-foreground">Ask questions in natural language (Thai/Japanese/English). "Show me visitor stats this month" - AI generates SQL and returns insights instantly.</p>
                <Badge variant="secondary" className="mt-2">OpenAI + Text-to-SQL</Badge>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
                <SiLine className="w-7 h-7 text-green-500" />
              </div>
              <div>
                <h3 className="font-bold text-xl mb-1">Deep LINE Integration</h3>
                <p className="text-muted-foreground">LIFF apps for member search, digital business cards, RSVP. Rich menus, webhooks, automated notifications - all native to LINE.</p>
                <Badge variant="secondary" className="mt-2">LIFF + Messaging API</Badge>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Calendar className="w-7 h-7 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-xl mb-1">Meeting Command Center</h3>
                <p className="text-muted-foreground">QR check-in, real-time attendance dashboard, visitor registration. Complete meeting day operations in one screen.</p>
                <Badge variant="secondary" className="mt-2">5-second check-in</Badge>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0">
                <LineChart className="w-7 h-7 text-purple-500" />
              </div>
              <div>
                <h3 className="font-bold text-xl mb-1">Performance Analytics</h3>
                <p className="text-muted-foreground">Track attendance rates, visitor-to-member conversion, chapter health KPIs. Data-driven decisions for chapter growth.</p>
                <Badge variant="secondary" className="mt-2">Real-time Dashboard</Badge>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Slide>,

    // Slide 4: Product Demo - Visual UI Showcase
    <Slide key="product-demo" className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="max-w-6xl w-full">
        <Badge className="mb-4 bg-amber-500/20 text-amber-300 border-0">Product Demo</Badge>
        <h2 className="text-3xl md:text-4xl font-bold mb-2">
          See It In Action
        </h2>
        <p className="text-lg text-slate-300 mb-6">
          Real UI from our production platform
        </p>

        <div className="grid md:grid-cols-3 gap-4">
          <Card className="p-4 bg-white/5 border-white/10 text-white">
            <div className="aspect-video bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg mb-3 flex flex-col items-center justify-center p-4 relative overflow-hidden">
              <div className="absolute inset-0 bg-black/20"></div>
              <div className="relative z-10 w-full">
                <div className="bg-white/10 rounded-md p-2 mb-2">
                  <div className="flex items-center gap-2 text-xs">
                    <Calendar className="w-4 h-4" />
                    <span>Meeting Command Center</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <div className="bg-green-500/30 rounded p-1 text-center text-xs">On-time: 28</div>
                  <div className="bg-amber-500/30 rounded p-1 text-center text-xs">Late: 3</div>
                  <div className="bg-red-500/30 rounded p-1 text-center text-xs">Absent: 2</div>
                </div>
                <div className="mt-2 flex items-center justify-center gap-2 text-xs bg-white/10 rounded p-2">
                  <QrCode className="w-6 h-6" />
                  <span>QR Check-in Ready</span>
                </div>
              </div>
            </div>
            <h3 className="font-bold text-sm mb-1 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-400" />
              Meeting Dashboard
            </h3>
            <p className="text-xs text-slate-400">Real-time attendance, QR scan check-in, visitor management</p>
          </Card>

          <Card className="p-4 bg-white/5 border-white/10 text-white">
            <div className="aspect-video bg-gradient-to-br from-green-600 to-green-800 rounded-lg mb-3 flex flex-col items-center justify-center p-4 relative overflow-hidden">
              <div className="absolute inset-0 bg-black/20"></div>
              <div className="relative z-10 w-full">
                <div className="bg-white/10 rounded-md p-2 mb-2 flex items-center gap-2">
                  <SiLine className="w-4 h-4 text-green-400" />
                  <span className="text-xs">LINE LIFF App</span>
                </div>
                <div className="bg-white/10 rounded-lg p-2 mb-1">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-xs">TN</div>
                    <div className="text-xs">
                      <div>Tanawat N.</div>
                      <div className="text-slate-400">IT Consultant</div>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-center text-slate-300">Tap to view profile</div>
              </div>
            </div>
            <h3 className="font-bold text-sm mb-1 flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-green-400" />
              LINE Member Search
            </h3>
            <p className="text-xs text-slate-400">Search members, view business cards, all inside LINE app</p>
          </Card>

          <Card className="p-4 bg-white/5 border-white/10 text-white">
            <div className="aspect-video bg-gradient-to-br from-amber-600 to-orange-700 rounded-lg mb-3 flex flex-col items-center justify-center p-4 relative overflow-hidden">
              <div className="absolute inset-0 bg-black/20"></div>
              <div className="relative z-10 w-full">
                <div className="bg-white/10 rounded-md p-2 mb-2 flex items-center gap-2">
                  <Bot className="w-4 h-4 text-amber-300" />
                  <span className="text-xs">AI Assistant</span>
                </div>
                <div className="bg-white/10 rounded-lg p-2 text-xs space-y-1">
                  <div className="text-amber-200">"วันนี้มี visitor กี่คน?"</div>
                  <div className="text-slate-300 pl-2 border-l-2 border-amber-400">
                    Today: 5 visitors registered, 4 checked-in
                  </div>
                </div>
              </div>
            </div>
            <h3 className="font-bold text-sm mb-1 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              AI Text-to-SQL
            </h3>
            <p className="text-xs text-slate-400">Ask in Thai/Japanese, get instant data insights</p>
          </Card>
        </div>

        <div className="mt-6 grid md:grid-cols-4 gap-3 text-center">
          <div className="bg-white/5 rounded-lg p-3">
            <div className="text-2xl font-bold text-green-400">5 sec</div>
            <div className="text-xs text-slate-400">Check-in time</div>
          </div>
          <div className="bg-white/5 rounded-lg p-3">
            <div className="text-2xl font-bold text-blue-400">98%</div>
            <div className="text-xs text-slate-400">Accuracy</div>
          </div>
          <div className="bg-white/5 rounded-lg p-3">
            <div className="text-2xl font-bold text-amber-400">3</div>
            <div className="text-xs text-slate-400">Languages</div>
          </div>
          <div className="bg-white/5 rounded-lg p-3">
            <div className="text-2xl font-bold text-purple-400">24/7</div>
            <div className="text-xs text-slate-400">AI Available</div>
          </div>
        </div>
      </div>
    </Slide>,

    // Slide 5: Impact & Traction
    <Slide key="impact" className="bg-background">
      <div className="max-w-5xl w-full">
        <Badge variant="outline" className="mb-4 border-green-500 text-green-600">Impact</Badge>
        <h2 className="text-4xl md:text-5xl font-bold mb-4">
          Proven Results from Pilot Chapters
        </h2>
        <p className="text-xl text-muted-foreground mb-10">
          Real impact measured with Thai BNI chapters
        </p>

        <div className="grid md:grid-cols-4 gap-6 mb-10">
          <Card className="p-6 text-center overflow-visible border-2 border-green-500/30 bg-green-500/5">
            <div className="text-5xl font-bold text-green-600 mb-2">-70%</div>
            <div className="text-sm text-muted-foreground">Admin Time Saved</div>
            <div className="text-xs text-muted-foreground mt-1">10h → 3h per week</div>
          </Card>
          <Card className="p-6 text-center overflow-visible border-2 border-blue-500/30 bg-blue-500/5">
            <div className="text-5xl font-bold text-blue-600 mb-2">98%</div>
            <div className="text-sm text-muted-foreground">Attendance Accuracy</div>
            <div className="text-xs text-muted-foreground mt-1">vs 80% with manual</div>
          </Card>
          <Card className="p-6 text-center overflow-visible border-2 border-amber-500/30 bg-amber-500/5">
            <div className="text-5xl font-bold text-amber-600 mb-2">+40%</div>
            <div className="text-sm text-muted-foreground">Visitor Conversion</div>
            <div className="text-xs text-muted-foreground mt-1">with follow-up automation</div>
          </Card>
          <Card className="p-6 text-center overflow-visible border-2 border-purple-500/30 bg-purple-500/5">
            <div className="text-5xl font-bold text-purple-600 mb-2">5 sec</div>
            <div className="text-sm text-muted-foreground">Check-in Time</div>
            <div className="text-xs text-muted-foreground mt-1">QR scan → done</div>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="p-6 overflow-visible">
            <h3 className="font-bold text-lg mb-4">Pilot Traction (Thailand)</h3>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-3xl font-bold text-primary">3</div>
                <div className="text-sm text-muted-foreground">Active Chapters</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-primary">150+</div>
                <div className="text-sm text-muted-foreground">Members Using</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-primary">50+</div>
                <div className="text-sm text-muted-foreground">Meetings Managed</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-primary">500+</div>
                <div className="text-sm text-muted-foreground">AI Queries/Month</div>
              </div>
            </div>
          </Card>

          <Card className="p-6 overflow-visible bg-muted/30">
            <h3 className="font-bold text-lg mb-4">Admin Testimonial</h3>
            <blockquote className="text-muted-foreground italic">
              "Before Meetdup, I spent hours every week on Excel and phone calls. Now everything is automated - check-in, reminders, reports. I can focus on actually growing my chapter."
            </blockquote>
            <div className="mt-4 text-sm">
              <div className="font-medium">Chapter President</div>
              <div className="text-muted-foreground">BNI Thailand Pilot Chapter</div>
            </div>
          </Card>
        </div>
      </div>
    </Slide>,

    // Slide 6: Japan Market Opportunity
    <Slide key="japan-market" className="bg-gradient-to-br from-red-900 via-red-800 to-rose-900 text-white">
      <div className="max-w-5xl w-full">
        <Badge className="mb-4 bg-white/20 text-white border-0">
          <MapPin className="w-3 h-3 mr-1" />
          Japan Expansion
        </Badge>
        <h2 className="text-4xl md:text-5xl font-bold mb-4">
          Japan: Our Next Frontier
        </h2>
        <p className="text-xl text-red-200 mb-10">
          Large established market ready for digital transformation
        </p>

        <div className="grid md:grid-cols-3 gap-6 mb-10">
          <Card className="p-6 bg-white/10 border-white/20 text-white text-center">
            <div className="text-5xl font-bold mb-2">348+</div>
            <div className="text-lg">BNI Chapters</div>
            <div className="text-sm text-red-200">in Japan alone</div>
          </Card>
          <Card className="p-6 bg-white/10 border-white/20 text-white text-center">
            <div className="text-5xl font-bold mb-2">12,700</div>
            <div className="text-lg">Active Members</div>
            <div className="text-sm text-red-200">potential users</div>
          </Card>
          <Card className="p-6 bg-white/10 border-white/20 text-white text-center">
            <div className="text-5xl font-bold mb-2">¥1.1T+</div>
            <div className="text-lg">Annual Referral Value</div>
            <div className="text-sm text-red-200">generated by BNI Japan</div>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="p-6 bg-white/10 rounded-xl">
            <h3 className="font-bold text-lg mb-4">Why Japan is Perfect for Meetdup</h3>
            <ul className="space-y-2 text-red-100">
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                <span>LINE is dominant messaging platform (95M+ users)</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                <span>High smartphone adoption & tech savvy users</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                <span>Strong business networking culture</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                <span>Willingness to pay for quality SaaS</span>
              </li>
            </ul>
          </div>

          <div className="p-6 bg-white/10 rounded-xl">
            <h3 className="font-bold text-lg mb-4">Japan Go-to-Market Strategy</h3>
            <ul className="space-y-2 text-red-100">
              <li className="flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Partner with BNI Japan regional directors</span>
              </li>
              <li className="flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Localize UI/UX for Japanese users</span>
              </li>
              <li className="flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Pilot with 3-5 chapters in Tokyo</span>
              </li>
              <li className="flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Leverage SuSHi Tech for visibility</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </Slide>,

    // Slide 7: Business Model
    <Slide key="business-model" className="bg-background">
      <div className="max-w-5xl w-full">
        <Badge variant="outline" className="mb-4">Business Model</Badge>
        <h2 className="text-4xl md:text-5xl font-bold mb-4">
          SaaS Subscription + AI Usage
        </h2>
        <p className="text-xl text-muted-foreground mb-10">
          Predictable recurring revenue with expansion potential
        </p>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card className="p-6 overflow-visible">
            <div className="text-center mb-6">
              <Badge className="mb-4">Core</Badge>
              <div className="text-4xl font-bold">$199</div>
              <div className="text-muted-foreground">/month per chapter</div>
            </div>
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                <span>Meeting management</span>
              </li>
              <li className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                <span>Member directory</span>
              </li>
              <li className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                <span>QR check-in</span>
              </li>
              <li className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                <span>Basic LINE bot</span>
              </li>
            </ul>
          </Card>

          <Card className="p-6 border-2 border-primary overflow-visible">
            <div className="text-center mb-6">
              <Badge variant="default" className="mb-4">Pro</Badge>
              <div className="text-4xl font-bold">$349</div>
              <div className="text-muted-foreground">/month per chapter</div>
            </div>
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                <span>Everything in Core</span>
              </li>
              <li className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                <span>AI Chapter Assistant</span>
              </li>
              <li className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                <span>LIFF apps (search, cards)</span>
              </li>
              <li className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                <span>Performance dashboard</span>
              </li>
            </ul>
          </Card>

          <Card className="p-6 overflow-visible">
            <div className="text-center mb-6">
              <Badge variant="secondary" className="mb-4">Enterprise</Badge>
              <div className="text-4xl font-bold">Custom</div>
              <div className="text-muted-foreground">for regions/franchises</div>
            </div>
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                <span>Multi-chapter dashboard</span>
              </li>
              <li className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                <span>Custom integrations</span>
              </li>
              <li className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                <span>Dedicated support</span>
              </li>
              <li className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                <span>Unlimited AI credits</span>
              </li>
            </ul>
          </Card>
        </div>

        <div className="p-6 bg-muted/30 rounded-xl">
          <h3 className="font-bold text-center mb-4">Target Economics</h3>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-primary">80%+</div>
              <div className="text-xs text-muted-foreground">Gross Margin</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">$4K+</div>
              <div className="text-xs text-muted-foreground">ACV per Chapter</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">6 mo</div>
              <div className="text-xs text-muted-foreground">CAC Payback</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">110%+</div>
              <div className="text-xs text-muted-foreground">Net Retention</div>
            </div>
          </div>
        </div>
      </div>
    </Slide>,

    // Slide 8: Team
    <Slide key="team" className="bg-background">
      <div className="max-w-5xl w-full">
        <Badge variant="outline" className="mb-4">Team</Badge>
        <h2 className="text-4xl md:text-5xl font-bold mb-4">
          Built by Domain Experts
        </h2>
        <p className="text-xl text-muted-foreground mb-10">
          Deep experience in networking chapters + enterprise software
        </p>

        <div className="grid md:grid-cols-3 gap-6 mb-10">
          <Card className="p-6 text-center overflow-visible">
            <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
              <Users className="w-12 h-12 text-primary" />
            </div>
            <h3 className="font-bold text-lg">Founder / CEO</h3>
            <p className="text-muted-foreground text-sm mb-3">Product & Strategy</p>
            <ul className="text-xs text-muted-foreground space-y-1 text-left">
              <li>10+ years tech entrepreneur</li>
              <li>Enterprise IT & SaaS background</li>
              <li>Building solutions for business networking</li>
            </ul>
          </Card>

          <Card className="p-6 text-center overflow-visible">
            <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500/20 to-blue-500/10 flex items-center justify-center">
              <Zap className="w-12 h-12 text-blue-500" />
            </div>
            <h3 className="font-bold text-lg">CTO</h3>
            <p className="text-muted-foreground text-sm mb-3">Engineering & AI</p>
            <ul className="text-xs text-muted-foreground space-y-1 text-left">
              <li>AI/ML specialist</li>
              <li>LINE API integration expert</li>
              <li>Full-stack engineering lead</li>
            </ul>
          </Card>

          <Card className="p-6 text-center overflow-visible">
            <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-green-500/20 to-green-500/10 flex items-center justify-center">
              <TrendingUp className="w-12 h-12 text-green-500" />
            </div>
            <h3 className="font-bold text-lg">COO</h3>
            <p className="text-muted-foreground text-sm mb-3">Operations & Growth</p>
            <ul className="text-xs text-muted-foreground space-y-1 text-left">
              <li>B2B SaaS sales expert</li>
              <li>SEA market experience</li>
              <li>Partnership development</li>
            </ul>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="p-6 bg-muted/30 overflow-visible">
            <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
              <Award className="w-5 h-5 text-primary" />
              Why We're Building This
            </h3>
            <p className="text-muted-foreground text-sm">
              As active BNI members, we experienced the pain of manual chapter management firsthand. 
              We know the problems because we live them daily - and we're building the solution we wished existed.
            </p>
          </Card>

          <Card className="p-6 bg-muted/30 overflow-visible">
            <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-primary" />
              Advisory Network
            </h3>
            <p className="text-muted-foreground text-sm">
              Connected to BNI regional directors in Thailand and SEA. 
              Building relationships with BNI Japan leadership for market entry support.
            </p>
          </Card>
        </div>
      </div>
    </Slide>,

    // Slide 9: Roadmap & SuSHi Tech Goals
    <Slide key="roadmap" className="bg-background">
      <div className="max-w-5xl w-full">
        <Badge variant="outline" className="mb-4 border-red-500 text-red-600">SuSHi Tech Goals</Badge>
        <h2 className="text-4xl md:text-5xl font-bold mb-4">
          Our Commitment to SuSHi Tech Tokyo
        </h2>
        <p className="text-xl text-muted-foreground mb-10">
          Ready to expand to Japan with your support
        </p>

        <div className="grid md:grid-cols-4 gap-4 mb-10">
          <Card className="p-4 text-center overflow-visible bg-green-500/5 border-green-500/30">
            <div className="text-sm font-medium text-green-600 mb-2">Q1 2026</div>
            <div className="font-bold mb-1">Japan Prep</div>
            <ul className="text-xs text-muted-foreground">
              <li>Japanese localization</li>
              <li>LINE Japan setup</li>
              <li>Market research</li>
            </ul>
          </Card>
          <Card className="p-4 text-center overflow-visible bg-blue-500/5 border-blue-500/30">
            <div className="text-sm font-medium text-blue-600 mb-2">Q2 2026</div>
            <div className="font-bold mb-1">SuSHi Tech Launch</div>
            <ul className="text-xs text-muted-foreground">
              <li>Booth at event</li>
              <li>Partner meetings</li>
              <li>First JP pilots</li>
            </ul>
          </Card>
          <Card className="p-4 text-center overflow-visible bg-amber-500/5 border-amber-500/30">
            <div className="text-sm font-medium text-amber-600 mb-2">Q3-Q4 2026</div>
            <div className="font-bold mb-1">Japan Growth</div>
            <ul className="text-xs text-muted-foreground">
              <li>10+ JP chapters</li>
              <li>BNI JP partnership</li>
              <li>Local team hire</li>
            </ul>
          </Card>
          <Card className="p-4 text-center overflow-visible bg-purple-500/5 border-purple-500/30">
            <div className="text-sm font-medium text-purple-600 mb-2">2027</div>
            <div className="font-bold mb-1">Scale</div>
            <ul className="text-xs text-muted-foreground">
              <li>50+ JP chapters</li>
              <li>Japan office</li>
              <li>Regional expansion</li>
            </ul>
          </Card>
        </div>

        <Card className="p-6 bg-gradient-to-r from-red-500/10 to-orange-500/10 border-red-500/30 overflow-visible">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-red-500" />
            What We'll Achieve at SuSHi Tech Tokyo 2026
          </h3>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
              <div>
                <div className="font-medium">Meet BNI Japan Leaders</div>
                <div className="text-sm text-muted-foreground">Establish partnership pipeline</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
              <div>
                <div className="font-medium">Demo to Chapter Admins</div>
                <div className="text-sm text-muted-foreground">Sign up first Japanese pilots</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
              <div>
                <div className="font-medium">Connect with Investors</div>
                <div className="text-sm text-muted-foreground">Explore Japan funding options</div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </Slide>,

    // Slide 10: Ask / Close with Demo Link
    <Slide key="close" className="bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] text-white">
      <div className="max-w-5xl w-full text-center">
        <Badge className="mb-4 bg-red-500/20 text-red-300 border-red-500/30">
          SuSHi Tech Tokyo 2026
        </Badge>
        
        <h2 className="text-3xl md:text-5xl font-bold mb-4">
          Ready to Transform
          <span className="text-amber-400"> Business Networking in Japan</span>
        </h2>
        
        <p className="text-lg text-blue-200 mb-8 max-w-2xl mx-auto">
          Help us bring AI-powered efficiency to 348+ Japanese chapters
        </p>

        <div className="grid md:grid-cols-2 gap-8 mb-8">
          <Card className="p-6 bg-white/10 border-white/20 text-white">
            <h3 className="font-bold text-xl mb-4 flex items-center justify-center gap-2">
              <Play className="w-6 h-6 text-green-400" />
              Try Live Demo
            </h3>
            <p className="text-blue-200 text-sm mb-4">
              Experience the full platform with realistic Thai chapter data
            </p>
            <a href="/demo" target="_blank" rel="noopener noreferrer">
              <Button size="lg" className="bg-green-500 hover:bg-green-600 text-white w-full gap-2">
                <Play className="w-5 h-5" />
                Launch Demo
              </Button>
            </a>
            <div className="mt-4 p-3 bg-white rounded-lg inline-block">
              <QRCode value={typeof window !== 'undefined' ? `${window.location.origin}/demo` : '/demo'} size={100} />
            </div>
            <p className="text-xs text-blue-300 mt-2">Scan to try on mobile</p>
          </Card>

          <Card className="p-6 bg-white/10 border-white/20 text-white">
            <h3 className="font-bold text-xl mb-4">What We'll Do at SuSHi Tech</h3>
            <ul className="space-y-3 text-left">
              <li className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
                <span>Demo platform to BNI Japan leaders</span>
              </li>
              <li className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
                <span>Sign up 3-5 Tokyo pilot chapters</span>
              </li>
              <li className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
                <span>Connect with Japanese investors</span>
              </li>
              <li className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
                <span>Establish local partnerships</span>
              </li>
            </ul>
            <div className="mt-6 pt-4 border-t border-white/20">
              <div className="flex items-center justify-center gap-3">
                <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center">
                  <Users className="w-7 h-7" />
                </div>
                <div className="text-left">
                  <h4 className="font-bold">Meetdup</h4>
                  <p className="text-sm text-blue-200">hello@meetdup.io</p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <p className="text-xl text-blue-300 font-medium">
          ขอบคุณครับ / ありがとうございます / Thank You
        </p>
      </div>
    </Slide>,
  ];

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-background" data-testid="pitch-deck-sushitech">
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        <Badge variant="outline" className="bg-background/80 backdrop-blur">
          {currentSlide + 1} / {totalSlides}
        </Badge>
        <Button
          size="icon"
          variant="outline"
          onClick={toggleFullscreen}
          className="bg-background/80 backdrop-blur"
          data-testid="button-fullscreen"
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </Button>
      </div>

      <div className="h-full w-full overflow-hidden">
        {slides[currentSlide]}
      </div>

      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 z-50">
        <Button
          size="icon"
          variant="outline"
          onClick={prevSlide}
          disabled={currentSlide === 0}
          className="bg-background/80 backdrop-blur"
          data-testid="button-prev-slide"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>

        <div className="w-48">
          <Progress value={((currentSlide + 1) / totalSlides) * 100} className="h-2" />
        </div>

        <Button
          size="icon"
          variant="outline"
          onClick={nextSlide}
          disabled={currentSlide === totalSlides - 1}
          className="bg-background/80 backdrop-blur"
          data-testid="button-next-slide"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      <div className="fixed bottom-4 left-4 text-xs text-muted-foreground z-50">
        Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">←</kbd> <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">→</kbd> to navigate, <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">F</kbd> for fullscreen
      </div>
    </div>
  );
}
