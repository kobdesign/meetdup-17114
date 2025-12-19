import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Mail, Phone, MapPin } from "lucide-react";
import { SiLine } from "react-icons/si";

const LandingFooter = () => {
  const navigate = useNavigate();

  const footerLinks = {
    product: [
      { label: "Features", href: "#features" },
      { label: "Solutions", href: "#solutions" },
      { label: "Pricing", href: "#" },
      { label: "Roadmap", href: "#" },
    ],
    company: [
      { label: "About Us", href: "#" },
      { label: "Contact", href: "#contact" },
      { label: "Blog", href: "#" },
      { label: "Careers", href: "#" },
    ],
    resources: [
      { label: "Documentation", href: "#" },
      { label: "Help Center", href: "#" },
      { label: "API Reference", href: "#" },
      { label: "Status", href: "#" },
    ],
    legal: [
      { label: "Privacy Policy", href: "#" },
      { label: "Terms of Service", href: "#" },
      { label: "Cookie Policy", href: "#" },
    ],
  };

  const toSlug = (str: string) => str.toLowerCase().replace(/\s+/g, "-");

  return (
    <footer id="contact" className="bg-navy text-white">
      <div className="container mx-auto px-4">
        <div className="py-20 border-b border-white/10">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to Transform Your Chapter?
            </h2>
            <p className="text-lg text-white/70 mb-8 max-w-2xl mx-auto">
              Join 50+ business chapters already using Meetdup to streamline their operations 
              and grow their membership.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                size="lg"
                variant="gold"
                className="font-semibold px-8 gap-2"
                onClick={() => navigate("/auth")}
                data-testid="button-footer-get-started"
              >
                Start Free Trial
                <ArrowRight className="w-4 h-4" />
              </Button>
              <Button
                size="lg"
                variant="ghost"
                className="border border-white/30 text-white"
                data-testid="button-footer-contact"
              >
                Contact Sales
              </Button>
            </div>
          </div>
        </div>

        <div className="py-12 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
          <div className="col-span-2 md:col-span-1 lg:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-gold rounded-md flex items-center justify-center">
                <span className="text-navy font-bold text-lg">M</span>
              </div>
              <span className="text-xl font-bold">Meetdup</span>
            </div>
            <p className="text-white/60 text-sm mb-4">
              The operating system for business chapters. Built for networking organizations that mean business.
            </p>
            <div className="flex items-center gap-4">
              <a
                href="#"
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"
                data-testid="link-social-line"
              >
                <SiLine className="w-4 h-4" />
              </a>
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-sm">Product</h4>
            <ul className="space-y-2">
              {footerLinks.product.map((link) => (
                <li key={link.label}>
                  <a 
                    href={link.href} 
                    className="text-white/60 text-sm"
                    data-testid={`link-product-${toSlug(link.label)}`}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-sm">Company</h4>
            <ul className="space-y-2">
              {footerLinks.company.map((link) => (
                <li key={link.label}>
                  <a 
                    href={link.href} 
                    className="text-white/60 text-sm"
                    data-testid={`link-company-${toSlug(link.label)}`}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-sm">Resources</h4>
            <ul className="space-y-2">
              {footerLinks.resources.map((link) => (
                <li key={link.label}>
                  <a 
                    href={link.href} 
                    className="text-white/60 text-sm"
                    data-testid={`link-resources-${toSlug(link.label)}`}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-sm">Contact</h4>
            <ul className="space-y-3">
              <li className="flex items-center gap-2 text-white/60 text-sm" data-testid="text-contact-email">
                <Mail className="w-4 h-4" />
                hello@meetdup.com
              </li>
              <li className="flex items-center gap-2 text-white/60 text-sm" data-testid="text-contact-phone">
                <Phone className="w-4 h-4" />
                +66 2 123 4567
              </li>
              <li className="flex items-start gap-2 text-white/60 text-sm" data-testid="text-contact-address">
                <MapPin className="w-4 h-4 mt-0.5" />
                Bangkok, Thailand
              </li>
            </ul>
          </div>
        </div>

        <div className="py-6 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-white/50 text-sm" data-testid="text-copyright">
            2024 Meetdup. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center gap-6">
            {footerLinks.legal.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-white/50 text-sm"
                data-testid={`link-legal-${toSlug(link.label)}`}
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default LandingFooter;
