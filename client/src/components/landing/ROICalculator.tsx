import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Target, Clock, Banknote, TrendingUp, Users } from "lucide-react";

const ROICalculator = () => {
  const { t } = useTranslation();
  const [chapterSize, setChapterSize] = useState(30);

  const timeSaved = Math.round(chapterSize * 0.15);
  const moneySaved = timeSaved * 500 * 4;
  const attendanceIncrease = Math.round(chapterSize * 0.25);
  const visitorIncrease = Math.round(chapterSize * 0.1);

  return (
    <section id="roi" className="py-24">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <Badge variant="outline" className="mb-4">{t("roi.badge")}</Badge>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">{t("roi.title")}</h2>
          <p className="text-lg text-muted-foreground">{t("roi.subtitle")}</p>
        </div>

        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                {t("roi.members")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>{t("roi.members")}</Label>
                  <span className="font-semibold text-primary">{chapterSize} {t("roi.person")}</span>
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
                  <span>10</span>
                  <span>100</span>
                </div>
              </div>

              <div className="pt-4 border-t">
                <h4 className="font-semibold mb-4">{t("roi.results.title")}</h4>
                <div className="grid grid-cols-2 gap-4">
                  <Card className="bg-primary/5 border-primary/20" data-testid="roi-time-saved">
                    <CardContent className="p-4 text-center">
                      <Clock className="w-6 h-6 text-primary mx-auto mb-2" />
                      <div className="text-2xl font-bold text-primary">{timeSaved}</div>
                      <div className="text-sm text-muted-foreground">{t("roi.results.hoursPerWeek")}</div>
                      <div className="text-xs text-muted-foreground mt-1">{t("roi.results.timeSaved")}</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-green-500/5 border-green-500/20" data-testid="roi-money-saved">
                    <CardContent className="p-4 text-center">
                      <Banknote className="w-6 h-6 text-green-500 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-green-500">{moneySaved.toLocaleString()}</div>
                      <div className="text-sm text-muted-foreground">{t("roi.results.perMonth")}</div>
                      <div className="text-xs text-muted-foreground mt-1">{t("roi.results.moneySaved")}</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-blue-500/5 border-blue-500/20" data-testid="roi-attendance">
                    <CardContent className="p-4 text-center">
                      <TrendingUp className="w-6 h-6 text-blue-500 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-blue-500">+{attendanceIncrease}%</div>
                      <div className="text-sm text-muted-foreground">{t("roi.results.attendance")}</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-purple-500/5 border-purple-500/20" data-testid="roi-visitors">
                    <CardContent className="p-4 text-center">
                      <Users className="w-6 h-6 text-purple-500 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-purple-500">+{visitorIncrease}</div>
                      <div className="text-sm text-muted-foreground">{t("roi.results.perMeeting")}</div>
                      <div className="text-xs text-muted-foreground mt-1">{t("roi.results.visitors")}</div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};

export default ROICalculator;
