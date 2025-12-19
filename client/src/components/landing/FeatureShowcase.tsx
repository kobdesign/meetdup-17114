import { 
  CalendarCheck, 
  Users, 
  MessageSquare, 
  QrCode, 
  BarChart3, 
  Shield,
  UserPlus,
  Bell,
  Smartphone
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  {
    icon: CalendarCheck,
    title: "PALMS Attendance",
    description: "Complete attendance tracking: Present, Absent, Late, Medical, Substitute - all automated.",
    color: "bg-blue-500/10 text-blue-500",
  },
  {
    icon: MessageSquare,
    title: "LINE Bot Integration",
    description: "Member check-ins, RSVP, notifications, and interactions via LINE's familiar interface.",
    color: "bg-green-500/10 text-green-500",
  },
  {
    icon: QrCode,
    title: "QR Check-In",
    description: "Secure JWT-based QR codes for quick meeting check-ins with fraud prevention.",
    color: "bg-purple-500/10 text-purple-500",
  },
  {
    icon: Users,
    title: "Visitor Pipeline",
    description: "Track visitors from first contact to membership with automated follow-up reminders.",
    color: "bg-orange-500/10 text-orange-500",
  },
  {
    icon: BarChart3,
    title: "Goals & Analytics",
    description: "Set chapter goals and track progress with real-time dashboards and LINE notifications.",
    color: "bg-indigo-500/10 text-indigo-500",
  },
  {
    icon: UserPlus,
    title: "Member Onboarding",
    description: "Multiple onboarding paths: Pioneer, Invite, Discovery - each tailored to different member journeys.",
    color: "bg-pink-500/10 text-pink-500",
  },
  {
    icon: Bell,
    title: "Smart Notifications",
    description: "Automated meeting reminders, RSVP collection, and goal achievement alerts via LINE.",
    color: "bg-yellow-500/10 text-yellow-500",
  },
  {
    icon: Smartphone,
    title: "LIFF Integration",
    description: "Native LINE app experience for member profiles, business card sharing, and search.",
    color: "bg-cyan-500/10 text-cyan-500",
  },
  {
    icon: Shield,
    title: "Role-Based Access",
    description: "Super Admin, Chapter Admin, and Member roles with appropriate permissions at every level.",
    color: "bg-red-500/10 text-red-500",
  },
];

const FeatureShowcase = () => {
  return (
    <section id="features" className="py-24 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Everything You Need to Run Your Chapter
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            From attendance tracking to member management, we've built every feature 
            you need to run a successful business networking chapter.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <Card 
              key={index} 
              className="border-border/50 hover-elevate"
              data-testid={`feature-card-${index}`}
            >
              <CardContent className="p-6">
                <div className={`w-12 h-12 rounded-lg ${feature.color} flex items-center justify-center mb-4`}>
                  <feature.icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeatureShowcase;
