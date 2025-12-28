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
  DollarSign,
  BarChart3,
  Globe,
  Shield,
  Rocket,
  CheckCircle,
  XCircle,
  Clock,
  MessageSquare,
  Calendar,
  UserPlus,
  LineChart
} from "lucide-react";

interface SlideProps {
  children: React.ReactNode;
  className?: string;
}

function Slide({ children, className = "" }: SlideProps) {
  return (
    <div className={`w-full h-full flex flex-col items-center justify-center p-8 md:p-16 ${className}`}>
      {children}
    </div>
  );
}

export default function PitchDeck() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const totalSlides = 12;

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
    // Slide 1: Title
    <Slide key="title" className="bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 text-white">
      <div className="text-center max-w-4xl">
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center">
            <Users className="w-10 h-10" />
          </div>
        </div>
        <h1 className="text-5xl md:text-7xl font-bold mb-4">Meetdup</h1>
        <p className="text-xl md:text-2xl text-blue-200 mb-8">
          AI-Powered Chapter Management Platform
        </p>
        <p className="text-lg text-blue-300 mb-12">
          Transforming how business networking chapters operate
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Badge variant="secondary" className="text-sm px-4 py-2 bg-white/20 text-white border-0">
            SaaS
          </Badge>
          <Badge variant="secondary" className="text-sm px-4 py-2 bg-white/20 text-white border-0">
            B2B
          </Badge>
          <Badge variant="secondary" className="text-sm px-4 py-2 bg-white/20 text-white border-0">
            AI-Powered
          </Badge>
          <Badge variant="secondary" className="text-sm px-4 py-2 bg-white/20 text-white border-0">
            LINE Integration
          </Badge>
        </div>
      </div>
    </Slide>,

    // Slide 2: Problem
    <Slide key="problem" className="bg-background">
      <div className="max-w-5xl w-full">
        <h2 className="text-4xl md:text-5xl font-bold text-center mb-4">The Problem</h2>
        <p className="text-xl text-muted-foreground text-center mb-12">
          Chapter admins spend 10+ hours/week on manual operations
        </p>
        
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="p-6 border-destructive/30 bg-destructive/5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-lg bg-destructive/20 flex items-center justify-center">
                <Clock className="w-6 h-6 text-destructive" />
              </div>
              <h3 className="font-semibold text-lg">Time-Consuming</h3>
            </div>
            <ul className="space-y-2 text-muted-foreground">
              <li className="flex items-start gap-2">
                <XCircle className="w-4 h-4 mt-1 text-destructive shrink-0" />
                <span>Manual attendance tracking via paper/Excel</span>
              </li>
              <li className="flex items-start gap-2">
                <XCircle className="w-4 h-4 mt-1 text-destructive shrink-0" />
                <span>Phone calls for meeting reminders</span>
              </li>
              <li className="flex items-start gap-2">
                <XCircle className="w-4 h-4 mt-1 text-destructive shrink-0" />
                <span>Visitor follow-up falls through cracks</span>
              </li>
            </ul>
          </Card>

          <Card className="p-6 border-destructive/30 bg-destructive/5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-lg bg-destructive/20 flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-destructive" />
              </div>
              <h3 className="font-semibold text-lg">No Insights</h3>
            </div>
            <ul className="space-y-2 text-muted-foreground">
              <li className="flex items-start gap-2">
                <XCircle className="w-4 h-4 mt-1 text-destructive shrink-0" />
                <span>No visibility into attendance trends</span>
              </li>
              <li className="flex items-start gap-2">
                <XCircle className="w-4 h-4 mt-1 text-destructive shrink-0" />
                <span>Can't track visitor conversion</span>
              </li>
              <li className="flex items-start gap-2">
                <XCircle className="w-4 h-4 mt-1 text-destructive shrink-0" />
                <span>No data to improve chapter health</span>
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
            <ul className="space-y-2 text-muted-foreground">
              <li className="flex items-start gap-2">
                <XCircle className="w-4 h-4 mt-1 text-destructive shrink-0" />
                <span>Spreadsheets, LINE groups, paper forms</span>
              </li>
              <li className="flex items-start gap-2">
                <XCircle className="w-4 h-4 mt-1 text-destructive shrink-0" />
                <span>Data scattered across platforms</span>
              </li>
              <li className="flex items-start gap-2">
                <XCircle className="w-4 h-4 mt-1 text-destructive shrink-0" />
                <span>Member info hard to find</span>
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </Slide>,

    // Slide 3: Solution
    <Slide key="solution" className="bg-background">
      <div className="max-w-5xl w-full">
        <h2 className="text-4xl md:text-5xl font-bold text-center mb-4">The Solution</h2>
        <p className="text-xl text-muted-foreground text-center mb-12">
          All-in-one platform with AI-powered assistant
        </p>
        
        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Calendar className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">Meeting Command Center</h3>
                <p className="text-muted-foreground">One dashboard for all meeting-day operations. QR check-in, attendance tracking, visitor management.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">Member & Visitor Management</h3>
                <p className="text-muted-foreground">Complete pipeline from visitor to member. Track conversions, payments, and engagement.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <MessageSquare className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">LINE Integration</h3>
                <p className="text-muted-foreground">Deep integration with LINE ecosystem. Rich menus, LIFF apps, automated notifications.</p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                <Zap className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">AI Chapter Assistant</h3>
                <p className="text-muted-foreground">Ask questions in Thai, get instant answers. "Show me visitor stats this month" - AI handles the rest.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                <LineChart className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">Performance Dashboard</h3>
                <p className="text-muted-foreground">Track attendance rates, conversion funnels, and chapter health metrics at a glance.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                <UserPlus className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">Self-Service Onboarding</h3>
                <p className="text-muted-foreground">Members activate themselves via LINE. No admin intervention needed.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Slide>,

    // Slide 4: Product Demo
    <Slide key="product" className="bg-background">
      <div className="max-w-5xl w-full">
        <h2 className="text-4xl md:text-5xl font-bold text-center mb-4">Product Highlights</h2>
        <p className="text-xl text-muted-foreground text-center mb-12">
          Built for real chapter workflows
        </p>
        
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="p-6 overflow-visible">
            <div className="aspect-video bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900 dark:to-blue-800 rounded-lg mb-4 flex items-center justify-center">
              <Calendar className="w-16 h-16 text-blue-600 dark:text-blue-300" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Meeting Operations</h3>
            <p className="text-sm text-muted-foreground">QR scanner, real-time attendance, visitor check-in - all in one screen</p>
          </Card>

          <Card className="p-6 overflow-visible">
            <div className="aspect-video bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900 dark:to-green-800 rounded-lg mb-4 flex items-center justify-center">
              <MessageSquare className="w-16 h-16 text-green-600 dark:text-green-300" />
            </div>
            <h3 className="font-semibold text-lg mb-2">LINE Bot + LIFF</h3>
            <p className="text-sm text-muted-foreground">Member search, digital business cards, RSVP - all inside LINE</p>
          </Card>

          <Card className="p-6 overflow-visible">
            <div className="aspect-video bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-900 dark:to-amber-800 rounded-lg mb-4 flex items-center justify-center">
              <Zap className="w-16 h-16 text-amber-600 dark:text-amber-300" />
            </div>
            <h3 className="font-semibold text-lg mb-2">AI Assistant</h3>
            <p className="text-sm text-muted-foreground">Natural language queries in Thai - powered by OpenAI + n8n</p>
          </Card>
        </div>

        <div className="mt-8 p-6 bg-muted/50 rounded-xl">
          <h3 className="font-semibold text-center mb-4">Key Metrics After Implementation</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-3xl font-bold text-primary">-70%</div>
              <div className="text-sm text-muted-foreground">Admin Time</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-green-600">+25%</div>
              <div className="text-sm text-muted-foreground">Attendance Rate</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-amber-600">+40%</div>
              <div className="text-sm text-muted-foreground">Visitor Conversion</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-purple-600">100%</div>
              <div className="text-sm text-muted-foreground">Digital Records</div>
            </div>
          </div>
        </div>
      </div>
    </Slide>,

    // Slide 5: Market Size
    <Slide key="market" className="bg-background">
      <div className="max-w-5xl w-full">
        <h2 className="text-4xl md:text-5xl font-bold text-center mb-4">Market Opportunity</h2>
        <p className="text-xl text-muted-foreground text-center mb-12">
          Large, underserved vertical SaaS market
        </p>

        <div className="grid md:grid-cols-3 gap-8 mb-12">
          <Card className="p-8 text-center border-2">
            <div className="text-sm font-medium text-muted-foreground mb-2">TAM</div>
            <div className="text-4xl font-bold text-primary mb-2">$60M</div>
            <div className="text-sm text-muted-foreground">Total Addressable Market</div>
            <div className="mt-4 p-3 bg-muted/50 rounded-lg text-sm">
              ~15,000 chapters globally
              <br />
              BNI, LeTip, similar networks
            </div>
          </Card>

          <Card className="p-8 text-center border-2 border-primary">
            <div className="text-sm font-medium text-muted-foreground mb-2">SAM</div>
            <div className="text-4xl font-bold text-primary mb-2">$6.4M</div>
            <div className="text-sm text-muted-foreground">Serviceable Available Market</div>
            <div className="mt-4 p-3 bg-primary/10 rounded-lg text-sm">
              ~1,600 chapters in SEA
              <br />
              LINE-first markets
            </div>
          </Card>

          <Card className="p-8 text-center border-2">
            <div className="text-sm font-medium text-muted-foreground mb-2">SOM</div>
            <div className="text-4xl font-bold text-primary mb-2">$320K</div>
            <div className="text-sm text-muted-foreground">3-Year Target</div>
            <div className="mt-4 p-3 bg-muted/50 rounded-lg text-sm">
              ~80 chapters (5% SEA)
              <br />
              $4K avg. annual revenue
            </div>
          </Card>
        </div>

        <div className="bg-muted/30 p-6 rounded-xl">
          <h3 className="font-semibold text-center mb-4">Market Calculation</h3>
          <div className="text-center text-sm text-muted-foreground">
            15,000 chapters x $4,000/year average = <span className="font-bold text-foreground">$60M TAM</span>
            <br />
            Pricing: Core $199/mo ($2,388/yr) | Pro $349/mo ($4,188/yr) | Enterprise Custom
          </div>
        </div>
      </div>
    </Slide>,

    // Slide 6: Business Model
    <Slide key="business-model" className="bg-background">
      <div className="max-w-5xl w-full">
        <h2 className="text-4xl md:text-5xl font-bold text-center mb-4">Business Model</h2>
        <p className="text-xl text-muted-foreground text-center mb-12">
          SaaS subscription + usage-based AI credits
        </p>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card className="p-6 overflow-visible">
            <div className="text-center mb-6">
              <Badge className="mb-4">Core</Badge>
              <div className="text-4xl font-bold">$199</div>
              <div className="text-muted-foreground">/month</div>
            </div>
            <ul className="space-y-3">
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                <span className="text-sm">Meeting management</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                <span className="text-sm">Member directory</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                <span className="text-sm">QR check-in</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                <span className="text-sm">Basic LINE bot</span>
              </li>
            </ul>
          </Card>

          <Card className="p-6 border-2 border-primary overflow-visible">
            <div className="text-center mb-6">
              <Badge variant="default" className="mb-4">Pro</Badge>
              <div className="text-4xl font-bold">$349</div>
              <div className="text-muted-foreground">/month</div>
            </div>
            <ul className="space-y-3">
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                <span className="text-sm">Everything in Core</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                <span className="text-sm">AI Chapter Assistant</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                <span className="text-sm">LIFF apps (search, cards)</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                <span className="text-sm">Performance dashboard</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                <span className="text-sm">500 AI credits/mo</span>
              </li>
            </ul>
          </Card>

          <Card className="p-6 overflow-visible">
            <div className="text-center mb-6">
              <Badge variant="secondary" className="mb-4">Enterprise</Badge>
              <div className="text-4xl font-bold">Custom</div>
              <div className="text-muted-foreground">pricing</div>
            </div>
            <ul className="space-y-3">
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                <span className="text-sm">Everything in Pro</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                <span className="text-sm">Multi-chapter support</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                <span className="text-sm">Custom integrations</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                <span className="text-sm">Dedicated support</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                <span className="text-sm">Unlimited AI credits</span>
              </li>
            </ul>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="p-6 bg-muted/30 overflow-visible">
            <h3 className="font-semibold mb-3">Additional Revenue</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Implementation fee: $500-2,000</li>
              <li>Extra AI credits: $0.05/query</li>
              <li>Mini-apps marketplace (future)</li>
            </ul>
          </Card>
          <Card className="p-6 bg-muted/30 overflow-visible">
            <h3 className="font-semibold mb-3">Unit Economics Target</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Gross margin: 80%+</li>
              <li>CAC payback: 6 months</li>
              <li>Net revenue retention: 110%+</li>
            </ul>
          </Card>
        </div>
      </div>
    </Slide>,

    // Slide 7: Traction
    <Slide key="traction" className="bg-background">
      <div className="max-w-5xl w-full">
        <h2 className="text-4xl md:text-5xl font-bold text-center mb-4">Traction</h2>
        <p className="text-xl text-muted-foreground text-center mb-12">
          Early validation with pilot chapters
        </p>

        <div className="grid md:grid-cols-4 gap-6 mb-12">
          <Card className="p-6 text-center overflow-visible">
            <div className="text-4xl font-bold text-primary mb-2">3</div>
            <div className="text-sm text-muted-foreground">Pilot Chapters</div>
          </Card>
          <Card className="p-6 text-center overflow-visible">
            <div className="text-4xl font-bold text-green-600 mb-2">150+</div>
            <div className="text-sm text-muted-foreground">Active Members</div>
          </Card>
          <Card className="p-6 text-center overflow-visible">
            <div className="text-4xl font-bold text-amber-600 mb-2">50+</div>
            <div className="text-sm text-muted-foreground">Meetings Tracked</div>
          </Card>
          <Card className="p-6 text-center overflow-visible">
            <div className="text-4xl font-bold text-purple-600 mb-2">500+</div>
            <div className="text-sm text-muted-foreground">AI Queries/mo</div>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <Card className="p-6 overflow-visible">
            <h3 className="font-semibold mb-4">Pilot Results</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Attendance tracking time reduced</span>
                  <span className="font-medium">-70%</span>
                </div>
                <Progress value={70} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Visitor follow-up rate improved</span>
                  <span className="font-medium">+45%</span>
                </div>
                <Progress value={45} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Member satisfaction (NPS)</span>
                  <span className="font-medium">72</span>
                </div>
                <Progress value={72} className="h-2" />
              </div>
            </div>
          </Card>

          <Card className="p-6 overflow-visible">
            <h3 className="font-semibold mb-4">Testimonial</h3>
            <div className="bg-muted/50 p-4 rounded-lg italic text-muted-foreground mb-4">
              "Meetdup transformed how we run our weekly meetings. What used to take 2 hours of admin work now happens automatically. The AI assistant is game-changing."
            </div>
            <div className="text-sm">
              <div className="font-medium">Chapter Director</div>
              <div className="text-muted-foreground">BNI Bangkok</div>
            </div>
          </Card>
        </div>
      </div>
    </Slide>,

    // Slide 8: Competition
    <Slide key="competition" className="bg-background">
      <div className="max-w-5xl w-full">
        <h2 className="text-4xl md:text-5xl font-bold text-center mb-4">Competitive Landscape</h2>
        <p className="text-xl text-muted-foreground text-center mb-12">
          Differentiated by vertical focus and AI
        </p>

        <div className="overflow-x-auto mb-8">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left p-3">Feature</th>
                <th className="text-center p-3">Meetdup</th>
                <th className="text-center p-3 text-muted-foreground">BNI Connect</th>
                <th className="text-center p-3 text-muted-foreground">Glue Up</th>
                <th className="text-center p-3 text-muted-foreground">Wild Apricot</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="p-3">Chapter-specific workflows</td>
                <td className="text-center p-3"><CheckCircle className="w-5 h-5 text-green-500 mx-auto" /></td>
                <td className="text-center p-3"><CheckCircle className="w-5 h-5 text-green-500 mx-auto" /></td>
                <td className="text-center p-3"><XCircle className="w-5 h-5 text-muted-foreground mx-auto" /></td>
                <td className="text-center p-3"><XCircle className="w-5 h-5 text-muted-foreground mx-auto" /></td>
              </tr>
              <tr className="border-b">
                <td className="p-3">AI Assistant (Thai)</td>
                <td className="text-center p-3"><CheckCircle className="w-5 h-5 text-green-500 mx-auto" /></td>
                <td className="text-center p-3"><XCircle className="w-5 h-5 text-muted-foreground mx-auto" /></td>
                <td className="text-center p-3"><XCircle className="w-5 h-5 text-muted-foreground mx-auto" /></td>
                <td className="text-center p-3"><XCircle className="w-5 h-5 text-muted-foreground mx-auto" /></td>
              </tr>
              <tr className="border-b">
                <td className="p-3">LINE Integration</td>
                <td className="text-center p-3"><CheckCircle className="w-5 h-5 text-green-500 mx-auto" /></td>
                <td className="text-center p-3"><XCircle className="w-5 h-5 text-muted-foreground mx-auto" /></td>
                <td className="text-center p-3"><XCircle className="w-5 h-5 text-muted-foreground mx-auto" /></td>
                <td className="text-center p-3"><XCircle className="w-5 h-5 text-muted-foreground mx-auto" /></td>
              </tr>
              <tr className="border-b">
                <td className="p-3">QR Check-in</td>
                <td className="text-center p-3"><CheckCircle className="w-5 h-5 text-green-500 mx-auto" /></td>
                <td className="text-center p-3"><CheckCircle className="w-5 h-5 text-green-500 mx-auto" /></td>
                <td className="text-center p-3"><CheckCircle className="w-5 h-5 text-green-500 mx-auto" /></td>
                <td className="text-center p-3"><XCircle className="w-5 h-5 text-muted-foreground mx-auto" /></td>
              </tr>
              <tr className="border-b">
                <td className="p-3">Performance Dashboard</td>
                <td className="text-center p-3"><CheckCircle className="w-5 h-5 text-green-500 mx-auto" /></td>
                <td className="text-center p-3"><CheckCircle className="w-5 h-5 text-green-500 mx-auto" /></td>
                <td className="text-center p-3"><CheckCircle className="w-5 h-5 text-green-500 mx-auto" /></td>
                <td className="text-center p-3"><CheckCircle className="w-5 h-5 text-green-500 mx-auto" /></td>
              </tr>
              <tr>
                <td className="p-3">Price (per chapter/mo)</td>
                <td className="text-center p-3 font-medium">$199-349</td>
                <td className="text-center p-3 text-muted-foreground">Bundled</td>
                <td className="text-center p-3 text-muted-foreground">$500+</td>
                <td className="text-center p-3 text-muted-foreground">$150+</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <Card className="p-4 bg-primary/5 border-primary/20 overflow-visible">
            <h4 className="font-semibold text-sm mb-2">Vertical Focus</h4>
            <p className="text-xs text-muted-foreground">Built specifically for chapter networking, not generic membership</p>
          </Card>
          <Card className="p-4 bg-amber-500/5 border-amber-500/20 overflow-visible">
            <h4 className="font-semibold text-sm mb-2">AI-First</h4>
            <p className="text-xs text-muted-foreground">Only solution with Thai AI assistant for data queries</p>
          </Card>
          <Card className="p-4 bg-green-500/5 border-green-500/20 overflow-visible">
            <h4 className="font-semibold text-sm mb-2">LINE Ecosystem</h4>
            <p className="text-xs text-muted-foreground">Deep integration where SEA users already communicate</p>
          </Card>
        </div>
      </div>
    </Slide>,

    // Slide 9: Roadmap
    <Slide key="roadmap" className="bg-background">
      <div className="max-w-5xl w-full">
        <h2 className="text-4xl md:text-5xl font-bold text-center mb-4">Roadmap</h2>
        <p className="text-xl text-muted-foreground text-center mb-12">
          From Thailand to Regional Networking OS
        </p>

        <div className="relative">
          <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-border hidden md:block" />
          
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row gap-4 md:gap-8">
              <div className="md:w-1/2 md:text-right">
                <Card className="p-6 inline-block overflow-visible">
                  <Badge className="mb-3">Phase 1: Now - Q2 2025</Badge>
                  <h3 className="font-semibold text-lg mb-2">Product-Market Fit</h3>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>5 pilot chapters in Thailand</li>
                    <li>Core feature hardening</li>
                    <li>Prove attendance & conversion uplift</li>
                  </ul>
                </Card>
              </div>
              <div className="hidden md:flex items-center justify-center">
                <div className="w-4 h-4 rounded-full bg-primary z-10" />
              </div>
              <div className="md:w-1/2" />
            </div>

            <div className="flex flex-col md:flex-row gap-4 md:gap-8">
              <div className="md:w-1/2" />
              <div className="hidden md:flex items-center justify-center">
                <div className="w-4 h-4 rounded-full bg-muted-foreground z-10" />
              </div>
              <div className="md:w-1/2">
                <Card className="p-6 inline-block overflow-visible">
                  <Badge variant="secondary" className="mb-3">Phase 2: Q3-Q4 2025</Badge>
                  <h3 className="font-semibold text-lg mb-2">SEA Expansion</h3>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>Singapore, Malaysia, Vietnam</li>
                    <li>Multi-language AI assistant</li>
                    <li>WhatsApp integration</li>
                  </ul>
                </Card>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 md:gap-8">
              <div className="md:w-1/2 md:text-right">
                <Card className="p-6 inline-block overflow-visible">
                  <Badge variant="outline" className="mb-3">Phase 3: 2026</Badge>
                  <h3 className="font-semibold text-lg mb-2">Adjacent Markets</h3>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>Trade associations, chambers of commerce</li>
                    <li>Coworking communities</li>
                    <li>Accelerator alumni networks</li>
                  </ul>
                </Card>
              </div>
              <div className="hidden md:flex items-center justify-center">
                <div className="w-4 h-4 rounded-full bg-muted-foreground z-10" />
              </div>
              <div className="md:w-1/2" />
            </div>

            <div className="flex flex-col md:flex-row gap-4 md:gap-8">
              <div className="md:w-1/2" />
              <div className="hidden md:flex items-center justify-center">
                <div className="w-4 h-4 rounded-full bg-muted-foreground z-10" />
              </div>
              <div className="md:w-1/2">
                <Card className="p-6 inline-block overflow-visible">
                  <Badge variant="outline" className="mb-3">Phase 4: 2027+</Badge>
                  <h3 className="font-semibold text-lg mb-2">Platform Play</h3>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>Open API ecosystem</li>
                    <li>Mini-apps marketplace</li>
                    <li>Cross-chapter networking</li>
                  </ul>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Slide>,

    // Slide 10: Team
    <Slide key="team" className="bg-background">
      <div className="max-w-4xl w-full">
        <h2 className="text-4xl md:text-5xl font-bold text-center mb-4">Team</h2>
        <p className="text-xl text-muted-foreground text-center mb-12">
          Domain experts + technical execution
        </p>

        <div className="grid md:grid-cols-2 gap-8 mb-12">
          <Card className="p-8 text-center overflow-visible">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 mx-auto mb-4 flex items-center justify-center">
              <Users className="w-12 h-12 text-white" />
            </div>
            <h3 className="font-semibold text-xl mb-1">Founder / CEO</h3>
            <p className="text-muted-foreground mb-4">Your Name</p>
            <ul className="text-sm text-muted-foreground space-y-1 text-left">
              <li>10+ years in business networking</li>
              <li>Former BNI chapter director</li>
              <li>Deep understanding of chapter operations</li>
            </ul>
          </Card>

          <Card className="p-8 text-center overflow-visible">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-green-400 to-green-600 mx-auto mb-4 flex items-center justify-center">
              <Zap className="w-12 h-12 text-white" />
            </div>
            <h3 className="font-semibold text-xl mb-1">CTO</h3>
            <p className="text-muted-foreground mb-4">Technical Lead</p>
            <ul className="text-sm text-muted-foreground space-y-1 text-left">
              <li>Full-stack development expertise</li>
              <li>AI/ML integration experience</li>
              <li>Scaled SaaS products before</li>
            </ul>
          </Card>
        </div>

        <Card className="p-6 bg-muted/30 overflow-visible">
          <h3 className="font-semibold text-center mb-4">Advisory Network</h3>
          <div className="grid grid-cols-3 gap-4 text-center text-sm">
            <div>
              <div className="font-medium">BNI Regional Director</div>
              <div className="text-muted-foreground">Domain Expert</div>
            </div>
            <div>
              <div className="font-medium">SaaS Founder</div>
              <div className="text-muted-foreground">Growth Strategy</div>
            </div>
            <div>
              <div className="font-medium">VC Partner</div>
              <div className="text-muted-foreground">Fundraising</div>
            </div>
          </div>
        </Card>
      </div>
    </Slide>,

    // Slide 11: Financials
    <Slide key="financials" className="bg-background">
      <div className="max-w-5xl w-full">
        <h2 className="text-4xl md:text-5xl font-bold text-center mb-4">Financial Projections</h2>
        <p className="text-xl text-muted-foreground text-center mb-12">
          Path to profitability in 18 months
        </p>

        <div className="overflow-x-auto mb-8">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left p-3">Metric</th>
                <th className="text-right p-3">Year 1</th>
                <th className="text-right p-3">Year 2</th>
                <th className="text-right p-3">Year 3</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="p-3 font-medium">Chapters</td>
                <td className="text-right p-3">15</td>
                <td className="text-right p-3">50</td>
                <td className="text-right p-3">150</td>
              </tr>
              <tr className="border-b">
                <td className="p-3 font-medium">ARR</td>
                <td className="text-right p-3">$54K</td>
                <td className="text-right p-3">$200K</td>
                <td className="text-right p-3">$600K</td>
              </tr>
              <tr className="border-b">
                <td className="p-3 font-medium">MRR</td>
                <td className="text-right p-3">$4.5K</td>
                <td className="text-right p-3">$17K</td>
                <td className="text-right p-3">$50K</td>
              </tr>
              <tr className="border-b">
                <td className="p-3 font-medium">Gross Margin</td>
                <td className="text-right p-3">75%</td>
                <td className="text-right p-3">80%</td>
                <td className="text-right p-3">85%</td>
              </tr>
              <tr>
                <td className="p-3 font-medium">Team Size</td>
                <td className="text-right p-3">2</td>
                <td className="text-right p-3">5</td>
                <td className="text-right p-3">12</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <Card className="p-6 overflow-visible">
            <h4 className="font-semibold mb-3">Revenue Mix</h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subscriptions</span>
                <span>85%</span>
              </div>
              <Progress value={85} className="h-2" />
              <div className="flex justify-between text-sm">
                <span>Implementation</span>
                <span>10%</span>
              </div>
              <Progress value={10} className="h-2" />
              <div className="flex justify-between text-sm">
                <span>AI Credits</span>
                <span>5%</span>
              </div>
              <Progress value={5} className="h-2" />
            </div>
          </Card>

          <Card className="p-6 overflow-visible">
            <h4 className="font-semibold mb-3">Key Assumptions</h4>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li>Avg. revenue/chapter: $300/mo</li>
              <li>Monthly churn: 2%</li>
              <li>CAC: $1,500</li>
              <li>LTV: $10,800</li>
              <li>LTV:CAC = 7.2x</li>
            </ul>
          </Card>

          <Card className="p-6 overflow-visible">
            <h4 className="font-semibold mb-3">Milestones</h4>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li>Month 6: 10 chapters, break-even ops</li>
              <li>Month 12: 25 chapters, positive CF</li>
              <li>Month 18: 50 chapters, profitable</li>
              <li>Month 24: Series A ready</li>
            </ul>
          </Card>
        </div>
      </div>
    </Slide>,

    // Slide 12: The Ask
    <Slide key="ask" className="bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 text-white">
      <div className="max-w-4xl w-full text-center">
        <h2 className="text-4xl md:text-5xl font-bold mb-4">The Ask</h2>
        <p className="text-xl text-blue-200 mb-12">
          Seed round to accelerate growth
        </p>

        <Card className="p-8 bg-white/10 border-white/20 text-white mb-12 overflow-visible">
          <div className="text-5xl font-bold mb-2">$500K</div>
          <div className="text-blue-200 mb-6">Seed Round</div>
          
          <div className="grid md:grid-cols-3 gap-6 text-left">
            <div>
              <div className="text-2xl font-bold mb-1">40%</div>
              <div className="text-sm text-blue-200">Product Development</div>
              <p className="text-xs text-blue-300 mt-1">AI enhancements, mobile app, new integrations</p>
            </div>
            <div>
              <div className="text-2xl font-bold mb-1">35%</div>
              <div className="text-sm text-blue-200">Sales & Marketing</div>
              <p className="text-xs text-blue-300 mt-1">Chapter acquisition, brand building, content</p>
            </div>
            <div>
              <div className="text-2xl font-bold mb-1">25%</div>
              <div className="text-sm text-blue-200">Operations</div>
              <p className="text-xs text-blue-300 mt-1">Team expansion, infrastructure, support</p>
            </div>
          </div>
        </Card>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div>
            <Target className="w-10 h-10 mx-auto mb-3 text-blue-300" />
            <div className="font-semibold">18-Month Goal</div>
            <div className="text-blue-200 text-sm">50 chapters, $200K ARR</div>
          </div>
          <div>
            <TrendingUp className="w-10 h-10 mx-auto mb-3 text-blue-300" />
            <div className="font-semibold">Use of Funds</div>
            <div className="text-blue-200 text-sm">18-month runway</div>
          </div>
          <div>
            <Rocket className="w-10 h-10 mx-auto mb-3 text-blue-300" />
            <div className="font-semibold">Next Milestone</div>
            <div className="text-blue-200 text-sm">Series A ready</div>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-4">
          <Button size="lg" variant="secondary" className="text-foreground">
            Schedule Meeting
          </Button>
          <Button size="lg" variant="outline" className="border-white/50 text-white bg-white/10">
            View Demo
          </Button>
        </div>
      </div>
    </Slide>,
  ];

  return (
    <div className="h-screen w-screen bg-background flex flex-col overflow-hidden">
      {/* Navigation Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-background/95 backdrop-blur z-50">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium">
            {currentSlide + 1} / {totalSlides}
          </span>
          <Progress value={((currentSlide + 1) / totalSlides) * 100} className="w-32 h-2" />
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={prevSlide}
            disabled={currentSlide === 0}
            data-testid="button-prev-slide"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={nextSlide}
            disabled={currentSlide === totalSlides - 1}
            data-testid="button-next-slide"
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleFullscreen}
            data-testid="button-fullscreen"
          >
            {isFullscreen ? (
              <Minimize2 className="w-5 h-5" />
            ) : (
              <Maximize2 className="w-5 h-5" />
            )}
          </Button>
        </div>
      </div>

      {/* Slide Content */}
      <div className="flex-1 overflow-hidden">
        {slides[currentSlide]}
      </div>

      {/* Keyboard Hints */}
      <div className="px-4 py-2 border-t bg-muted/50 text-center text-xs text-muted-foreground">
        Press <kbd className="px-1.5 py-0.5 bg-muted rounded border">←</kbd> <kbd className="px-1.5 py-0.5 bg-muted rounded border">→</kbd> to navigate
        {" | "}
        <kbd className="px-1.5 py-0.5 bg-muted rounded border">F</kbd> for fullscreen
        {" | "}
        <kbd className="px-1.5 py-0.5 bg-muted rounded border">Space</kbd> for next
      </div>
    </div>
  );
}
