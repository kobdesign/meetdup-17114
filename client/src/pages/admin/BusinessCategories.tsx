import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Loader2, Building2, Users, GripVertical } from "lucide-react";

interface BusinessCategory {
  category_code: string;
  name_th: string;
  name_en: string | null;
  description_th: string | null;
  description_en: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

interface CategoryFormData {
  category_code: string;
  name_th: string;
  name_en: string;
  description_th: string;
  sort_order: number;
  is_active: boolean;
}

const defaultFormData: CategoryFormData = {
  category_code: "",
  name_th: "",
  name_en: "",
  description_th: "",
  sort_order: 0,
  is_active: true,
};

export default function BusinessCategories() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<BusinessCategory | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<BusinessCategory | null>(null);
  const [formData, setFormData] = useState<CategoryFormData>(defaultFormData);
  const [showInactive, setShowInactive] = useState(false);

  const { data: categoriesData, isLoading } = useQuery<{ categories: BusinessCategory[] }>({
    queryKey: ["/api/business-categories", showInactive ? "all" : "active"],
    queryFn: async () => {
      const response = await fetch(`/api/business-categories?includeInactive=${showInactive}`);
      return response.json();
    }
  });

  const generateCodeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("/api/business-categories/generate-code", "POST");
      return response.json();
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: CategoryFormData) => {
      const response = await apiRequest("/api/business-categories", "POST", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business-categories"] });
      setIsDialogOpen(false);
      setFormData(defaultFormData);
      toast({ title: "สร้างหมวดหมู่สำเร็จ" });
    },
    onError: (error: any) => {
      toast({ title: "เกิดข้อผิดพลาด", description: error.message, variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ code, data }: { code: string; data: Partial<CategoryFormData> }) => {
      const response = await apiRequest(`/api/business-categories/${code}`, "PUT", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business-categories"] });
      setIsDialogOpen(false);
      setEditingCategory(null);
      setFormData(defaultFormData);
      toast({ title: "อัปเดตหมวดหมู่สำเร็จ" });
    },
    onError: (error: any) => {
      toast({ title: "เกิดข้อผิดพลาด", description: error.message, variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (code: string) => {
      const response = await apiRequest(`/api/business-categories/${code}`, "DELETE");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business-categories"] });
      setIsDeleteDialogOpen(false);
      setDeletingCategory(null);
      toast({ title: "ลบหมวดหมู่สำเร็จ" });
    },
    onError: (error: any) => {
      toast({ title: "ไม่สามารถลบได้", description: error.message, variant: "destructive" });
    }
  });

  const handleAdd = async () => {
    setEditingCategory(null);
    const result = await generateCodeMutation.mutateAsync();
    setFormData({
      ...defaultFormData,
      category_code: result.code,
      sort_order: (categoriesData?.categories?.length || 0) + 1,
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (category: BusinessCategory) => {
    setEditingCategory(category);
    setFormData({
      category_code: category.category_code,
      name_th: category.name_th,
      name_en: category.name_en || "",
      description_th: category.description_th || "",
      sort_order: category.sort_order,
      is_active: category.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (category: BusinessCategory) => {
    setDeletingCategory(category);
    setIsDeleteDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.name_th.trim()) {
      toast({ title: "กรุณากรอกชื่อหมวดหมู่ภาษาไทย", variant: "destructive" });
      return;
    }

    if (editingCategory) {
      updateMutation.mutate({
        code: editingCategory.category_code,
        data: {
          name_th: formData.name_th,
          name_en: formData.name_en || null,
          description_th: formData.description_th || null,
          sort_order: formData.sort_order,
          is_active: formData.is_active,
        }
      });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleConfirmDelete = () => {
    if (deletingCategory) {
      deleteMutation.mutate(deletingCategory.category_code);
    }
  };

  const categories = categoriesData?.categories || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6" />
            จัดการประเภทธุรกิจ
          </h1>
          <p className="text-muted-foreground mt-1">
            เพิ่ม แก้ไข หรือลบหมวดหมู่ประเภทธุรกิจสำหรับสมาชิก
          </p>
        </div>
        <Button onClick={handleAdd} data-testid="button-add-category">
          <Plus className="h-4 w-4 mr-2" />
          เพิ่มหมวดหมู่
        </Button>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <Switch
          id="show-inactive"
          checked={showInactive}
          onCheckedChange={setShowInactive}
        />
        <Label htmlFor="show-inactive" className="text-sm text-muted-foreground">
          แสดงหมวดหมู่ที่ปิดใช้งาน
        </Label>
      </div>

      <div className="space-y-2">
        {categories.map((category) => (
          <Card 
            key={category.category_code} 
            className={`${!category.is_active ? "opacity-60" : ""}`}
            data-testid={`card-category-${category.category_code}`}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <GripVertical className="h-4 w-4" />
                  <Badge variant="outline" className="font-mono">
                    {category.category_code}
                  </Badge>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{category.name_th}</span>
                    {category.name_en && (
                      <span className="text-sm text-muted-foreground">({category.name_en})</span>
                    )}
                    {!category.is_active && (
                      <Badge variant="secondary">ปิดใช้งาน</Badge>
                    )}
                  </div>
                  {category.description_th && (
                    <p className="text-sm text-muted-foreground truncate">{category.description_th}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(category)}
                    data-testid={`button-edit-${category.category_code}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(category)}
                    data-testid={`button-delete-${category.category_code}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {categories.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              ยังไม่มีหมวดหมู่ กดปุ่ม "เพิ่มหมวดหมู่" เพื่อเริ่มต้น
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? "แก้ไขหมวดหมู่" : "เพิ่มหมวดหมู่ใหม่"}
            </DialogTitle>
            <DialogDescription>
              กรอกข้อมูลหมวดหมู่ประเภทธุรกิจ
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>รหัสหมวดหมู่</Label>
                <Input
                  value={formData.category_code}
                  onChange={(e) => setFormData({ ...formData, category_code: e.target.value })}
                  disabled={!!editingCategory}
                  placeholder="เช่น 26"
                  data-testid="input-category-code"
                />
              </div>
              <div className="space-y-2">
                <Label>ลำดับการแสดง</Label>
                <Input
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                  data-testid="input-sort-order"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>ชื่อภาษาไทย *</Label>
              <Input
                value={formData.name_th}
                onChange={(e) => setFormData({ ...formData, name_th: e.target.value })}
                placeholder="เช่น อสังหาริมทรัพย์"
                data-testid="input-name-th"
              />
            </div>

            <div className="space-y-2">
              <Label>ชื่อภาษาอังกฤษ</Label>
              <Input
                value={formData.name_en}
                onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                placeholder="e.g. Real Estate"
                data-testid="input-name-en"
              />
            </div>

            <div className="space-y-2">
              <Label>คำอธิบาย</Label>
              <Input
                value={formData.description_th}
                onChange={(e) => setFormData({ ...formData, description_th: e.target.value })}
                placeholder="คำอธิบายเพิ่มเติม (ไม่บังคับ)"
                data-testid="input-description"
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="is-active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is-active">เปิดใช้งาน</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-category"
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingCategory ? "บันทึก" : "เพิ่ม"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบ</AlertDialogTitle>
            <AlertDialogDescription>
              คุณต้องการลบหมวดหมู่ "{deletingCategory?.name_th}" หรือไม่?
              <br />
              <span className="text-destructive">
                หากมีสมาชิกที่ใช้หมวดหมู่นี้อยู่ จะไม่สามารถลบได้
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              ลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
