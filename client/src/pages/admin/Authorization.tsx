import { useEffect, useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Shield, UserPlus, Trash2, Search, Pencil, User } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface UserRole {
  id: string;
  user_id: string;
  role: string;
  tenant_id: string | null;
  created_at: string;
  user_email?: string;
  tenant_name?: string;
  full_name?: string | null;
  avatar_url?: string | null;
  last_sign_in_at?: string | null;
}

interface Tenant {
  tenant_id: string;
  tenant_name: string;
}

export default function Authorization() {
  const [loading, setLoading] = useState(true);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [filteredRoles, setFilteredRoles] = useState<UserRole[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState<string>("chapter_admin");
  const [newUserTenant, setNewUserTenant] = useState<string>("");
  const [adding, setAdding] = useState(false);
  
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingRole, setEditingRole] = useState<UserRole | null>(null);
  const [editRole, setEditRole] = useState<string>("");
  const [editTenant, setEditTenant] = useState<string>("");
  const [updating, setUpdating] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    loadCurrentUser();
  }, []);

  const loadCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);
  };

  useEffect(() => {
    filterRoles();
  }, [userRoles, searchTerm, roleFilter]);

  const loadData = async () => {
    try {
      // Check if current user is super admin
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: currentUserRoles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const isSuperAdmin = currentUserRoles?.some(r => r.role === "super_admin");
      
      if (!isSuperAdmin) {
        toast.error("คุณไม่มีสิทธิ์เข้าถึงหน้านี้");
        return;
      }

      // Load all user roles
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("*")
        .order("created_at", { ascending: false });

      if (rolesError) throw rolesError;

      // Load user data from auth.users and profiles
      const userIds = [...new Set(rolesData?.map(r => r.user_id) || [])];
      const usersMap = new Map<string, any>();

      const { data: { session } } = await supabase.auth.getSession();

      // Fetch auth data (email, last_sign_in_at) from API
      for (const userId of userIds) {
        try {
          const response = await fetch(`/api/users/${userId}`, {
            headers: {
              "Authorization": `Bearer ${session?.access_token}`
            }
          });
          
          if (response.ok) {
            const userData = await response.json();
            if (userData?.user) {
              usersMap.set(userId, {
                email: userData.user.email,
                last_sign_in_at: userData.user.last_sign_in_at,
              });
            }
          }
        } catch (error) {
          console.error('Error fetching user:', error);
        }
      }

      // Fetch profiles data (full_name, avatar_url)
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", userIds);

      const profilesMap = new Map(
        profilesData?.map(p => [p.id, { full_name: p.full_name, avatar_url: p.avatar_url }]) || []
      );

      // Load tenants
      const { data: tenantsData, error: tenantsError } = await supabase
        .from("tenants")
        .select("tenant_id, tenant_name")
        .order("tenant_name");

      if (tenantsError) throw tenantsError;
      setTenants(tenantsData || []);

      // Create tenants map
      const tenantsMap = new Map(tenantsData?.map(t => [t.tenant_id, t.tenant_name]) || []);

      // Merge data
      const enrichedRoles = rolesData?.map(role => {
        const authData = usersMap.get(role.user_id);
        const profileData = profilesMap.get(role.user_id);
        
        return {
          ...role,
          user_email: authData?.email || "Unknown",
          last_sign_in_at: authData?.last_sign_in_at || null,
          full_name: profileData?.full_name || null,
          avatar_url: profileData?.avatar_url || null,
          tenant_name: role.tenant_id ? tenantsMap.get(role.tenant_id) : null,
        };
      }) || [];

      setUserRoles(enrichedRoles);
    } catch (error: any) {
      toast.error("เกิดข้อผิดพลาดในการโหลดข้อมูล: " + error.message);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const filterRoles = () => {
    let filtered = [...userRoles];

    if (roleFilter !== "all") {
      filtered = filtered.filter(r => r.role === roleFilter);
    }

    if (searchTerm) {
      filtered = filtered.filter(r =>
        r.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.tenant_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredRoles(filtered);
  };

  // Group roles by user for display
  const groupedByUser = filteredRoles.reduce((acc, role) => {
    const userId = role.user_id;
    if (!acc[userId]) {
      acc[userId] = {
        user_id: userId,
        user_email: role.user_email,
        full_name: role.full_name,
        avatar_url: role.avatar_url,
        last_sign_in_at: role.last_sign_in_at,
        roles: []
      };
    }
    acc[userId].roles.push(role);
    return acc;
  }, {} as Record<string, { 
    user_id: string; 
    user_email: string; 
    full_name?: string | null;
    avatar_url?: string | null;
    last_sign_in_at?: string | null;
    roles: UserRole[] 
  }>);

  const groupedUsers = Object.values(groupedByUser);

  // Helper function to get user initials
  const getUserInitials = (fullName?: string | null, email?: string) => {
    if (fullName) {
      const parts = fullName.trim().split(/\s+/);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return fullName.substring(0, 2).toUpperCase();
    }
    if (email) {
      return email.substring(0, 2).toUpperCase();
    }
    return "??";
  };

  // Helper function to format last sign in
  const formatLastSignIn = (lastSignIn?: string | null) => {
    if (!lastSignIn) return null;
    
    const date = new Date(lastSignIn);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return "วันนี้";
    } else if (diffDays === 1) {
      return "เมื่อวาน";
    } else if (diffDays < 7) {
      return `${diffDays} วันที่แล้ว`;
    } else {
      return date.toLocaleDateString("th-TH", {
        year: "numeric",
        month: "short",
        day: "numeric"
      });
    }
  };

  const handleAddRole = async () => {
    if (!newUserEmail || !newUserRole) {
      toast.error("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }

    if (newUserRole !== "super_admin" && !newUserTenant) {
      toast.error("กรุณาเลือก Chapter");
      return;
    }

    setAdding(true);
    try {
      // Find user by email via API
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`/api/users/by-email/${encodeURIComponent(newUserEmail)}`, {
        headers: {
          "Authorization": `Bearer ${session?.access_token}`
        }
      });

      if (!response.ok) {
        toast.error("ไม่พบผู้ใช้ด้วยอีเมลนี้");
        return;
      }

      const data = await response.json();

      if (!data?.user) {
        toast.error("ไม่พบผู้ใช้ด้วยอีเมลนี้");
        return;
      }

      const targetUser = data.user;

      // Insert role
      const { error: insertError } = await supabase
        .from("user_roles")
        .insert({
          user_id: targetUser.id,
          role: newUserRole as any,
          tenant_id: newUserRole === "super_admin" ? null : newUserTenant,
        });

      if (insertError) throw insertError;

      toast.success("เพิ่มสิทธิ์สำเร็จ");
      setShowAddDialog(false);
      setNewUserEmail("");
      setNewUserRole("chapter_admin");
      setNewUserTenant("");
      loadData();
    } catch (error: any) {
      toast.error("เกิดข้อผิดพลาด: " + error.message);
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    try {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("id", roleId);

      if (error) throw error;

      toast.success("ลบสิทธิ์สำเร็จ");
      loadData();
    } catch (error: any) {
      toast.error("เกิดข้อผิดพลาด: " + error.message);
    }
  };

  const startEditRole = (role: UserRole) => {
    if (role.user_id === currentUserId) {
      toast.error("คุณไม่สามารถแก้ไขสิทธิ์ของตัวเองได้");
      return;
    }
    setEditingRole(role);
    setEditRole(role.role);
    setEditTenant(role.tenant_id || "");
    setShowEditDialog(true);
  };

  const handleUpdateRole = async () => {
    if (!editingRole || !editRole) {
      toast.error("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }

    if (editRole !== "super_admin" && !editTenant) {
      toast.error("กรุณาเลือก Chapter");
      return;
    }

    setUpdating(true);
    try {
      const { error } = await supabase
        .from("user_roles")
        .update({
          role: editRole as any,
          tenant_id: editRole === "super_admin" ? null : editTenant,
        })
        .eq("id", editingRole.id);

      if (error) throw error;

      toast.success("แก้ไขสิทธิ์สำเร็จ");
      setShowEditDialog(false);
      setEditingRole(null);
      setEditRole("");
      setEditTenant("");
      loadData();
    } catch (error: any) {
      toast.error("เกิดข้อผิดพลาด: " + error.message);
    } finally {
      setUpdating(false);
    }
  };

  const getRoleBadge = (role: string) => {
    const variants: Record<string, { variant: any; label: string }> = {
      super_admin: { variant: "destructive", label: "Super Admin" },
      chapter_admin: { variant: "default", label: "Chapter Admin" },
      member: { variant: "secondary", label: "Member" },
    };

    const config = variants[role] || { variant: "secondary", label: role };

    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="text-center py-8 text-muted-foreground">กำลังโหลด...</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">จัดการสิทธิ์ผู้ใช้</h1>
            <p className="text-muted-foreground">กำหนดและจัดการสิทธิ์การเข้าถึงระบบ</p>
          </div>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                เพิ่มสิทธิ์ผู้ใช้
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>เพิ่มสิทธิ์ผู้ใช้</DialogTitle>
                <DialogDescription>
                  กำหนดสิทธิ์ให้กับผู้ใช้ในระบบ
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">อีเมลผู้ใช้</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="user@example.com"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">บทบาท</Label>
                  <Select value={newUserRole} onValueChange={setNewUserRole}>
                    <SelectTrigger id="role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="super_admin">Super Admin</SelectItem>
                      <SelectItem value="chapter_admin">Chapter Admin</SelectItem>
                      <SelectItem value="member">Member</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {newUserRole !== "super_admin" && (
                  <div className="space-y-2">
                    <Label htmlFor="tenant">Chapter</Label>
                    <Select value={newUserTenant} onValueChange={setNewUserTenant}>
                      <SelectTrigger id="tenant">
                        <SelectValue placeholder="เลือก Chapter" />
                      </SelectTrigger>
                      <SelectContent>
                        {tenants.map((tenant) => (
                          <SelectItem key={tenant.tenant_id} value={tenant.tenant_id}>
                            {tenant.tenant_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                  ยกเลิก
                </Button>
                <Button onClick={handleAddRole} disabled={adding}>
                  {adding ? "กำลังเพิ่ม..." : "เพิ่มสิทธิ์"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="ค้นหาอีเมลหรือ Chapter..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกบทบาท</SelectItem>
              <SelectItem value="super_admin">Super Admin</SelectItem>
              <SelectItem value="chapter_admin">Chapter Admin</SelectItem>
              <SelectItem value="member">Member</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">รายการผู้ใช้ ({groupedUsers.length})</h2>
              <p className="text-sm text-muted-foreground">แสดงผู้ใช้และบทบาทในแต่ละ Chapter</p>
            </div>
          </div>

          {filteredRoles.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8 text-muted-foreground">
                {searchTerm || roleFilter !== "all"
                  ? "ไม่พบข้อมูลที่ตรงกับเงื่อนไข"
                  : "ยังไม่มีสิทธิ์ผู้ใช้ในระบบ"}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {groupedUsers.map((userGroup) => (
                <Card key={userGroup.user_id}>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={userGroup.avatar_url || undefined} />
                        <AvatarFallback>
                          {getUserInitials(userGroup.full_name, userGroup.user_email)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base truncate">
                          {userGroup.full_name || userGroup.user_email}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2 flex-wrap">
                          <span className="truncate">
                            {userGroup.full_name ? userGroup.user_email : `${userGroup.roles.length} บทบาท`}
                          </span>
                          {formatLastSignIn(userGroup.last_sign_in_at) && (
                            <>
                              <span>•</span>
                              <span>เข้าสู่ระบบ{formatLastSignIn(userGroup.last_sign_in_at)}</span>
                            </>
                          )}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {userGroup.roles.map((role) => (
                        <div 
                          key={role.id} 
                          className="flex items-center justify-between p-3 border rounded-md hover-elevate"
                          data-testid={`user-role-${role.id}`}
                        >
                          <div className="flex items-center gap-4 flex-1">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                {getRoleBadge(role.role)}
                                {role.tenant_name && (
                                  <>
                                    <span className="text-muted-foreground">•</span>
                                    <span className="text-sm font-medium">{role.tenant_name}</span>
                                  </>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground">
                                เพิ่มเมื่อ {new Date(role.created_at).toLocaleDateString("th-TH", {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => startEditRole(role)}
                              disabled={role.user_id === currentUserId}
                              data-testid={`button-edit-role-${role.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button 
                                  size="sm" 
                                  variant="destructive" 
                                  disabled={role.user_id === currentUserId}
                                  data-testid={`button-delete-role-${role.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>ยืนยันการลบสิทธิ์</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    คุณต้องการลบสิทธิ์ {role.role} ของ {role.user_email} 
                                    {role.tenant_name && ` ใน Chapter ${role.tenant_name}`} ใช่หรือไม่?
                                    การดำเนินการนี้ไม่สามารถย้อนกลับได้
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteRole(role.id)}
                                    className="bg-destructive hover:bg-destructive/90"
                                  >
                                    ลบสิทธิ์
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Edit Role Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>แก้ไขสิทธิ์ผู้ใช้</DialogTitle>
              <DialogDescription>
                แก้ไขบทบาทและ Chapter ของ {editingRole?.user_email}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-role">บทบาท</Label>
                <Select value={editRole} onValueChange={setEditRole}>
                  <SelectTrigger id="edit-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                    <SelectItem value="chapter_admin">Chapter Admin</SelectItem>
                    <SelectItem value="member">Member</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editRole !== "super_admin" && (
                <div className="space-y-2">
                  <Label htmlFor="edit-tenant">Chapter</Label>
                  <Select value={editTenant} onValueChange={setEditTenant}>
                    <SelectTrigger id="edit-tenant">
                      <SelectValue placeholder="เลือก Chapter" />
                    </SelectTrigger>
                    <SelectContent>
                      {tenants.map((tenant) => (
                        <SelectItem key={tenant.tenant_id} value={tenant.tenant_id}>
                          {tenant.tenant_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                ยกเลิก
              </Button>
              <Button onClick={handleUpdateRole} disabled={updating}>
                {updating ? "กำลังบันทึก..." : "บันทึก"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
