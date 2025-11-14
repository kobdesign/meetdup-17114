import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ArrowLeft, Building2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

const createChapterSchema = z.object({
  tenant_name: z.string().min(3, "ชื่อ Chapter ต้องมีอย่างน้อย 3 ตัวอักษร"),
  subdomain: z.string()
    .min(3, "Subdomain ต้องมีอย่างน้อย 3 ตัวอักษร")
    .regex(/^[a-z0-9-]+$/, "ใช้ได้เฉพาะตัวอักษร a-z, 0-9 และ - เท่านั้น"),
});

type CreateChapterForm = z.infer<typeof createChapterSchema>;

export default function CreateChapter() {
  const navigate = useNavigate();
  const [creatingChapter, setCreatingChapter] = useState(false);

  const form = useForm<CreateChapterForm>({
    resolver: zodResolver(createChapterSchema),
    defaultValues: {
      tenant_name: "",
      subdomain: "",
    },
  });

  const createChapterMutation = useMutation({
    mutationFn: async (data: CreateChapterForm) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("ไม่พบ session");

      return apiRequest(
        "/api/chapters/create",
        "POST",
        data,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );
    },
    onSuccess: () => {
      toast.success("สร้าง Chapter สำเร็จ!");
      queryClient.invalidateQueries({ queryKey: ["/api/user-tenant-info"] });
      setTimeout(() => {
        navigate("/admin");
      }, 1000);
    },
    onError: (error: any) => {
      toast.error(error.message || "เกิดข้อผิดพลาดในการสร้าง Chapter");
    },
  });

  const onSubmit = async (data: CreateChapterForm) => {
    setCreatingChapter(true);
    try {
      await createChapterMutation.mutateAsync(data);
    } finally {
      setCreatingChapter(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30 p-4">
      <div className="w-full max-w-2xl">
        <Button
          variant="ghost"
          onClick={() => navigate("/welcome")}
          className="mb-4"
          data-testid="button-back"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          ย้อนกลับ
        </Button>

        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">สร้าง Chapter ใหม่</CardTitle>
            <CardDescription>
              กรอกข้อมูล Chapter ของคุณ คุณจะกลายเป็น Admin ทันทีหลังจากสร้าง
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="tenant_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ชื่อ Chapter</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="BNI Bangkok Central"
                          {...field}
                          data-testid="input-chapter-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="subdomain"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subdomain (ชื่อเฉพาะของ Chapter)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="bangkok-central"
                          {...field}
                          onChange={(e) => {
                            const value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
                            field.onChange(value);
                          }}
                          data-testid="input-subdomain"
                        />
                      </FormControl>
                      <FormMessage />
                      <p className="text-xs text-muted-foreground">
                        ใช้สำหรับสร้าง URL เฉพาะของ Chapter: /chapter/{field.value || 'subdomain'}
                      </p>
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={creatingChapter}
                  data-testid="button-submit-create-chapter"
                >
                  {creatingChapter && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  สร้าง Chapter
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
