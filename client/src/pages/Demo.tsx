import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { 
  Users, 
  Calendar, 
  TrendingUp, 
  Clock, 
  UserPlus,
  CheckCircle,
  XCircle,
  AlertCircle,
  Send,
  Sparkles,
  ArrowRight,
  Search,
  BarChart3,
  Bot,
  Home
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  demoChapter,
  demoMembers,
  demoVisitors,
  demoMeetings,
  demoStats,
  demoAIResponses,
} from "@/data/demoData";

const Demo = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [isAiTyping, setIsAiTyping] = useState(false);

  const filteredMembers = demoMembers.filter(
    (member) =>
      member.fullNameTh.includes(searchQuery) ||
      member.fullNameEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.businessCategory.includes(searchQuery)
  );

  const handleAiQuestion = () => {
    if (!aiQuestion.trim()) return;
    
    setIsAiTyping(true);
    setAiResponse("");
    
    setTimeout(() => {
      const matchedKey = Object.keys(demoAIResponses).find(
        (key) => aiQuestion.includes(key)
      );
      const response = matchedKey 
        ? demoAIResponses[matchedKey] 
        : demoAIResponses["default"];
      
      setAiResponse(response);
      setIsAiTyping(false);
    }, 1500);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "on_time":
        return <Badge variant="default" className="bg-green-600">ตรงเวลา</Badge>;
      case "late":
        return <Badge variant="default" className="bg-yellow-600">สาย</Badge>;
      case "absent":
        return <Badge variant="default" className="bg-red-600">ขาด</Badge>;
      case "substitute":
        return <Badge variant="default" className="bg-blue-600">ตัวแทน</Badge>;
      case "checked_in":
        return <Badge variant="default" className="bg-green-600">เข้าร่วมแล้ว</Badge>;
      case "registered":
        return <Badge variant="secondary">ลงทะเบียนแล้ว</Badge>;
      case "no_show":
        return <Badge variant="destructive">ไม่มา</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-50 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon"
              className="text-primary-foreground hover:bg-primary-foreground/20"
              onClick={() => navigate("/")}
              data-testid="button-home"
            >
              <Home className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              <span className="text-sm font-medium">
                Demo Mode - ลองเล่นระบบ Meetdup ได้เลย!
              </span>
            </div>
          </div>
          <Button 
            variant="secondary" 
            size="sm"
            onClick={() => navigate("/auth")}
            data-testid="button-demo-signup"
          >
            สร้าง Chapter ของคุณ
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-chapter-name">
              {demoChapter.nameTh}
            </h1>
            <p className="text-muted-foreground">{demoChapter.region}</p>
          </div>
          <Badge variant="outline" className="text-sm">
            Demo Mode
          </Badge>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-4 w-full max-w-lg">
            <TabsTrigger value="dashboard" data-testid="tab-dashboard">
              <BarChart3 className="w-4 h-4 mr-2" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="members" data-testid="tab-members">
              <Users className="w-4 h-4 mr-2" />
              สมาชิก
            </TabsTrigger>
            <TabsTrigger value="meetings" data-testid="tab-meetings">
              <Calendar className="w-4 h-4 mr-2" />
              ประชุม
            </TabsTrigger>
            <TabsTrigger value="ai" data-testid="tab-ai">
              <Bot className="w-4 h-4 mr-2" />
              AI
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card data-testid="card-stat-members">
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">สมาชิกทั้งหมด</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{demoStats.totalMembers}</div>
                  <p className="text-xs text-muted-foreground">
                    Active {demoStats.activeMembers} คน
                  </p>
                </CardContent>
              </Card>

              <Card data-testid="card-stat-ontime">
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">On-time Rate</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{demoStats.onTimeRate}%</div>
                  <p className="text-xs text-muted-foreground">
                    เฉลี่ย {demoStats.totalMeetings} การประชุม
                  </p>
                </CardContent>
              </Card>

              <Card data-testid="card-stat-visitors">
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Visitors เดือนนี้</CardTitle>
                  <UserPlus className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{demoStats.totalVisitorsThisMonth}</div>
                  <p className="text-xs text-muted-foreground">
                    Check-in {demoStats.totalVisitorsCheckedIn} คน
                  </p>
                </CardContent>
              </Card>

              <Card data-testid="card-stat-conversion">
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary">{demoStats.visitorConversion}%</div>
                  <p className="text-xs text-muted-foreground">
                    Visitor → Member
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">การประชุมล่าสุด</CardTitle>
                </CardHeader>
                <CardContent>
                  {demoMeetings.slice(0, 3).map((meeting) => (
                    <div
                      key={meeting.id}
                      className="flex items-center justify-between gap-4 py-3 border-b last:border-0"
                    >
                      <div>
                        <p className="font-medium">{meeting.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {meeting.date} | {meeting.startTime}
                        </p>
                      </div>
                      <Badge
                        variant={meeting.status === "completed" ? "secondary" : "default"}
                      >
                        {meeting.status === "completed" ? "เสร็จสิ้น" : "กำลังจะมา"}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Visitors ล่าสุด</CardTitle>
                </CardHeader>
                <CardContent>
                  {demoVisitors.slice(0, 4).map((visitor) => (
                    <div
                      key={visitor.id}
                      className="flex items-center justify-between gap-4 py-3 border-b last:border-0"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>{visitor.fullNameTh.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">{visitor.fullNameTh}</p>
                          <p className="text-xs text-muted-foreground">{visitor.company}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {visitor.feePaid ? (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-yellow-600" />
                        )}
                        {getStatusBadge(visitor.status)}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="members" className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="ค้นหาสมาชิก..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-member"
                />
              </div>
              <Badge variant="secondary">{filteredMembers.length} คน</Badge>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredMembers.map((member) => (
                <Card key={member.id} className="hover-elevate cursor-pointer" data-testid={`card-member-${member.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {member.nicknameTh}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{member.fullNameTh}</p>
                        <p className="text-sm text-muted-foreground truncate">{member.fullNameEn}</p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <Badge variant="outline" className="text-xs">
                            {member.businessCategory}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {member.status === "active" ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2 truncate">
                          {member.company}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="meetings" className="space-y-4">
            <div className="space-y-4">
              {demoMeetings.map((meeting) => (
                <Card key={meeting.id} data-testid={`card-meeting-${meeting.id}`}>
                  <CardHeader>
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div>
                        <CardTitle className="text-lg">{meeting.title}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {meeting.date} | {meeting.startTime} - {meeting.endTime}
                        </p>
                        <p className="text-sm text-muted-foreground">{meeting.location}</p>
                      </div>
                      <Badge
                        variant={meeting.status === "completed" ? "secondary" : "default"}
                      >
                        {meeting.status === "completed" ? "เสร็จสิ้น" : "กำลังจะมา"}
                      </Badge>
                    </div>
                  </CardHeader>
                  {meeting.status === "completed" && (
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-3 bg-green-50 dark:bg-green-950 rounded-md">
                          <CheckCircle className="w-5 h-5 text-green-600 mx-auto mb-1" />
                          <p className="text-lg font-bold text-green-600">{meeting.stats.onTime}</p>
                          <p className="text-xs text-muted-foreground">ตรงเวลา</p>
                        </div>
                        <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-950 rounded-md">
                          <Clock className="w-5 h-5 text-yellow-600 mx-auto mb-1" />
                          <p className="text-lg font-bold text-yellow-600">{meeting.stats.late}</p>
                          <p className="text-xs text-muted-foreground">สาย</p>
                        </div>
                        <div className="text-center p-3 bg-red-50 dark:bg-red-950 rounded-md">
                          <XCircle className="w-5 h-5 text-red-600 mx-auto mb-1" />
                          <p className="text-lg font-bold text-red-600">{meeting.stats.absent}</p>
                          <p className="text-xs text-muted-foreground">ขาด</p>
                        </div>
                        <div className="text-center p-3 bg-blue-50 dark:bg-blue-950 rounded-md">
                          <UserPlus className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                          <p className="text-lg font-bold text-blue-600">{meeting.stats.visitorsCheckedIn}/{meeting.stats.visitors}</p>
                          <p className="text-xs text-muted-foreground">Visitors</p>
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="ai" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-primary" />
                  AI Chapter Assistant
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  ถามคำถามเกี่ยวกับ Chapter ของคุณเป็นภาษาไทยได้เลย
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2 flex-wrap">
                  <Badge 
                    variant="outline" 
                    className="cursor-pointer hover-elevate"
                    onClick={() => setAiQuestion("มีใครมาสายบ้าง")}
                  >
                    มีใครมาสายบ้าง
                  </Badge>
                  <Badge 
                    variant="outline" 
                    className="cursor-pointer hover-elevate"
                    onClick={() => setAiQuestion("สรุป visitor เดือนนี้")}
                  >
                    สรุป visitor เดือนนี้
                  </Badge>
                  <Badge 
                    variant="outline" 
                    className="cursor-pointer hover-elevate"
                    onClick={() => setAiQuestion("ใครไม่จ่ายค่า visitor")}
                  >
                    ใครไม่จ่ายค่า visitor
                  </Badge>
                  <Badge 
                    variant="outline" 
                    className="cursor-pointer hover-elevate"
                    onClick={() => setAiQuestion("สถิติการประชุม")}
                  >
                    สถิติการประชุม
                  </Badge>
                </div>

                <div className="flex gap-2">
                  <Input
                    placeholder="พิมพ์คำถามของคุณ..."
                    value={aiQuestion}
                    onChange={(e) => setAiQuestion(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAiQuestion()}
                    data-testid="input-ai-question"
                  />
                  <Button 
                    onClick={handleAiQuestion}
                    disabled={isAiTyping || !aiQuestion.trim()}
                    data-testid="button-ai-send"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>

                {(isAiTyping || aiResponse) && (
                  <ScrollArea className="h-64 rounded-md border p-4">
                    {isAiTyping ? (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <div className="animate-pulse">กำลังประมวลผล...</div>
                      </div>
                    ) : (
                      <pre className="whitespace-pre-wrap text-sm font-sans" data-testid="text-ai-response">
                        {aiResponse}
                      </pre>
                    )}
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4">
        <div className="container mx-auto flex items-center justify-between gap-4 flex-wrap">
          <p className="text-sm text-muted-foreground">
            ชอบระบบไหม? สร้าง Chapter ของคุณได้เลย - ทดลองใช้ฟรี 14 วัน
          </p>
          <Button onClick={() => navigate("/auth")} data-testid="button-demo-cta-bottom">
            เริ่มต้นใช้งาน
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Demo;
