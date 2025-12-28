import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

const PricingSection = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const plans = [
    {
      name: t("pricing.core.name"),
      desc: t("pricing.core.desc"),
      price: "6,900",
      features: t("pricing.core.features", { returnObjects: true }) as string[],
      popular: false,
      variant: "outline" as const,
    },
    {
      name: t("pricing.pro.name"),
      desc: t("pricing.pro.desc"),
      price: "11,900",
      features: t("pricing.pro.features", { returnObjects: true }) as string[],
      popular: true,
      variant: "default" as const,
    },
    {
      name: t("pricing.enterprise.name"),
      desc: t("pricing.enterprise.desc"),
      price: t("pricing.enterprise.price"),
      features: t("pricing.enterprise.features", { returnObjects: true }) as string[],
      popular: false,
      variant: "outline" as const,
    },
  ];

  return (
    <section id="pricing" className="py-24 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">{t("pricing.title")}</h2>
          <p className="text-lg text-muted-foreground">{t("pricing.subtitle")}</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((plan, index) => (
            <Card 
              key={index} 
              className={`relative ${plan.popular ? 'border-primary shadow-lg' : ''}`}
              data-testid={`pricing-card-${plan.name.toLowerCase()}`}
            >
              {plan.popular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                  {t("pricing.popular")}
                </Badge>
              )}
              <CardHeader className="text-center">
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <CardDescription>{plan.desc}</CardDescription>
                <div className="pt-4">
                  {typeof plan.price === 'string' && plan.price.includes(',') ? (
                    <>
                      <span className="text-4xl font-bold">{plan.price}</span>
                      <span className="text-muted-foreground">{t("pricing.perMonth")}</span>
                    </>
                  ) : (
                    <span className="text-2xl font-bold">{plan.price}</span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {plan.features.map((feature, fIndex) => (
                    <li key={fIndex} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button 
                  className="w-full" 
                  variant={plan.variant}
                  onClick={() => navigate("/auth")}
                  data-testid={`button-plan-${plan.name.toLowerCase()}`}
                >
                  {index === 2 ? t("pricing.cta.contact") : t("pricing.cta.select")}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
