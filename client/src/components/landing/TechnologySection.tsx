import { Shield, Lock, CloudLightning, Smartphone, Database, RefreshCw } from "lucide-react";

const techFeatures = [
  {
    icon: Shield,
    title: "Enterprise Security",
    description: "Role-based access control, JWT authentication, and secure token validation for all operations.",
  },
  {
    icon: Lock,
    title: "Data Protection",
    description: "Your data is encrypted at rest and in transit. We follow industry best practices for data handling.",
  },
  {
    icon: CloudLightning,
    title: "Real-Time Updates",
    description: "Instant synchronization across all devices. See check-ins and updates as they happen.",
  },
  {
    icon: Smartphone,
    title: "Mobile-First Design",
    description: "Optimized for the devices your members actually use. Perfect LINE LIFF integration.",
  },
  {
    icon: Database,
    title: "Reliable Infrastructure",
    description: "Built on Supabase with PostgreSQL. Your data is safe, backed up, and always available.",
  },
  {
    icon: RefreshCw,
    title: "High Availability",
    description: "We understand your meetings can't wait. Built for reliability when you need it most.",
  },
];

const TechnologySection = () => {
  return (
    <section className="py-24 bg-navy text-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Built for Business. Secured for Trust.
          </h2>
          <p className="text-lg text-white/70 max-w-2xl mx-auto">
            We take security and reliability seriously because your chapter's reputation depends on it.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {techFeatures.map((feature, index) => (
            <div
              key={index}
              className="text-center"
              data-testid={`tech-feature-${index}`}
            >
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gold/20 mb-4">
                <feature.icon className="w-8 h-8 text-gold" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-white/60 text-sm">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TechnologySection;
