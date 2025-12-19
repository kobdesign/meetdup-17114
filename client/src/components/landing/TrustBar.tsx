import { Users, Calendar, CheckSquare, TrendingUp } from "lucide-react";

const stats = [
  {
    icon: Users,
    value: "2,500+",
    label: "Active Members",
  },
  {
    icon: Calendar,
    value: "500+",
    label: "Meetings Managed",
  },
  {
    icon: CheckSquare,
    value: "95%",
    label: "Attendance Rate",
  },
  {
    icon: TrendingUp,
    value: "50+",
    label: "Chapters Served",
  },
];

const TrustBar = () => {
  return (
    <section className="py-16 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <div key={index} className="text-center" data-testid={`stat-${index}`}>
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-navy/10 mb-4">
                <stat.icon className="w-6 h-6 text-navy" />
              </div>
              <div className="text-3xl md:text-4xl font-bold text-navy mb-1">
                {stat.value}
              </div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-12 border-t border-border">
          <p className="text-center text-muted-foreground mb-8 text-sm">
            Trusted by leading business networking organizations
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16 opacity-60">
            <div className="text-xl font-semibold text-muted-foreground">BNI Thailand</div>
            <div className="text-xl font-semibold text-muted-foreground">LeTIP</div>
            <div className="text-xl font-semibold text-muted-foreground">Rotary Club</div>
            <div className="text-xl font-semibold text-muted-foreground">Chamber of Commerce</div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TrustBar;
