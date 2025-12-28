import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Calendar, ArrowRight, Mail, Phone } from "lucide-react";
import { SiLine } from "react-icons/si";

const CTASection = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <section className="py-24 bg-gradient-to-br from-primary/10 via-background to-accent/10">
      <div className="max-w-4xl mx-auto px-4 text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">
          {t("cta.title")}
        </h2>
        <p className="text-lg text-muted-foreground mb-8">
          {t("cta.subtitle")}
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
          <Button 
            size="lg" 
            className="w-full sm:w-auto" 
            onClick={() => navigate("/demo")}
            data-testid="button-demo-footer"
          >
            <Calendar className="w-5 h-5 mr-2" />
            {t("cta.demo")}
          </Button>
          <Button 
            size="lg" 
            variant="outline" 
            className="w-full sm:w-auto"
            onClick={() => navigate("/auth")}
            data-testid="button-trial-footer"
          >
            {t("cta.trial")}
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-6 text-muted-foreground">
          <a 
            href="mailto:hello@meetdup.io" 
            className="flex items-center gap-2 hover:text-foreground transition-colors"
            data-testid="link-email"
          >
            <Mail className="w-4 h-4" />
            hello@meetdup.io
          </a>
          <a 
            href="tel:+66812345678" 
            className="flex items-center gap-2 hover:text-foreground transition-colors"
            data-testid="link-phone"
          >
            <Phone className="w-4 h-4" />
            081-234-5678
          </a>
          <a 
            href="#" 
            className="flex items-center gap-2 hover:text-foreground transition-colors"
            data-testid="link-line-oa"
          >
            <SiLine className="w-4 h-4" />
            @meetdup
          </a>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
