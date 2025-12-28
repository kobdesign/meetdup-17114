import { useTranslation } from "react-i18next";
import { AlertTriangle, CheckCircle2, Clock, Users, LineChart } from "lucide-react";

const ProblemSolutionSection = () => {
  const { t } = useTranslation();

  const problems = [
    {
      icon: Clock,
      problemKey: "excel",
    },
    {
      icon: Users,
      problemKey: "manual",
    },
    {
      icon: LineChart,
      problemKey: "noData",
    },
  ];

  return (
    <section id="solutions" className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            {t("painPoints.title")}
          </h2>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
          {["excel", "manual", "noData", "communication"].map((key, index) => (
            <div
              key={key}
              className="p-6 rounded-xl bg-muted/50 border border-border"
              data-testid={`problem-${key}`}
            >
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                <AlertTriangle className="w-6 h-6 text-destructive" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {t(`painPoints.problems.${key}.title`)}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t(`painPoints.problems.${key}.desc`)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProblemSolutionSection;
