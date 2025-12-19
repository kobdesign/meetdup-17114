import { AlertTriangle, CheckCircle2, Clock, Users, LineChart } from "lucide-react";

const problems = [
  {
    icon: Clock,
    problem: "Manual Attendance Tracking",
    solution: "Automated PALMS System",
    description: "Stop wasting hours on spreadsheets. Our PALMS system automatically tracks Presence, Absences, Lates, Medical leaves, and Substitutes with real-time updates.",
  },
  {
    icon: Users,
    problem: "Lost Visitor Opportunities",
    solution: "Smart Visitor Pipeline",
    description: "Never lose track of potential members. Our visitor funnel tracks every touchpoint from first visit to membership conversion with automated follow-ups.",
  },
  {
    icon: LineChart,
    problem: "Fragmented Communication",
    solution: "LINE Integration",
    description: "Meet members where they are. Seamless LINE bot integration for check-ins, notifications, RSVP, and member interactions - all in one familiar platform.",
  },
];

const ProblemSolutionSection = () => {
  return (
    <section id="solutions" className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Problems We Solve
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Running a business chapter shouldn't feel like herding cats. 
            We've solved the biggest pain points so you can focus on what matters - building relationships.
          </p>
        </div>

        <div className="space-y-16 max-w-5xl mx-auto">
          {problems.map((item, index) => (
            <div
              key={index}
              className={`flex flex-col ${
                index % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"
              } gap-8 items-center`}
              data-testid={`problem-solution-${index}`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-destructive" />
                  </div>
                  <span className="text-destructive font-medium">The Problem</span>
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  {item.problem}
                </h3>
                <div className="flex items-center gap-3 mb-4 mt-6">
                  <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-success" />
                  </div>
                  <span className="text-success font-medium">Our Solution</span>
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  {item.solution}
                </h3>
                <p className="text-muted-foreground">{item.description}</p>
              </div>

              <div className="flex-1">
                <div className="aspect-square max-w-sm mx-auto bg-muted/50 rounded-2xl flex items-center justify-center border border-border">
                  <item.icon className="w-24 h-24 text-navy/20" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProblemSolutionSection;
