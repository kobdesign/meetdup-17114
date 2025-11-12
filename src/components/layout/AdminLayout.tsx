import { ReactNode, useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  Menu,
  LogOut,
  User,
  Building2,
  Settings,
  BarChart3,
  UserPlus,
  QrCode,
  Shield,
  RefreshCw,
  Activity
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import NavLink from "@/components/NavLink";
import { toast } from "sonner";
import TenantSelectorCard from "@/components/TenantSelectorCard";
import { useTenantContext } from "@/contexts/TenantContext";

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const navigate = useNavigate();
  const { isSuperAdmin } = useTenantContext();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");

  useEffect(() => {
    loadUserInfo();
  }, []);

  const loadUserInfo = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        setUserEmail(user.email || "");

        // Get all user roles and select the highest priority one
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);

        if (roleData && roleData.length > 0) {
          // Priority: super_admin > chapter_admin > chapter_member
          const roleHierarchy = { super_admin: 3, chapter_admin: 2, chapter_member: 1 };
          const highestRole = roleData.reduce((highest, current) => {
            const currentPriority = roleHierarchy[current.role as keyof typeof roleHierarchy] || 0;
            const highestPriority = roleHierarchy[highest.role as keyof typeof roleHierarchy] || 0;
            return currentPriority > highestPriority ? current : highest;
          });
          setUserRole(highestRole.role);
        }

        // Get user profile
        const { data: profileData } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .single();

        if (profileData) {
          setUserName(profileData.full_name || "");
        }
      }
    } catch (error) {
      console.error("Error loading user info:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast.success("ออกจากระบบสำเร็จ");
      navigate("/auth");
    } catch (error) {
      toast.error("ไม่สามารถออกจากระบบได้");
    }
  };

  const getInitials = (name: string) => {
    if (!name) return "?";
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const navItems = [
    { icon: <LayoutDashboard className="h-4 w-4" />, label: "Dashboard", href: "/admin" },
    { icon: <Users className="h-4 w-4" />, label: "สมาชิก", href: "/admin/participants" },
    { icon: <Calendar className="h-4 w-4" />, label: "การประชุม", href: "/admin/meetings" },
    { icon: <UserPlus className="h-4 w-4" />, label: "ผู้เยี่ยมชม", href: "/admin/visitors" },
    { icon: <QrCode className="h-4 w-4" />, label: "Check-In", href: "/admin/checkin" },
    { icon: <RefreshCw className="h-4 w-4" />, label: "ตรวจสอบการชำระเงิน", href: "/admin/payment-reviews" },
    { icon: <Settings className="h-4 w-4" />, label: "การตั้งค่า", href: "/admin/settings" },
    { icon: <Activity className="h-4 w-4" />, label: "Integration Logs", href: "/admin/integration-logs" },
  ];

  const superAdminNavItems = [
    { icon: <Building2 className="h-4 w-4" />, label: "จัดการ Tenants", href: "/super-admin/tenants" },
    { icon: <Shield className="h-4 w-4" />, label: "จัดการสิทธิ์", href: "/admin/authorization" },
    { icon: <RefreshCw className="h-4 w-4" />, label: "อนุมัติคืนเงิน", href: "/admin/refund-approvals" },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64">
                {isSuperAdmin && (
                  <div className="mb-4 mt-4">
                    <TenantSelectorCard />
                  </div>
                )}
                
                <nav className="flex flex-col gap-2 mt-8">
                  {navItems.map((item) => (
                    <NavLink key={item.href} to={item.href} icon={item.icon}>
                      {item.label}
                    </NavLink>
                  ))}
                  {userRole === "super_admin" && (
                    <>
                      <div className="my-2 border-t" />
                      {superAdminNavItems.map((item) => (
                        <NavLink key={item.href} to={item.href} icon={item.icon}>
                          {item.label}
                        </NavLink>
                      ))}
                    </>
                  )}
                </nav>
              </SheetContent>
            </Sheet>
            
            <Link to="/admin" className="flex items-center gap-2">
              <span className="text-xl font-bold">BNI Chapter</span>
            </Link>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                <Avatar className="h-10 w-10">
                  <AvatarImage src="" alt={userName} />
                  <AvatarFallback>{getInitials(userName)}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{userName}</p>
                  <p className="text-xs leading-none text-muted-foreground">{userEmail}</p>
                  {userRole && (
                    <p className="text-xs leading-none text-muted-foreground mt-1">
                      {userRole === "super_admin" ? "Super Admin" : userRole === "chapter_admin" ? "Chapter Admin" : "Member"}
                    </p>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/profile")}>
                <User className="mr-2 h-4 w-4" />
                <span>โปรไฟล์</span>
              </DropdownMenuItem>
              {userRole === "super_admin" && (
                <>
                  <DropdownMenuItem onClick={() => navigate("/super-admin/tenants")}>
                    <Building2 className="mr-2 h-4 w-4" />
                    <span>จัดการ Tenants</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/admin/authorization")}>
                    <Shield className="mr-2 h-4 w-4" />
                    <span>จัดการสิทธิ์</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/admin/refund-approvals")}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    <span>อนุมัติคืนเงิน</span>
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>ออกจากระบบ</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="hidden w-64 border-r md:block">
          <div className="p-4">
            {isSuperAdmin && (
              <div className="mb-4">
                <TenantSelectorCard />
              </div>
            )}
          </div>
          
          <nav className="flex flex-col gap-2 px-4">
            {navItems.map((item) => (
              <NavLink key={item.href} to={item.href} icon={item.icon}>
                {item.label}
              </NavLink>
            ))}
            {userRole === "super_admin" && (
              <>
                <div className="my-2 border-t" />
                <div className="text-xs font-semibold text-muted-foreground px-3 mb-2">
                  Super Admin
                </div>
                {superAdminNavItems.map((item) => (
                  <NavLink key={item.href} to={item.href} icon={item.icon}>
                    {item.label}
                  </NavLink>
                ))}
              </>
            )}
          </nav>
        </aside>

        <main className="flex-1 p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
