import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { LanguageToggle } from "@/components/ui/language-toggle";
import { Menu, X } from "lucide-react";

const LandingNavbar = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navItems = [
    { label: t("nav.features"), href: "#features" },
    { label: t("nav.pricing"), href: "#pricing" },
    { label: t("nav.faq"), href: "#faq" },
  ];

  const scrollToSection = (href: string) => {
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
    setIsMenuOpen(false);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-navy/95 backdrop-blur-sm border-b border-white/10">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gold rounded-md flex items-center justify-center">
              <span className="text-navy font-bold text-lg">M</span>
            </div>
            <span className="text-xl font-bold text-white">Meetdup</span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            {navItems.map((item) => (
              <button
                key={item.label}
                onClick={() => scrollToSection(item.href)}
                className="text-white/80 hover:text-white transition-colors text-sm font-medium"
                data-testid={`nav-${item.label.toLowerCase()}`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <LanguageToggle />
            <Button
              variant="ghost"
              className="text-white"
              onClick={() => navigate("/auth")}
              data-testid="button-signin"
            >
              {t("nav.login")}
            </Button>
            <Button
              variant="gold"
              className="font-semibold"
              onClick={() => navigate("/demo")}
              data-testid="button-get-started"
            >
              {t("nav.demo")}
            </Button>
          </div>

          <button
            className="md:hidden text-white p-2"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            data-testid="button-mobile-menu"
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-white/10">
            <div className="flex flex-col gap-4">
              {navItems.map((item) => (
                <button
                  key={item.label}
                  onClick={() => scrollToSection(item.href)}
                  className="text-white/80 transition-colors text-sm font-medium text-left"
                  data-testid={`nav-mobile-${item.label.toLowerCase()}`}
                >
                  {item.label}
                </button>
              ))}
              <div className="flex flex-col gap-2 pt-4 border-t border-white/10">
                <div className="flex items-center gap-2 pb-2">
                  <LanguageToggle />
                </div>
                <Button
                  variant="ghost"
                  className="text-white justify-start"
                  onClick={() => navigate("/auth")}
                  data-testid="button-mobile-signin"
                >
                  {t("nav.login")}
                </Button>
                <Button
                  variant="gold"
                  className="font-semibold"
                  onClick={() => navigate("/demo")}
                  data-testid="button-mobile-get-started"
                >
                  {t("nav.demo")}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default LandingNavbar;
