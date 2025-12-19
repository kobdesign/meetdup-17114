import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Play, ArrowRight } from "lucide-react";

const HeroSection = () => {
  const navigate = useNavigate();

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-navy pt-16">
      <div className="absolute inset-0 bg-gradient-to-br from-navy via-navy to-navy/80" />
      
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-10 w-72 h-72 bg-gold rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-primary rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 mb-8">
            <span className="w-2 h-2 bg-gold rounded-full animate-pulse" />
            <span className="text-white/80 text-sm">Trusted by 50+ Business Chapters</span>
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
            The Operating System for{" "}
            <span className="text-gold">Business Chapters</span>
          </h1>

          <p className="text-lg md:text-xl text-white/70 mb-10 max-w-2xl mx-auto leading-relaxed">
            Streamline your chapter operations with PALMS attendance tracking, 
            LINE integration, and powerful member management tools. 
            Built for networking organizations that mean business.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Button
              size="lg"
              variant="gold"
              className="font-semibold px-8 gap-2"
              onClick={() => navigate("/auth")}
              data-testid="button-hero-get-started"
            >
              Start Free Trial
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Button
              size="lg"
              variant="ghost"
              className="border border-white/30 text-white gap-2"
              data-testid="button-hero-demo"
            >
              <Play className="w-4 h-4" />
              Watch Demo
            </Button>
          </div>

          <div className="relative max-w-3xl mx-auto">
            <div className="bg-gradient-to-b from-white/10 to-transparent p-1 rounded-xl">
              <div className="bg-navy/50 backdrop-blur-sm rounded-lg p-4 border border-white/10">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                </div>
                <div className="aspect-video bg-navy/80 rounded-md flex items-center justify-center border border-white/5">
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gold/20 flex items-center justify-center">
                      <Play className="w-8 h-8 text-gold" />
                    </div>
                    <p className="text-white/50 text-sm">Platform Preview</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
};

export default HeroSection;
