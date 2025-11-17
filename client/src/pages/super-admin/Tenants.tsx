import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AdminLayout from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import AddTenantDialog from "@/components/dialogs/AddTenantDialog";
import EditTenantDialog from "@/components/dialogs/EditTenantDialog";
import QRCodeDialog from "@/components/dialogs/QRCodeDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Trash2, ExternalLink, QrCode } from "lucide-react";
import { toast } from "sonner";

export default function Tenants() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showQRDialog, setShowQRDialog] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<any>(null);

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    try {
      const { data, error } = await supabase
        .from("tenants")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTenants(data || []);
    } catch (error: any) {
      toast.error("Failed to load tenants");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (tenant: any) => {
    setSelectedTenant(tenant);
    setShowEditDialog(true);
  };

  const handleDelete = (tenant: any) => {
    setSelectedTenant(tenant);
    setShowDeleteDialog(true);
  };

  const handleShowQR = (tenant: any) => {
    setSelectedTenant(tenant);
    setShowQRDialog(true);
  };

  const confirmDelete = async () => {
    if (!selectedTenant) return;

    try {
      const { error } = await supabase
        .from("tenants")
        .delete()
        .eq("tenant_id", selectedTenant.tenant_id);

      if (error) throw error;

      toast.success("ลบ tenant สำเร็จ");
      fetchTenants();
      setShowDeleteDialog(false);
    } catch (error: any) {
      toast.error("เกิดข้อผิดพลาด: " + error.message);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Tenants</h1>
            <p className="text-muted-foreground">Manage Meetdup chapters</p>
          </div>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            เพิ่ม Tenant
          </Button>
        </div>

        <AddTenantDialog
          open={showAddDialog}
          onOpenChange={setShowAddDialog}
          onSuccess={fetchTenants}
        />

        <EditTenantDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          onSuccess={fetchTenants}
          tenant={selectedTenant}
        />

        <QRCodeDialog
          open={showQRDialog}
          onOpenChange={setShowQRDialog}
          subdomain={selectedTenant?.subdomain || ""}
          tenantName={selectedTenant?.tenant_name || ""}
        />

        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>ยืนยันการลบ</AlertDialogTitle>
              <AlertDialogDescription>
                คุณแน่ใจหรือไม่ที่จะลบ tenant "{selectedTenant?.tenant_name}"? การกระทำนี้ไม่สามารถย้อนกลับได้
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                ลบ
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Card>
          <CardHeader>
            <CardTitle>All Tenants</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Chapter Name</TableHead>
                    <TableHead>Subdomain</TableHead>
                    <TableHead>LINE Bot ID</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenants.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No tenants found
                      </TableCell>
                    </TableRow>
                  ) : (
                    tenants.map((tenant) => (
                      <TableRow key={tenant.tenant_id}>
                        <TableCell className="font-medium">{tenant.tenant_name}</TableCell>
                        <TableCell>{tenant.subdomain}</TableCell>
                        <TableCell className="text-muted-foreground">{tenant.line_bot_basic_id || "-"}</TableCell>
                        <TableCell>
                          {new Date(tenant.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleShowQR(tenant)}
                              title="QR Code"
                            >
                              <QrCode className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              asChild
                              title="ดู Public Profile"
                            >
                              <Link to={`/chapter/${tenant.subdomain}`} target="_blank">
                                <ExternalLink className="h-4 w-4" />
                              </Link>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(tenant)}
                              title="แก้ไข"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(tenant)}
                              title="ลบ"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
