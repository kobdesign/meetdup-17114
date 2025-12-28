import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, Users, TrendingUp, Zap } from "lucide-react";

const SocialProofSection = () => {
  const { t } = useTranslation();

  const metrics = [
    {
      icon: Clock,
      beforeKey: "checkIn.before",
      afterKey: "checkIn.after",
      labelKey: "checkIn.label",
    },
    {
      icon: Users,
      beforeKey: "onTime.before",
      afterKey: "onTime.after",
      labelKey: "onTime.label",
    },
    {
      icon: TrendingUp,
      beforeKey: "data.before",
      afterKey: "data.after",
      labelKey: "data.label",
    },
  ];

  return (
    <section id="case-study" className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <Badge variant="outline" className="mb-4">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            {t("socialProof.badge")}
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            {t("socialProof.title")}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t("socialProof.subtitle")}
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <Card className="p-8 bg-card border">
            <div className="flex flex-col md:flex-row items-center gap-6 mb-8">
              <div className="w-20 h-20 rounded-full bg-navy flex items-center justify-center flex-shrink-0">
                <span className="text-xl font-bold text-white">BNI</span>
              </div>
              <div className="text-center md:text-left">
                <h3 className="text-2xl font-bold text-foreground mb-1">BNI The World</h3>
                <p className="text-muted-foreground">{t("socialProof.chapterDesc")}</p>
                <div className="flex items-center gap-2 mt-2 justify-center md:justify-start">
                  <Badge variant="secondary" className="text-xs">
                    <Zap className="w-3 h-3 mr-1" />
                    {t("socialProof.liveNow")}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6 mb-8">
              {metrics.map((metric, index) => (
                <div 
                  key={index}
                  className="text-center p-5 rounded-lg bg-muted/50 border border-border/50"
                  data-testid={`metric-${index}`}
                >
                  <metric.icon className="w-6 h-6 mx-auto mb-3 text-primary" />
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <span className="text-destructive/70 line-through text-base">
                      {t(`socialProof.metrics.${metric.beforeKey}`)}
                    </span>
                    <span className="text-muted-foreground">→</span>
                    <span className="text-success text-xl font-bold">
                      {t(`socialProof.metrics.${metric.afterKey}`)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t(`socialProof.metrics.${metric.labelKey}`)}
                  </p>
                </div>
              ))}
            </div>

            <div className="border-t pt-6">
              <blockquote className="text-center">
                <p className="text-lg text-foreground italic mb-4">
                  "{t("socialProof.quote")}"
                </p>
                <footer className="text-sm text-muted-foreground">
                  — {t("socialProof.quotePerson")}
                </footer>
              </blockquote>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
};

export default SocialProofSection;
