import { Star, Quote } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const testimonials = [
  {
    name: "Somchai Prasert",
    role: "Chapter Director",
    company: "BNI Bangkok Premier",
    content: "Meetdup transformed how we manage our chapter. The PALMS tracking alone saves us hours every week, and our members love the LINE integration.",
    initials: "SP",
  },
  {
    name: "Nattaya Sripong",
    role: "Membership Chair",
    company: "BNI Chiang Mai Connect",
    content: "The visitor pipeline feature helped us increase our conversion rate by 40%. We never lose track of potential members anymore.",
    initials: "NS",
  },
  {
    name: "Wichai Tangsiri",
    role: "Chapter President",
    company: "BNI Phuket Success",
    content: "Our members actually enjoy using this system. The QR check-in is seamless and the goal tracking keeps everyone motivated.",
    initials: "WT",
  },
];

const SocialProofSection = () => {
  return (
    <section id="testimonials" className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Trusted by Chapter Leaders
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            See what chapter administrators and members are saying about Meetdup.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {testimonials.map((testimonial, index) => (
            <Card key={index} className="border-border/50" data-testid={`testimonial-${index}`}>
              <CardContent className="p-6">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-gold text-gold" />
                  ))}
                </div>
                <Quote className="w-8 h-8 text-muted-foreground/30 mb-4" />
                <p className="text-foreground mb-6">{testimonial.content}</p>
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback className="bg-navy text-white">
                      {testimonial.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium text-foreground">{testimonial.name}</div>
                    <div className="text-sm text-muted-foreground">{testimonial.role}</div>
                    <div className="text-xs text-muted-foreground">{testimonial.company}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default SocialProofSection;
