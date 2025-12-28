import { useTranslation } from "react-i18next";
import { 
  QrCode, 
  BarChart3, 
  Bot,
  CheckCircle2
} from "lucide-react";
import { SiLine } from "react-icons/si";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const FeatureShowcase = () => {
  const { t } = useTranslation();

  const features = [
    {
      icon: QrCode,
      title: t("features.commandCenter.title"),
      badge: t("features.commandCenter.badge"),
      items: t("features.commandCenter.items", { returnObjects: true }) as string[],
      color: "bg-primary/10 text-primary",
      gradient: "from-primary/20 to-blue-500/20",
    },
    {
      icon: SiLine,
      title: t("features.line.title"),
      badge: t("features.line.badge"),
      items: t("features.line.items", { returnObjects: true }) as string[],
      color: "bg-green-500/10 text-green-500",
      gradient: "from-green-500/20 to-emerald-500/20",
    },
    {
      icon: BarChart3,
      title: t("features.dashboard.title"),
      badge: t("features.dashboard.badge"),
      items: t("features.dashboard.items", { returnObjects: true }) as string[],
      color: "bg-blue-500/10 text-blue-500",
      gradient: "from-blue-500/20 to-indigo-500/20",
    },
    {
      icon: Bot,
      title: t("features.ai.title"),
      badge: t("features.ai.badge"),
      items: t("features.ai.items", { returnObjects: true }) as string[],
      color: "bg-purple-500/10 text-purple-500",
      gradient: "from-purple-500/20 to-pink-500/20",
    },
  ];

  return (
    <section id="features" className="py-24 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            {t("features.title")}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t("features.subtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {features.map((feature, index) => (
            <Card 
              key={index} 
              className="border-border/50 overflow-hidden"
              data-testid={`feature-card-${index}`}
            >
              <div className={`h-32 bg-gradient-to-br ${feature.gradient} flex items-center justify-center`}>
                <div className={`w-16 h-16 rounded-xl ${feature.color} flex items-center justify-center`}>
                  <feature.icon className="w-8 h-8" />
                </div>
              </div>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                  <Badge variant="secondary" className="text-xs">{feature.badge}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {feature.items.map((item, itemIndex) => (
                    <li key={itemIndex} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className={`w-4 h-4 shrink-0 mt-0.5 ${
                        index === 0 ? 'text-primary' :
                        index === 1 ? 'text-green-500' :
                        index === 2 ? 'text-blue-500' :
                        'text-purple-500'
                      }`} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeatureShowcase;
