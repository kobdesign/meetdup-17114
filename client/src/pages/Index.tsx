import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import LandingNavbar from "@/components/landing/LandingNavbar";
import HeroSection from "@/components/landing/HeroSection";
import TrustBar from "@/components/landing/TrustBar";
import ProblemSolutionSection from "@/components/landing/ProblemSolutionSection";
import FeatureShowcase from "@/components/landing/FeatureShowcase";
import SocialProofSection from "@/components/landing/SocialProofSection";
import TechnologySection from "@/components/landing/TechnologySection";
import LandingFooter from "@/components/landing/LandingFooter";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .single();

      if (data?.role === "super_admin") {
        navigate("/super-admin/tenants");
      } else {
        navigate("/admin");
      }
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <LandingNavbar />
      <HeroSection />
      <TrustBar />
      <ProblemSolutionSection />
      <FeatureShowcase />
      <SocialProofSection />
      <TechnologySection />
      <LandingFooter />
    </div>
  );
};

export default Index;
