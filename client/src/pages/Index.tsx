import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Users, Calendar, CheckSquare } from "lucide-react";

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
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Meetdup
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Streamline your chapter operations with powerful tools
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" onClick={() => navigate("/auth")}>
              Get Started
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/auth")}>
              Sign In
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          <div className="bg-card p-6 rounded-lg border shadow-sm">
            <Building2 className="h-12 w-12 text-primary mb-4" />
            <h3 className="text-lg font-semibold mb-2">Multi-Tenant</h3>
            <p className="text-sm text-muted-foreground">
              Manage multiple chapters with complete data isolation
            </p>
          </div>

          <div className="bg-card p-6 rounded-lg border shadow-sm">
            <Users className="h-12 w-12 text-primary mb-4" />
            <h3 className="text-lg font-semibold mb-2">Participant Management</h3>
            <p className="text-sm text-muted-foreground">
              Track members and visitors efficiently
            </p>
          </div>

          <div className="bg-card p-6 rounded-lg border shadow-sm">
            <Calendar className="h-12 w-12 text-primary mb-4" />
            <h3 className="text-lg font-semibold mb-2">Meeting Scheduling</h3>
            <p className="text-sm text-muted-foreground">
              Schedule and manage weekly chapter meetings
            </p>
          </div>

          <div className="bg-card p-6 rounded-lg border shadow-sm">
            <CheckSquare className="h-12 w-12 text-primary mb-4" />
            <h3 className="text-lg font-semibold mb-2">Check-in System</h3>
            <p className="text-sm text-muted-foreground">
              Track attendance with QR codes and LINE integration
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
