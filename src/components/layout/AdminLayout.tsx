import { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  CheckSquare, 
  CreditCard, 
  Settings,
  LogOut,
  Building2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AdminLayoutProps {
  children: ReactNode;
  isSuperAdmin?: boolean;
}

export const AdminLayout = ({ children, isSuperAdmin = false }: AdminLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Failed to logout");
      return;
    }
    toast.success("Logged out successfully");
    navigate("/auth");
  };

  const superAdminNav = [
    { icon: Building2, label: "Tenants", path: "/super-admin/tenants" },
    { icon: LayoutDashboard, label: "Plans", path: "/super-admin/plans" },
    { icon: CreditCard, label: "Subscriptions", path: "/super-admin/subscriptions" },
  ];

  const chapterAdminNav = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/admin" },
    { icon: Users, label: "Participants", path: "/admin/participants" },
    { icon: Calendar, label: "Meetings", path: "/admin/meetings" },
    { icon: CheckSquare, label: "Check-ins", path: "/admin/checkins" },
    { icon: CreditCard, label: "Payments", path: "/admin/payments" },
    { icon: Settings, label: "Settings", path: "/admin/settings" },
  ];

  const navItems = isSuperAdmin ? superAdminNav : chapterAdminNav;

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed left-0 top-0 h-screen w-64 border-r bg-sidebar">
        <div className="flex h-16 items-center border-b px-6">
          <h1 className="text-lg font-bold text-sidebar-foreground">
            {isSuperAdmin ? "SuperAdmin" : "BNI Chapter"}
          </h1>
        </div>
        <nav className="space-y-1 p-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path}>
                <Button
                  variant={isActive ? "default" : "ghost"}
                  className={cn(
                    "w-full justify-start gap-3",
                    isActive && "bg-sidebar-primary"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Button>
              </Link>
            );
          })}
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 mt-4"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </nav>
      </aside>
      <main className="ml-64 min-h-screen">
        <div className="border-b bg-card">
          <div className="container mx-auto px-8 py-4">
            <h2 className="text-2xl font-semibold">
              {navItems.find(item => item.path === location.pathname)?.label || "Dashboard"}
            </h2>
          </div>
        </div>
        <div className="container mx-auto p-8">
          {children}
        </div>
      </main>
    </div>
  );
};

function cn(...classes: (string | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
