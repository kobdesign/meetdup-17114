import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowRight, X } from "lucide-react";
import LandingNavbar from "@/components/landing/LandingNavbar";
import HeroSection from "@/components/landing/HeroSection";
import SocialProofSection from "@/components/landing/SocialProofSection";
import ProblemSolutionSection from "@/components/landing/ProblemSolutionSection";
import FeatureShowcase from "@/components/landing/FeatureShowcase";
import ROICalculator from "@/components/landing/ROICalculator";
import PricingSection from "@/components/landing/PricingSection";
import FAQSection from "@/components/landing/FAQSection";
import CTASection from "@/components/landing/CTASection";
import LandingFooter from "@/components/landing/LandingFooter";

const Index = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [showBanner, setShowBanner] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
      setIsLoggedIn(true);
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .single();

      if (data?.role) {
        setUserRole(data.role);
      }
    }
  };

  const handleGoToAdmin = () => {
    if (userRole === "super_admin") {
      navigate("/super-admin/tenants");
    } else {
      navigate("/admin");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {isLoggedIn && showBanner && (
        <div className="fixed top-16 left-0 right-0 z-40 bg-primary text-primary-foreground py-2 px-4">
          <div className="container mx-auto flex items-center justify-between gap-4">
            <span className="text-sm">{t("nav.backToAdmin")}</span>
            <div className="flex items-center gap-2">
              <Button 
                size="sm" 
                variant="secondary"
                onClick={handleGoToAdmin}
                data-testid="button-back-to-admin"
              >
                {userRole === "super_admin" ? t("nav.superAdmin") : t("nav.adminDashboard")}
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
              <Button 
                size="icon" 
                variant="ghost" 
                className="text-primary-foreground hover:bg-primary-foreground/10"
                onClick={() => setShowBanner(false)}
                data-testid="button-dismiss-banner"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
      
      <LandingNavbar />
      <HeroSection />
      <SocialProofSection />
      <ProblemSolutionSection />
      <FeatureShowcase />
      <ROICalculator />
      <PricingSection />
      <FAQSection />
      <CTASection />
      <LandingFooter />
    </div>
  );
};

export default Index;
