import { useQuery } from "@tanstack/react-query";
import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useTenantContext } from "@/contexts/TenantContext";
import SelectTenantPrompt from "@/components/SelectTenantPrompt";
import { 
  Brain, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle, 
  Users, 
  Target,
  Lightbulb,
  Calendar,
  RefreshCw,
  Sparkles,
  ChevronRight,
  UserMinus,
  Zap
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface ChurnRiskMember {
  participant_id: string;
  full_name_th: string;
  nickname: string;
  risk_score: number;
  risk_level: "high" | "medium" | "low";
  reasons: string[];
  last_attendance: string | null;
  attendance_rate: number;
}

interface GrowthInsight {
  type: "positive" | "warning" | "action";
  title: string;
  description: string;
  metric?: string;
  trend?: "up" | "down" | "stable";
}

interface MeetingPlaybook {
  focus_areas: string[];
  member_highlights: string[];
  visitor_strategy: string;
  action_items: string[];
}

interface EngagementScore {
  overall_score: number;
  attendance_score: number;
  visitor_score: number;
  referral_score: number;
  trend: "improving" | "declining" | "stable";
}

interface GrowthCopilotData {
  churn_risks: ChurnRiskMember[];
  growth_insights: GrowthInsight[];
  meeting_playbook: MeetingPlaybook;
  engagement_score: EngagementScore;
  ai_summary: string;
}

function ScoreGauge({ score, label }: { score: number; label: string }) {
  const getColorClass = (s: number) => {
    if (s >= 80) return "text-green-500";
    if (s >= 60) return "text-yellow-500";
    return "text-red-500";
  };
  
  return (
    <div className="text-center">
      <div className={`text-2xl font-bold ${getColorClass(score)}`}>{score}%</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function InsightCard({ insight }: { insight: GrowthInsight }) {
  const getIcon = () => {
    switch (insight.type) {
      case "positive": return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "warning": return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case "action": return <Lightbulb className="h-5 w-5 text-blue-500" />;
    }
  };
  
  const getTrendIcon = () => {
    if (!insight.trend) return null;
    switch (insight.trend) {
      case "up": return <TrendingUp className="h-4 w-4 text-green-500" />;
      case "down": return <TrendingDown className="h-4 w-4 text-red-500" />;
      default: return null;
    }
  };
  
  const getBgClass = () => {
    switch (insight.type) {
      case "positive": return "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800";
      case "warning": return "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800";
      case "action": return "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800";
    }
  };
  
  return (
    <div className={`p-4 rounded-lg border ${getBgClass()}`}>
      <div className="flex items-start gap-3">
        {getIcon()}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-medium">{insight.title}</h4>
            {getTrendIcon()}
            {insight.metric && (
              <Badge variant="secondary" className="ml-auto">{insight.metric}</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">{insight.description}</p>
        </div>
      </div>
    </div>
  );
}

function ChurnRiskCard({ member }: { member: ChurnRiskMember }) {
  const getRiskBadge = () => {
    switch (member.risk_level) {
      case "high": return <Badge variant="destructive">High Risk</Badge>;
      case "medium": return <Badge className="bg-yellow-500">Medium Risk</Badge>;
      default: return <Badge variant="secondary">Low Risk</Badge>;
    }
  };
  
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
          <UserMinus className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <div className="font-medium">{member.full_name_th || member.nickname}</div>
          <div className="text-sm text-muted-foreground">
            Attendance: {member.attendance_rate.toFixed(0)}%
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {getRiskBadge()}
        <div className="text-sm font-medium">{member.risk_score}%</div>
      </div>
    </div>
  );
}

export default function AIGrowthCopilot() {
  const { effectiveTenantId, isSuperAdmin } = useTenantContext();
  
  const { data, isLoading, error, refetch, isFetching } = useQuery<GrowthCopilotData>({
    queryKey: ["/api/ai/growth-copilot", effectiveTenantId],
    queryFn: async () => {
      const response = await fetch(`/api/ai/growth-copilot/${effectiveTenantId}`);
      if (!response.ok) throw new Error("Failed to fetch growth copilot data");
      return response.json();
    },
    enabled: !!effectiveTenantId,
    staleTime: 5 * 60 * 1000,
  });
  
  if (!effectiveTenantId && isSuperAdmin) {
    return (
      <AdminLayout>
        <SelectTenantPrompt />
      </AdminLayout>
    );
  }
  
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Brain className="h-7 w-7 text-primary" />
              AI Growth Co-Pilot
            </h1>
            <p className="text-muted-foreground mt-1">
              AI-powered insights to help your chapter grow and thrive
            </p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => refetch()}
            disabled={isFetching}
            data-testid="button-refresh-copilot"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
        
        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map(i => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : error ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Failed to load AI insights. Please try again.
            </CardContent>
          </Card>
        ) : data ? (
          <>
            <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-primary/20">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <Sparkles className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-1">AI Summary</h3>
                    <p className="text-muted-foreground">{data.ai_summary}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Overall Score
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-3xl font-bold">{data.engagement_score.overall_score}</div>
                      <div className="text-xs text-muted-foreground">out of 100</div>
                    </div>
                    <div className={`flex items-center gap-1 text-sm ${
                      data.engagement_score.trend === "improving" ? "text-green-500" :
                      data.engagement_score.trend === "declining" ? "text-red-500" : "text-muted-foreground"
                    }`}>
                      {data.engagement_score.trend === "improving" && <TrendingUp className="h-4 w-4" />}
                      {data.engagement_score.trend === "declining" && <TrendingDown className="h-4 w-4" />}
                      {data.engagement_score.trend}
                    </div>
                  </div>
                  <Progress value={data.engagement_score.overall_score} className="mt-3" />
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Attendance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScoreGauge score={data.engagement_score.attendance_score} label="Attendance Rate" />
                  <Progress value={data.engagement_score.attendance_score} className="mt-3" />
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Visitor Score
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScoreGauge score={data.engagement_score.visitor_score} label="Visitor Activity" />
                  <Progress value={data.engagement_score.visitor_score} className="mt-3" />
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Referral Score
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScoreGauge score={data.engagement_score.referral_score} label="Member Referrals" />
                  <Progress value={data.engagement_score.referral_score} className="mt-3" />
                </CardContent>
              </Card>
            </div>
            
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5" />
                    Growth Insights
                  </CardTitle>
                  <CardDescription>AI-detected patterns and recommendations</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.growth_insights.length > 0 ? (
                    data.growth_insights.map((insight, i) => (
                      <InsightCard key={i} insight={insight} />
                    ))
                  ) : (
                    <p className="text-muted-foreground text-center py-4">No insights available yet</p>
                  )}
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Meeting Playbook
                  </CardTitle>
                  <CardDescription>Recommended focus for your next meeting</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-medium text-sm mb-2">Focus Areas</h4>
                    <div className="space-y-2">
                      {data.meeting_playbook.focus_areas.map((area, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <ChevronRight className="h-4 w-4 text-primary" />
                          {area}
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {data.meeting_playbook.member_highlights.length > 0 && (
                    <div>
                      <h4 className="font-medium text-sm mb-2">Member Highlights</h4>
                      <div className="space-y-1">
                        {data.meeting_playbook.member_highlights.map((highlight, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            {highlight}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div>
                    <h4 className="font-medium text-sm mb-2">Visitor Strategy</h4>
                    <p className="text-sm text-muted-foreground">{data.meeting_playbook.visitor_strategy}</p>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-sm mb-2">Action Items</h4>
                    <div className="space-y-2">
                      {data.meeting_playbook.action_items.map((item, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                            <span className="text-xs font-medium text-primary">{i + 1}</span>
                          </div>
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {data.churn_risks.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    Churn Risk Alert
                  </CardTitle>
                  <CardDescription>
                    Members who may need attention to prevent disengagement
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {data.churn_risks.slice(0, 6).map((member) => (
                      <ChurnRiskCard key={member.participant_id} member={member} />
                    ))}
                  </div>
                  {data.churn_risks.length > 6 && (
                    <p className="text-sm text-muted-foreground text-center mt-4">
                      +{data.churn_risks.length - 6} more members at risk
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        ) : null}
      </div>
    </AdminLayout>
  );
}
