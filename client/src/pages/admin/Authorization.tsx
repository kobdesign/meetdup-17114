import { useEffect, useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Shield, UserPlus, Trash2, Search, Pencil } from "lucide-react";
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
}

interface Tenant {
  tenant_id: string;
  name: string;
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

      // Load user emails from auth.users via edge function
      const userIds = [...new Set(rolesData?.map(r => r.user_id) || [])];
      const usersMap = new Map<string, string>();

      for (const userId of userIds) {
        try {
          const { data: userData, error: userError } = await supabase.functions.invoke('manage-user-roles', {
            body: { action: 'get_user_by_id', userId }
          });
          
          if (!userError && userData?.user?.email) {
            usersMap.set(userId, userData.user.email);
          }
        } catch (error) {
          console.error('Error fetching user:', error);
        }
      }

      // Load tenants
      const { data: tenantsData, error: tenantsError } = await supabase
        .from("tenants")
        .select("tenant_id, name")
        .order("name");

      if (tenantsError) throw tenantsError;
      setTenants(tenantsData || []);

      // Create tenants map
      const tenantsMap = new Map(tenantsData?.map(t => [t.tenant_id, t.name]) || []);

      // Merge data
      const enrichedRoles = rolesData?.map(role => ({
        ...role,
        user_email: usersMap.get(role.user_id) || "Unknown",
        tenant_name: role.tenant_id ? tenantsMap.get(role.tenant_id) : null,
      })) || [];

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
        r.tenant_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredRoles(filtered);
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
      // Find user by email via edge function
      const { data, error: findError } = await supabase.functions.invoke('manage-user-roles', {
        body: { action: 'get_user_by_email', email: newUserEmail }
      });

      if (findError) throw findError;

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
      chapter_member: { variant: "secondary", label: "Chapter Member" },
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
                      <SelectItem value="chapter_member">Chapter Member</SelectItem>
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
                            {tenant.name}
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
              <SelectItem value="chapter_member">Chapter Member</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              รายการสิทธิ์ผู้ใช้ ({filteredRoles.length})
            </CardTitle>
            <CardDescription>จัดการสิทธิ์และบทบาทของผู้ใช้ในระบบ</CardDescription>
          </CardHeader>
          <CardContent>
            {filteredRoles.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchTerm || roleFilter !== "all"
                  ? "ไม่พบข้อมูลที่ตรงกับเงื่อนไข"
                  : "ยังไม่มีสิทธิ์ผู้ใช้ในระบบ"}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>อีเมล</TableHead>
                    <TableHead>บทบาท</TableHead>
                    <TableHead>Chapter</TableHead>
                    <TableHead>วันที่เพิ่ม</TableHead>
                    <TableHead className="text-right">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRoles.map((role) => (
                    <TableRow key={role.id}>
                      <TableCell className="font-medium">{role.user_email}</TableCell>
                      <TableCell>{getRoleBadge(role.role)}</TableCell>
                      <TableCell>{role.tenant_name || "-"}</TableCell>
                      <TableCell>
                        {new Date(role.created_at).toLocaleDateString("th-TH", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => startEditRole(role)}
                            disabled={role.user_id === currentUserId}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>ยืนยันการลบสิทธิ์</AlertDialogTitle>
                                <AlertDialogDescription>
                                  คุณต้องการลบสิทธิ์ {role.role} ของ {role.user_email} ใช่หรือไม่?
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
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

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
                    <SelectItem value="chapter_member">Chapter Member</SelectItem>
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
                          {tenant.name}
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
