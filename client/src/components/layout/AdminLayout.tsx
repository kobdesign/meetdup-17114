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
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  MessageSquare,
  LayoutGrid,
  Upload,
  Smartphone,
  Trophy,
  Briefcase,
  ClipboardList,
  Bell,
  ChevronDown,
  ChevronRight,
  DollarSign
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import NavLink from "@/components/NavLink";
import { toast } from "sonner";
import TenantSelectorCard from "@/components/TenantSelectorCard";
import { useTenantContext } from "@/contexts/TenantContext";
import { ChapterSelector } from "@/components/layout/ChapterSelector";

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const navigate = useNavigate();
  const { 
    isSuperAdmin,
    isReady,
    isLoadingUserInfo,
    userName, 
    userEmail, 
    userRole,
    userChapters 
  } = useTenantContext();

  // Wait for tenant selection to complete before showing content
  const isContentReady = isReady;

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

  // Navigation menu structure with collapsible groups
  interface NavItem {
    icon: ReactNode;
    label: string;
    href: string;
  }

  interface NavGroup {
    id: string;
    label: string;
    icon: ReactNode;
    items: NavItem[];
    defaultOpen?: boolean;
  }

  // Collapsible state for nav groups
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    members: true,
    meetings: true,
    line: false,
    settings: false,
  });

  const toggleGroup = (groupId: string) => {
    setOpenGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  // Role-based navigation structure
  const getNavStructureByRole = (role: string | null): { quickAccess: NavItem[]; groups: NavGroup[] } => {
    // Quick access items (always visible at top)
    const quickAccess: NavItem[] = [
      { icon: <LayoutDashboard className="h-4 w-4" />, label: "Dashboard", href: "/admin" },
    ];

    // Member-only structure
    if (role !== "super_admin" && role !== "chapter_admin") {
      return {
        quickAccess,
        groups: [
          {
            id: "meetings",
            label: "การประชุม",
            icon: <Calendar className="h-4 w-4" />,
            defaultOpen: true,
            items: [
              { icon: <Calendar className="h-4 w-4" />, label: "การประชุม", href: "/admin/meetings" },
            ],
          },
        ],
      };
    }

    // Admin structure (chapter_admin and super_admin)
    return {
      quickAccess,
      groups: [
        {
          id: "members",
          label: "สมาชิก",
          icon: <Users className="h-4 w-4" />,
          defaultOpen: true,
          items: [
            { icon: <Users className="h-4 w-4" />, label: "รายชื่อสมาชิก", href: "/admin/participants" },
            { icon: <UserPlus className="h-4 w-4" />, label: "Visitor Pipeline", href: "/admin/visitors" },
            { icon: <UserPlus className="h-4 w-4" />, label: "จัดการสมาชิก", href: "/admin/members-management" },
            { icon: <Upload className="h-4 w-4" />, label: "นำเข้าสมาชิก", href: "/admin/import-members" },
          ],
        },
        {
          id: "meetings",
          label: "การประชุม",
          icon: <Calendar className="h-4 w-4" />,
          defaultOpen: true,
          items: [
            { icon: <Calendar className="h-4 w-4" />, label: "รายการประชุม", href: "/admin/meetings" },
            { icon: <QrCode className="h-4 w-4" />, label: "Meeting Operations", href: "/admin/meeting-operations" },
            { icon: <ClipboardList className="h-4 w-4" />, label: "รายงานเข้าร่วม", href: "/admin/attendance-report" },
            { icon: <Bell className="h-4 w-4" />, label: "แจ้งเตือนประชุม", href: "/admin/notifications" },
          ],
        },
        {
          id: "line",
          label: "LINE Bot",
          icon: <MessageSquare className="h-4 w-4" />,
          defaultOpen: false,
          items: [
            { icon: <MessageSquare className="h-4 w-4" />, label: "LINE Config", href: "/admin/line-config" },
            { icon: <LayoutGrid className="h-4 w-4" />, label: "Rich Menu", href: "/admin/rich-menu" },
            { icon: <Shield className="h-4 w-4" />, label: "สิทธิ์คำสั่ง", href: "/admin/line-command-access" },
          ],
        },
        {
          id: "finance",
          label: "การเงิน",
          icon: <DollarSign className="h-4 w-4" />,
          defaultOpen: false,
          items: [
            { icon: <DollarSign className="h-4 w-4" />, label: "ภาพรวมการเงิน", href: "/admin/finance" },
          ],
        },
        {
          id: "reports",
          label: "รายงาน",
          icon: <BarChart3 className="h-4 w-4" />,
          defaultOpen: false,
          items: [
            { icon: <BarChart3 className="h-4 w-4" />, label: "Chapter Performance", href: "/admin/performance" },
          ],
        },
        {
          id: "settings",
          label: "ตั้งค่า",
          icon: <Settings className="h-4 w-4" />,
          defaultOpen: false,
          items: [
            { icon: <Trophy className="h-4 w-4" />, label: "เป้าหมาย", href: "/admin/goals" },
            { icon: <Settings className="h-4 w-4" />, label: "การตั้งค่า Chapter", href: "/admin/settings" },
            { icon: <LayoutGrid className="h-4 w-4" />, label: "App Center", href: "/admin/app-center" },
          ],
        },
      ],
    };
  };

  const navStructure = getNavStructureByRole(userRole);

  const superAdminNavItems = [
    { icon: <Building2 className="h-4 w-4" />, label: "จัดการ Tenants", href: "/super-admin/tenants" },
    { icon: <Shield className="h-4 w-4" />, label: "จัดการสิทธิ์", href: "/admin/authorization" },
    { icon: <Smartphone className="h-4 w-4" />, label: "LIFF Settings", href: "/super-admin/liff-settings" },
    { icon: <Briefcase className="h-4 w-4" />, label: "หมวดหมู่ธุรกิจ", href: "/super-admin/business-categories" },
  ];

  // Render collapsible nav group
  const renderNavGroup = (group: NavGroup) => (
    <Collapsible
      key={group.id}
      open={openGroups[group.id]}
      onOpenChange={() => toggleGroup(group.id)}
    >
      <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium text-muted-foreground hover-elevate rounded-md">
        <div className="flex items-center gap-2">
          {group.icon}
          <span>{group.label}</span>
        </div>
        {openGroups[group.id] ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-4 mt-1 space-y-1">
        {group.items.map((item) => (
          <NavLink key={item.href} to={item.href} icon={item.icon}>
            {item.label}
          </NavLink>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );

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
                {!isContentReady ? (
                  <div className="mb-4 mt-4">
                    <Skeleton className="h-24 w-full" />
                  </div>
                ) : isContentReady && isSuperAdmin ? (
                  <div className="mb-4 mt-4">
                    <TenantSelectorCard />
                  </div>
                ) : null}
                
                <nav className="flex flex-col gap-1 mt-8">
                  {isContentReady && navStructure.quickAccess.map((item) => (
                    <NavLink key={item.href} to={item.href} icon={item.icon}>
                      {item.label}
                    </NavLink>
                  ))}
                  {isContentReady && (
                    <div className="mt-2 space-y-1">
                      {navStructure.groups.map(renderNavGroup)}
                    </div>
                  )}
                  {isContentReady && userRole === "super_admin" && (
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
              </SheetContent>
            </Sheet>
            
            <Link to="/admin" className="flex items-center gap-2">
              <span className="text-xl font-bold">Meetdup</span>
            </Link>
          </div>

          <div className="flex items-center gap-4">
            {/* Show ChapterSelector for all users */}
            {isContentReady && (
              <ChapterSelector />
            )}

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
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="hidden w-64 border-r md:block">
          <div className="p-4">
            {!isContentReady ? (
              <div className="mb-4">
                <Skeleton className="h-24 w-full" />
              </div>
            ) : isContentReady && isSuperAdmin ? (
              <div className="mb-4">
                <TenantSelectorCard />
              </div>
            ) : null}
          </div>
          
          <nav className="flex flex-col gap-1 px-4">
            {isContentReady && navStructure.quickAccess.map((item) => (
              <NavLink key={item.href} to={item.href} icon={item.icon}>
                {item.label}
              </NavLink>
            ))}
            {isContentReady && (
              <div className="mt-2 space-y-1">
                {navStructure.groups.map(renderNavGroup)}
              </div>
            )}
            {isContentReady && userRole === "super_admin" && (
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
          {isContentReady ? children : (
            <div className="flex items-center justify-center h-full">
              <Skeleton className="h-96 w-full max-w-4xl" />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
