import { useTranslation } from "react-i18next";
import { Mail, Phone } from "lucide-react";
import { SiLine } from "react-icons/si";
import { MeetdupLogo } from "@/components/MeetdupLogo";

const LandingFooter = () => {
  const { t } = useTranslation();

  return (
    <footer className="py-8 border-t bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <MeetdupLogo size="md" variant="dark" />

          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
            <a 
              href="mailto:hello@meetdup.io" 
              className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <Mail className="w-4 h-4" />
              hello@meetdup.io
            </a>
            <a 
              href="tel:+66812345678" 
              className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <Phone className="w-4 h-4" />
              081-234-5678
            </a>
            <a 
              href="#" 
              className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <SiLine className="w-4 h-4" />
              @meetdup
            </a>
          </div>

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{t("footer.copyright")}</span>
            <a href="#" className="hover:text-foreground transition-colors">
              {t("footer.privacy")}
            </a>
            <a href="#" className="hover:text-foreground transition-colors">
              {t("footer.terms")}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default LandingFooter;
