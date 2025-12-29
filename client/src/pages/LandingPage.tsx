import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  Users, 
  Clock, 
  TrendingUp, 
  QrCode, 
  MessageSquare, 
  Bot, 
  CheckCircle2, 
  ArrowRight, 
  Calendar, 
  BarChart3, 
  Shield, 
  Zap, 
  Globe, 
  ChevronRight,
  Star,
  Play,
  Mail,
  Phone,
  Building2,
  Sparkles,
  Target,
  LineChart,
  ClipboardCheck,
  Loader2,
  Send
} from "lucide-react";
import { SiLine } from "react-icons/si";

export default function LandingPage() {
  const { toast } = useToast();
  const [chapterSize, setChapterSize] = useState(40);
  const [currentScreenshot, setCurrentScreenshot] = useState(0);
  const [demoDialogOpen, setDemoDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [demoForm, setDemoForm] = useState({
    name: "",
    email: "",
    phone: "",
    chapterName: "",
    memberCount: "",
    message: ""
  });

  const screenshots = [
    { 
      title: "Meeting Command Center", 
      desc: "QR Check-in และ Dashboard แบบ Real-time",
      features: ["QR Code Check-in", "Real-time Attendance", "Visitor Management", "Export Reports"]
    },
    { 
      title: "LINE Integration", 
      desc: "แจ้งเตือนและ RSVP ผ่าน LINE",
      features: ["Meeting Notifications", "RSVP Buttons", "Digital Business Cards", "Member Self-service"]
    },
    { 
      title: "Performance Dashboard", 
      desc: "วิเคราะห์ผลการดำเนินงาน Chapter",
      features: ["Attendance Rate Trends", "Visitor Conversion", "Member Growth", "Period Comparisons"]
    },
    { 
      title: "AI Chapter Assistant", 
      desc: "ถามข้อมูลภาษาไทย ได้คำตอบทันที",
      features: ["Thai Language Support", "Text-to-SQL Queries", "Instant Reports", "LINE Bot Integration"]
    }
  ];

  const hoursPerWeekSaved = Math.round(chapterSize * 0.15);
  const yearlySavings = hoursPerWeekSaved * 52 * 500;

  const handleDemoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    toast({
      title: "ส่งคำขอสำเร็จ",
      description: "ทีมงานจะติดต่อกลับภายใน 24 ชั่วโมง",
    });
    
    setDemoForm({ name: "", email: "", phone: "", chapterName: "", memberCount: "", message: "" });
    setDemoDialogOpen(false);
    setIsSubmitting(false);
  };

  const DemoFormDialog = ({ trigger }: { trigger: React.ReactNode }) => (
    <Dialog open={demoDialogOpen} onOpenChange={setDemoDialogOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            จองเดโมฟรี
          </DialogTitle>
          <DialogDescription>
            กรอกข้อมูลเพื่อนัดหมาย Demo กับทีมงาน เราจะติดต่อกลับภายใน 24 ชม.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleDemoSubmit} className="space-y-4">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="demo-name">ชื่อ-นามสกุล *</Label>
              <Input
                id="demo-name"
                placeholder="คุณสมชาย ใจดี"
                value={demoForm.name}
                onChange={(e) => setDemoForm({ ...demoForm, name: e.target.value })}
                required
                data-testid="input-demo-name"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="demo-email">อีเมล *</Label>
                <Input
                  id="demo-email"
                  type="email"
                  placeholder="email@example.com"
                  value={demoForm.email}
                  onChange={(e) => setDemoForm({ ...demoForm, email: e.target.value })}
                  required
                  data-testid="input-demo-email"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="demo-phone">เบอร์โทร *</Label>
                <Input
                  id="demo-phone"
                  type="tel"
                  placeholder="081-234-5678"
                  value={demoForm.phone}
                  onChange={(e) => setDemoForm({ ...demoForm, phone: e.target.value })}
                  required
                  data-testid="input-demo-phone"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="demo-chapter">ชื่อ Chapter</Label>
                <Input
                  id="demo-chapter"
                  placeholder="Chapter ABC"
                  value={demoForm.chapterName}
                  onChange={(e) => setDemoForm({ ...demoForm, chapterName: e.target.value })}
                  data-testid="input-demo-chapter"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="demo-members">จำนวนสมาชิก</Label>
                <Input
                  id="demo-members"
                  type="number"
                  placeholder="40"
                  value={demoForm.memberCount}
                  onChange={(e) => setDemoForm({ ...demoForm, memberCount: e.target.value })}
                  data-testid="input-demo-members"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="demo-message">ข้อความเพิ่มเติม</Label>
              <Textarea
                id="demo-message"
                placeholder="มีคำถามหรือความต้องการพิเศษอะไรบ้าง?"
                value={demoForm.message}
                onChange={(e) => setDemoForm({ ...demoForm, message: e.target.value })}
                rows={3}
                data-testid="input-demo-message"
              />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting} data-testid="button-submit-demo">
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                กำลังส่ง...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                ส่งคำขอ Demo
              </>
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
                <Users className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-bold text-xl">Meetdup</span>
            </div>
            <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
              <a href="#features" className="hover:text-foreground transition-colors" data-testid="link-features">Features</a>
              <a href="/pricing" className="hover:text-foreground transition-colors" data-testid="link-pricing">Pricing</a>
              <a href="#faq" className="hover:text-foreground transition-colors" data-testid="link-faq">FAQ</a>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" asChild data-testid="button-login">
                <a href="/login">เข้าสู่ระบบ</a>
              </Button>
              <DemoFormDialog
                trigger={
                  <Button size="sm" data-testid="button-demo-nav">
                    <Calendar className="w-4 h-4 mr-2" />
                    จองเดโม
                  </Button>
                }
              />
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-accent/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
          <div className="text-center max-w-4xl mx-auto">
            <Badge className="mb-4" variant="secondary">
              <Sparkles className="w-3 h-3 mr-1" />
              AI-Powered Platform
            </Badge>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
              จัดการ <span className="text-primary">Chapter Meeting</span> ได้ง่ายขึ้น
              <br />ไม่ต้องพึ่ง Excel อีกต่อไป
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              ระบบบริหารจัดการ Chapter แบบครบวงจร ตั้งแต่ Check-in, Attendance Tracking 
              ไปจนถึง AI Assistant ที่ตอบคำถามภาษาไทยได้ทันที
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              <DemoFormDialog
                trigger={
                  <Button size="lg" className="w-full sm:w-auto" data-testid="button-demo-hero">
                    <Calendar className="w-5 h-5 mr-2" />
                    จองเดโมฟรี
                  </Button>
                }
              />
              <Button size="lg" variant="outline" className="w-full sm:w-auto" data-testid="button-trial">
                <Play className="w-5 h-5 mr-2" />
                ทดลองใช้ 14 วัน
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
              <div className="p-4 rounded-lg bg-card border" data-testid="stat-time-saved">
                <div className="text-2xl md:text-3xl font-bold text-primary" data-testid="value-time-saved">70%</div>
                <div className="text-sm text-muted-foreground">ลดเวลา Admin</div>
              </div>
              <div className="p-4 rounded-lg bg-card border" data-testid="stat-attendance">
                <div className="text-2xl md:text-3xl font-bold text-primary" data-testid="value-attendance">25%</div>
                <div className="text-sm text-muted-foreground">เพิ่ม Attendance</div>
              </div>
              <div className="p-4 rounded-lg bg-card border" data-testid="stat-conversion">
                <div className="text-2xl md:text-3xl font-bold text-primary" data-testid="value-conversion">40%</div>
                <div className="text-sm text-muted-foreground">Visitor Conversion</div>
              </div>
              <div className="p-4 rounded-lg bg-card border" data-testid="stat-checkin-time">
                <div className="text-2xl md:text-3xl font-bold text-primary" data-testid="value-checkin-time">5 นาที</div>
                <div className="text-sm text-muted-foreground">Check-in ทั้ง Chapter</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pain Points */}
      <section className="py-16 md:py-24 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">ปัญหาที่ Admin Chapter เจอทุกสัปดาห์</h2>
            <p className="text-lg text-muted-foreground">คุ้นเคยกับสถานการณ์เหล่านี้ไหม?</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="border-destructive/20 bg-destructive/5">
              <CardHeader>
                <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                  <Clock className="w-6 h-6 text-destructive" />
                </div>
                <CardTitle>เสียเวลา 5+ ชม./สัปดาห์</CardTitle>
                <CardDescription>
                  กับการ Track attendance, จัดการ Visitor, 
                  Update ข้อมูลใน Excel แล้วก็ส่ง report ให้ทีม
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-destructive/20 bg-destructive/5">
              <CardHeader>
                <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                  <BarChart3 className="w-6 h-6 text-destructive" />
                </div>
                <CardTitle>ไม่มี Data ดูภาพรวม</CardTitle>
                <CardDescription>
                  Attendance Rate เป็นยังไง? Visitor กี่คนกลับมา? 
                  Member ใหม่มาจากไหน? ตอบไม่ได้ทันที
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-destructive/20 bg-destructive/5">
              <CardHeader>
                <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                  <TrendingUp className="w-6 h-6 text-destructive" />
                </div>
                <CardTitle>Visitor หายไป ไม่ Convert</CardTitle>
                <CardDescription>
                  Visitor มาแล้วก็หายไป ไม่มีระบบ Follow-up 
                  ไม่รู้ว่าใครสนใจจริง ใครแค่มาดู
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Solution - 3 Pillars */}
      <section id="features" className="py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <Badge className="mb-4" variant="outline">Solution</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Meetdup แก้ปัญหาเหล่านี้ได้อย่างไร</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              3 เครื่องมือหลักที่ช่วยให้ Chapter ของคุณทำงานได้อย่างมีประสิทธิภาพ
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16" />
              <CardHeader>
                <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <QrCode className="w-7 h-7 text-primary" />
                </div>
                <CardTitle className="text-xl">Meeting Command Center</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                    <span>QR Code Check-in แบบ Real-time</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                    <span>Attendance Dashboard สด</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                    <span>Visitor Registration ออนไลน์</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                    <span>Export Report อัตโนมัติ</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden border-primary">
              <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 rounded-full -mr-16 -mt-16" />
              <CardHeader>
                <div className="w-14 h-14 rounded-lg bg-green-500/10 flex items-center justify-center mb-4">
                  <SiLine className="w-7 h-7 text-green-500" />
                </div>
                <CardTitle className="text-xl">LINE Integration</CardTitle>
                <Badge variant="secondary" className="w-fit">ยอดนิยม</Badge>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                    <span>แจ้งเตือน Meeting ผ่าน LINE</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                    <span>RSVP ตอบรับ/ลา ได้ทันที</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                    <span>Member Self-service Portal</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                    <span>Digital Business Card Sharing</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full -mr-16 -mt-16" />
              <CardHeader>
                <div className="w-14 h-14 rounded-lg bg-purple-500/10 flex items-center justify-center mb-4">
                  <Bot className="w-7 h-7 text-purple-500" />
                </div>
                <CardTitle className="text-xl">AI Chapter Assistant</CardTitle>
                <Badge variant="secondary" className="w-fit">AI Powered</Badge>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-purple-500 mt-0.5 shrink-0" />
                    <span>ถามข้อมูลภาษาไทยได้เลย</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-purple-500 mt-0.5 shrink-0" />
                    <span>สรุป Report อัตโนมัติ</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-purple-500 mt-0.5 shrink-0" />
                    <span>วิเคราะห์ Trend & Insights</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-purple-500 mt-0.5 shrink-0" />
                    <span>ตอบทันทีผ่าน LINE Bot</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Product Features Showcase */}
      <section className="py-16 md:py-24 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">ดู Meetdup ใช้งานจริง</h2>
            <p className="text-lg text-muted-foreground">Interface ที่ออกแบบมาสำหรับ Chapter Admin โดยเฉพาะ</p>
          </div>

          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-2 gap-6">
              {screenshots.map((item, index) => (
                <Card 
                  key={index} 
                  className={`overflow-hidden transition-all ${currentScreenshot === index ? 'ring-2 ring-primary' : ''}`}
                  data-testid={`card-feature-${index}`}
                >
                  <div 
                    className={`aspect-video flex items-center justify-center cursor-pointer ${
                      index === 0 ? 'bg-gradient-to-br from-primary/20 to-blue-500/20' :
                      index === 1 ? 'bg-gradient-to-br from-green-500/20 to-emerald-500/20' :
                      index === 2 ? 'bg-gradient-to-br from-blue-500/20 to-indigo-500/20' :
                      'bg-gradient-to-br from-purple-500/20 to-pink-500/20'
                    }`}
                    onClick={() => setCurrentScreenshot(index)}
                  >
                    <div className="text-center p-6">
                      <div className={`w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-4 ${
                        index === 0 ? 'bg-primary/20' :
                        index === 1 ? 'bg-green-500/20' :
                        index === 2 ? 'bg-blue-500/20' :
                        'bg-purple-500/20'
                      }`}>
                        {index === 0 && <QrCode className="w-8 h-8 text-primary" />}
                        {index === 1 && <SiLine className="w-8 h-8 text-green-500" />}
                        {index === 2 && <BarChart3 className="w-8 h-8 text-blue-500" />}
                        {index === 3 && <Bot className="w-8 h-8 text-purple-500" />}
                      </div>
                      <h3 className="text-lg font-semibold mb-1">{item.title}</h3>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-2 gap-2">
                      {item.features.map((feature, fIndex) => (
                        <div key={fIndex} className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className={`w-4 h-4 shrink-0 ${
                            index === 0 ? 'text-primary' :
                            index === 1 ? 'text-green-500' :
                            index === 2 ? 'text-blue-500' :
                            'text-purple-500'
                          }`} />
                          <span className="text-muted-foreground">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ROI Calculator */}
      <section className="py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <Badge className="mb-4" variant="outline">ROI Calculator</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">คำนวณผลตอบแทนที่คุณจะได้รับ</h2>
            <p className="text-lg text-muted-foreground">ใส่ขนาด Chapter ของคุณ แล้วดูว่าจะประหยัดได้เท่าไหร่</p>
          </div>

          <div className="max-w-2xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-primary" />
                  ขนาด Chapter ของคุณ
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>จำนวนสมาชิก</Label>
                    <span className="font-semibold text-primary">{chapterSize} คน</span>
                  </div>
                  <Input
                    type="range"
                    min="10"
                    max="100"
                    value={chapterSize}
                    onChange={(e) => setChapterSize(Number(e.target.value))}
                    className="w-full"
                    data-testid="input-chapter-size"
                  />
                  <div className="flex justify-between text-sm text-muted-foreground mt-1">
                    <span>10 คน</span>
                    <span>100 คน</span>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4 pt-4">
                  <div className="p-4 rounded-lg bg-primary/5 border border-primary/20" data-testid="roi-hours-saved">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <Clock className="w-4 h-4" />
                      ประหยัดเวลาต่อสัปดาห์
                    </div>
                    <div className="text-3xl font-bold text-primary" data-testid="value-hours-saved">{hoursPerWeekSaved} ชม.</div>
                  </div>
                  <div className="p-4 rounded-lg bg-green-500/5 border border-green-500/20" data-testid="roi-yearly-savings">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <TrendingUp className="w-4 h-4" />
                      มูลค่าที่ประหยัดได้/ปี
                    </div>
                    <div className="text-3xl font-bold text-green-600" data-testid="value-yearly-savings">฿{yearlySavings.toLocaleString()}</div>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground text-center">
                  * คำนวณจากค่าเฉลี่ยเวลาที่ประหยัดได้ 0.15 ชม./สมาชิก/สัปดาห์ และอัตราค่าแรง 500 บาท/ชม.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* AI Assistant Highlight */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-purple-500/5 via-background to-primary/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <Badge className="mb-4" variant="outline">
                <Bot className="w-3 h-3 mr-1" />
                AI Chapter Assistant
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                ถามข้อมูล Chapter เป็นภาษาไทย ได้คำตอบทันที
              </h2>
              <p className="text-lg text-muted-foreground mb-6">
                ไม่ต้อง Export Excel มานั่งวิเคราะห์เอง แค่ถามเป็นภาษาไทยผ่าน LINE 
                AI จะ Query ข้อมูลและสรุปให้อัตโนมัติ
              </p>
              
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-card border">
                  <div className="flex items-start gap-3">
                    <MessageSquare className="w-5 h-5 text-primary mt-1" />
                    <div>
                      <div className="font-medium mb-1">"Visitor สัปดาห์นี้มีกี่คน?"</div>
                      <div className="text-sm text-muted-foreground">
                        AI ตอบ: "สัปดาห์นี้มี Visitor ลงทะเบียน 8 คน, Check-in 6 คน (75%)"
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 rounded-lg bg-card border">
                  <div className="flex items-start gap-3">
                    <MessageSquare className="w-5 h-5 text-primary mt-1" />
                    <div>
                      <div className="font-medium mb-1">"Attendance Rate เดือนนี้เป็นยังไง?"</div>
                      <div className="text-sm text-muted-foreground">
                        AI ตอบ: "Attendance Rate เดือนนี้ 87.5% (เพิ่มขึ้น 3.2% จากเดือนก่อน)"
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 rounded-lg bg-card border">
                  <div className="flex items-start gap-3">
                    <MessageSquare className="w-5 h-5 text-primary mt-1" />
                    <div>
                      <div className="font-medium mb-1">"ใครยังไม่จ่ายค่า Visitor Fee?"</div>
                      <div className="text-sm text-muted-foreground">
                        AI ตอบ: "มี 3 คนยังไม่ชำระ: คุณสมชาย, คุณวิภา, คุณธนา รวม ฿900"
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="aspect-square max-w-md mx-auto rounded-2xl bg-gradient-to-br from-purple-500/20 to-primary/20 flex items-center justify-center">
                <div className="text-center p-8">
                  <div className="w-24 h-24 rounded-full bg-background/80 flex items-center justify-center mx-auto mb-6">
                    <Bot className="w-12 h-12 text-purple-500" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Thai AI Assistant</h3>
                  <p className="text-muted-foreground">Text-to-SQL Technology</p>
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <Badge variant="secondary">ภาษาไทย</Badge>
                    <Badge variant="secondary">LINE Bot</Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section className="py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">เชื่อมต่อกับเครื่องมือที่คุณใช้อยู่</h2>
            <p className="text-lg text-muted-foreground">Meetdup ทำงานร่วมกับ Tools ที่คุณคุ้นเคย</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
            <Card className="p-6 text-center hover-elevate">
              <SiLine className="w-10 h-10 text-green-500 mx-auto mb-3" />
              <div className="font-medium">LINE</div>
              <div className="text-sm text-muted-foreground">Messaging & LIFF</div>
            </Card>
            <Card className="p-6 text-center hover-elevate">
              <Calendar className="w-10 h-10 text-blue-500 mx-auto mb-3" />
              <div className="font-medium">Google Calendar</div>
              <div className="text-sm text-muted-foreground">Sync Events</div>
            </Card>
            <Card className="p-6 text-center hover-elevate">
              <ClipboardCheck className="w-10 h-10 text-green-600 mx-auto mb-3" />
              <div className="font-medium">Excel Export</div>
              <div className="text-sm text-muted-foreground">Reports & Data</div>
            </Card>
            <Card className="p-6 text-center hover-elevate">
              <Globe className="w-10 h-10 text-primary mx-auto mb-3" />
              <div className="font-medium">Web Portal</div>
              <div className="text-sm text-muted-foreground">Admin Dashboard</div>
            </Card>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-16 md:py-24 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Chapter ที่ไว้วางใจใช้ Meetdup</h2>
            <p className="text-lg text-muted-foreground">ฟังจากผู้ใช้จริงว่า Meetdup ช่วยพวกเขาได้อย่างไร</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-muted-foreground mb-4">
                  "ก่อนใช้ Meetdup ต้องนั่ง Track attendance ใน Excel ทุกสัปดาห์ 
                  ตอนนี้แค่เปิด Dashboard ดูก็รู้ทุกอย่างเลย ประหยัดเวลาไปเยอะมาก"
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium">คุณธนพล ว.</div>
                    <div className="text-sm text-muted-foreground">VP Membership, Chapter XYZ</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-muted-foreground mb-4">
                  "AI Assistant เป็น Game changer เลย ถามข้อมูลภาษาไทยได้เลย 
                  ไม่ต้อง Export มาดูใน Excel อีกต่อไป ตอบได้ทันทีผ่าน LINE"
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium">คุณวิภาวี ส.</div>
                    <div className="text-sm text-muted-foreground">Director, Chapter ABC</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-muted-foreground mb-4">
                  "QR Check-in ทำให้การ Check-in ราบรื่นมาก Member 40 คน 
                  Check-in เสร็จใน 5 นาที ไม่ต้องมานั่งเช็คชื่อทีละคน"
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium">คุณประพันธ์ ก.</div>
                    <div className="text-sm text-muted-foreground">VP Operations, Chapter 123</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-8 opacity-60">
            <div className="text-center">
              <Building2 className="w-8 h-8 mx-auto mb-2" />
              <span className="text-sm font-medium">Pilot Chapter 1</span>
            </div>
            <div className="text-center">
              <Building2 className="w-8 h-8 mx-auto mb-2" />
              <span className="text-sm font-medium">Pilot Chapter 2</span>
            </div>
            <div className="text-center">
              <Building2 className="w-8 h-8 mx-auto mb-2" />
              <span className="text-sm font-medium">Pilot Chapter 3</span>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <Badge className="mb-4" variant="outline">Pricing</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">เลือกแพ็คเกจที่เหมาะกับ Chapter ของคุณ</h2>
            <p className="text-lg text-muted-foreground">เริ่มต้นฟรี 14 วัน ไม่ต้องใส่บัตรเครดิต</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <Card data-testid="card-pricing-core">
              <CardHeader>
                <CardTitle>Core</CardTitle>
                <CardDescription>สำหรับ Chapter เดียว</CardDescription>
                <div className="pt-4">
                  <span className="text-4xl font-bold" data-testid="price-core">฿6,900</span>
                  <span className="text-muted-foreground">/เดือน</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                    <span>1 Chapter</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                    <span>สมาชิกไม่จำกัด</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                    <span>Meeting Command Center</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                    <span>LINE Integration</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                    <span>Basic Reports</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                    <span>Email Support</span>
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                <Button className="w-full" variant="outline" data-testid="button-plan-core">
                  เริ่มทดลองใช้
                </Button>
              </CardFooter>
            </Card>

            <Card className="border-primary relative" data-testid="card-pricing-pro">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge>แนะนำ</Badge>
              </div>
              <CardHeader>
                <CardTitle>Pro</CardTitle>
                <CardDescription>สำหรับหลาย Chapters + AI</CardDescription>
                <div className="pt-4">
                  <span className="text-4xl font-bold" data-testid="price-pro">฿11,900</span>
                  <span className="text-muted-foreground">/เดือน</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                    <span>สูงสุด 3 Chapters</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                    <span>ทุกอย่างใน Core</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                    <span className="font-medium">AI Chapter Assistant</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                    <span>Performance Dashboard</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                    <span>Advanced Analytics</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                    <span>Priority Support</span>
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                <Button className="w-full" data-testid="button-plan-pro">
                  เริ่มทดลองใช้
                </Button>
              </CardFooter>
            </Card>

            <Card data-testid="card-pricing-enterprise">
              <CardHeader>
                <CardTitle>Enterprise</CardTitle>
                <CardDescription>สำหรับองค์กรขนาดใหญ่</CardDescription>
                <div className="pt-4">
                  <span className="text-4xl font-bold" data-testid="price-enterprise">Custom</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                    <span>Chapters ไม่จำกัด</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                    <span>ทุกอย่างใน Pro</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                    <span>Custom Integrations</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                    <span>Dedicated Support</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                    <span>SLA Guarantee</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                    <span>On-site Training</span>
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                <Button className="w-full" variant="outline" data-testid="button-plan-enterprise">
                  ติดต่อเรา
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-16 md:py-24 bg-muted/30">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">คำถามที่พบบ่อย</h2>
          </div>

          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger data-testid="accordion-security">ข้อมูล Chapter ปลอดภัยไหม?</AccordionTrigger>
              <AccordionContent>
                ข้อมูลทั้งหมดเก็บบน Supabase ซึ่งเป็น Cloud Database ที่มีมาตรฐานความปลอดภัยระดับสูง 
                มีการเข้ารหัสข้อมูลทั้ง At-rest และ In-transit รวมถึง Row Level Security 
                ที่แยก Chapter แต่ละ Chapter ออกจากกันอย่างสมบูรณ์
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2">
              <AccordionTrigger data-testid="accordion-line">ต้องใช้ LINE เท่านั้นไหม?</AccordionTrigger>
              <AccordionContent>
                ไม่จำเป็นครับ Meetdup มี Web Portal ที่สามารถเข้าใช้งานผ่าน Browser ได้เลย 
                แต่ถ้าใช้ร่วมกับ LINE จะได้ประโยชน์เพิ่มเติมจากการแจ้งเตือน, RSVP, 
                และ AI Assistant ผ่าน LINE Bot
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3">
              <AccordionTrigger data-testid="accordion-migration">Migrate ข้อมูลเก่าจาก Excel ได้ไหม?</AccordionTrigger>
              <AccordionContent>
                ได้ครับ! เรามีระบบ Bulk Import ที่รองรับการ Import สมาชิกจาก Excel 
                โดยตรง พร้อมทีม Support ช่วย Verify ข้อมูลก่อน Import 
                ให้มั่นใจว่าข้อมูลถูกต้องครบถ้วน
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4">
              <AccordionTrigger data-testid="accordion-roi">ROI คุ้มค่าเมื่อไหร่?</AccordionTrigger>
              <AccordionContent>
                จากข้อมูล Pilot Chapters พบว่า Admin ประหยัดเวลาได้ประมาณ 5+ ชั่วโมง/สัปดาห์ 
                ถ้าคิดเป็นค่าแรงประมาณ 500 บาท/ชม. จะประหยัดได้ประมาณ 10,000+ บาท/เดือน 
                ซึ่งมากกว่าค่าบริการ Core Plan ดังนั้น ROI เป็นบวกตั้งแต่เดือนแรก
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-5">
              <AccordionTrigger data-testid="accordion-training">ต้องฝึกอบรมนานไหม?</AccordionTrigger>
              <AccordionContent>
                ไม่นานครับ! Interface ออกแบบมาให้ใช้งานง่าย Admin ส่วนใหญ่เริ่มใช้งานได้ภายใน 30 นาที 
                พร้อมทั้งมี Video Tutorial และ Thai Support Team คอยช่วยเหลือ
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-6">
              <AccordionTrigger data-testid="accordion-cancel">ยกเลิกได้ไหม ถ้าไม่พอใจ?</AccordionTrigger>
              <AccordionContent>
                ได้ครับ! สามารถยกเลิกได้ทุกเมื่อ ไม่มีสัญญาผูกมัดระยะยาว 
                และเรายังมี Money-back Guarantee 30 วันแรก ถ้าไม่พอใจคืนเงินเต็มจำนวน
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-primary/10 via-background to-accent/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            พร้อมเปลี่ยน Chapter ของคุณให้ดีขึ้นไหม?
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            เริ่มต้นฟรี 14 วัน ไม่ต้องใส่บัตรเครดิต ทีม Support พร้อมช่วยเหลือตลอด
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <DemoFormDialog
              trigger={
                <Button size="lg" className="w-full sm:w-auto" data-testid="button-demo-footer">
                  <Calendar className="w-5 h-5 mr-2" />
                  จองเดโมฟรี
                </Button>
              }
            />
            <Button size="lg" variant="outline" className="w-full sm:w-auto" data-testid="button-trial-footer">
              เริ่มทดลองใช้ทันที
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-muted-foreground">
            <a href="mailto:hello@meetdup.io" className="flex items-center gap-2 hover:text-foreground transition-colors" data-testid="link-email">
              <Mail className="w-4 h-4" />
              hello@meetdup.io
            </a>
            <a href="tel:+66812345678" className="flex items-center gap-2 hover:text-foreground transition-colors" data-testid="link-phone">
              <Phone className="w-4 h-4" />
              081-234-5678
            </a>
            <a href="#" className="flex items-center gap-2 hover:text-foreground transition-colors" data-testid="link-line-oa">
              <SiLine className="w-4 h-4" />
              @meetdup
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
                <Users className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-semibold">Meetdup</span>
            </div>
            <p className="text-sm text-muted-foreground">
              2024 Meetdup. All rights reserved.
            </p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors" data-testid="link-privacy">Privacy Policy</a>
              <a href="#" className="hover:text-foreground transition-colors" data-testid="link-terms">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
