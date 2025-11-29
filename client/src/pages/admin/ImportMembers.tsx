import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import AdminLayout from "@/components/layout/AdminLayout";
import { useTenantContext } from "@/contexts/TenantContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { queryClient } from "@/lib/queryClient";
import SelectTenantPrompt from "@/components/SelectTenantPrompt";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function ImportMembers() {
  const { effectiveTenantId, isSuperAdmin } = useTenantContext();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [importResult, setImportResult] = useState<any>(null);

  // Parse Excel file for preview
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setImportResult(null);

    try {
      // @ts-ignore - xlsx loaded via CDN or will be imported
      const XLSX = await import('xlsx');
      const reader = new FileReader();
      
      reader.onload = (event) => {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        
        // Show first 10 rows for preview
        setPreviewData(jsonData.slice(0, 10));
      };
      
      reader.readAsBinaryString(file);
    } catch (error) {
      console.error('Error reading file:', error);
      toast.error('ไม่สามารถอ่านไฟล์ได้');
    }
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile || !effectiveTenantId) {
        throw new Error("Missing file or tenant");
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('tenant_id', effectiveTenantId);

      const response = await fetch('/api/participants/import-members', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        // Throw the full error object so onError can access all fields
        throw result;
      }

      return result;
    },
    onSuccess: (data) => {
      toast.success(`นำเข้าสำเร็จ ${data.imported_count} คน!`);
      setImportResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/participants"] });
      
      // Reset file input
      setSelectedFile(null);
      setPreviewData([]);
      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    },
    onError: (error: any) => {
      console.error('Import error:', error);
      
      // Error is already the full JSON object from the API
      setImportResult(error);
      toast.error(error.message || "เกิดข้อผิดพลาดในการนำเข้าข้อมูล");
    },
  });

  const handleImport = () => {
    if (!selectedFile) {
      toast.error("กรุณาเลือกไฟล์");
      return;
    }
    importMutation.mutate();
  };

  const clearFile = () => {
    setSelectedFile(null);
    setPreviewData([]);
    setImportResult(null);
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  if (!effectiveTenantId && isSuperAdmin) {
    return (
      <AdminLayout>
        <SelectTenantPrompt />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">นำเข้าข้อมูลสมาชิก</h1>
          <p className="text-muted-foreground">
            อัปโหลดไฟล์ Excel เพื่อนำเข้าข้อมูลสมาชิกจำนวนมาก
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>อัปโหลดไฟล์ Excel</CardTitle>
            <CardDescription>
              ไฟล์ต้องมีคอลัมน์: <strong>ชื่อ - สกุล</strong>, <strong>เบอร์โทร</strong>, ชื่อเล่น, บริษัทฯ, ธุรกิจ, ผู้เชิญ
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="file-upload">เลือกไฟล์ Excel (.xlsx, .xls, .csv)</Label>
              <Input
                id="file-upload"
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
                disabled={importMutation.isPending}
                data-testid="input-file-upload"
              />
            </div>

            {selectedFile && (
              <Alert>
                <FileSpreadsheet className="h-4 w-4" />
                <AlertDescription>
                  ไฟล์ที่เลือก: <strong>{selectedFile.name}</strong> ({(selectedFile.size / 1024).toFixed(2)} KB)
                </AlertDescription>
              </Alert>
            )}

            {previewData.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-semibold">ตัวอย่างข้อมูล (10 แถวแรก)</h3>
                <div className="border rounded-md overflow-auto max-h-96">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ชื่อ - สกุล</TableHead>
                        <TableHead>ชื่อเล่น</TableHead>
                        <TableHead>บริษัทฯ</TableHead>
                        <TableHead>ธุรกิจ</TableHead>
                        <TableHead>เบอร์โทร</TableHead>
                        <TableHead>ผู้เชิญ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewData.map((row: any, index) => (
                        <TableRow key={index}>
                          <TableCell>{row['ชื่อ - สกุล'] || row['full_name_th'] || row['full_name'] || '-'}</TableCell>
                          <TableCell>{row['ชื่อเล่น'] || row['nickname'] || '-'}</TableCell>
                          <TableCell>{row['บริษัทฯ'] || row['company'] || '-'}</TableCell>
                          <TableCell>{row['ธุรกิจ'] || row['business_type'] || '-'}</TableCell>
                          <TableCell>{row['เบอร์โทร'] || row['phone'] || '-'}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {row['ผู้เชิญ'] || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleImport}
                disabled={!selectedFile || importMutation.isPending}
                data-testid="button-import"
              >
                {importMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Upload className="mr-2 h-4 w-4" />
                นำเข้าข้อมูล
              </Button>
              {selectedFile && (
                <Button
                  variant="outline"
                  onClick={clearFile}
                  disabled={importMutation.isPending}
                  data-testid="button-clear"
                >
                  ยกเลิก
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Import Results */}
        {importResult && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {importResult.success ? (
                  <>
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    นำเข้าสำเร็จ
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5 text-destructive" />
                    เกิดข้อผิดพลาด
                  </>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {importResult.success ? (
                <div className="space-y-2">
                  <p className="text-lg">
                    นำเข้าข้อมูลสมาชิก <strong>{importResult.imported_count}</strong> คน เรียบร้อยแล้ว
                  </p>
                  <p className="text-sm text-muted-foreground">
                    สมาชิกสามารถ Activate บัญชีผ่าน LINE Official Account หรือลงทะเบียนผ่านเว็บไซต์
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{importResult.message}</AlertDescription>
                  </Alert>

                  {/* Validation Errors */}
                  {importResult.validation_errors && (
                    <div className="space-y-2">
                      <h4 className="font-semibold text-sm">ข้อมูลไม่ถูกต้อง:</h4>
                      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                        {importResult.validation_errors.map((error: string, i: number) => (
                          <li key={i}>{error}</li>
                        ))}
                      </ul>
                      {importResult.total_errors > importResult.validation_errors.length && (
                        <p className="text-sm text-muted-foreground">
                          ... และอีก {importResult.total_errors - importResult.validation_errors.length} ข้อผิดพลาด
                        </p>
                      )}
                    </div>
                  )}

                  {/* Duplicate Phone Numbers */}
                  {importResult.duplicates && (
                    <div className="space-y-2">
                      <h4 className="font-semibold text-sm">เบอร์โทรซ้ำในไฟล์:</h4>
                      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                        {importResult.duplicates.map((dup: string, i: number) => (
                          <li key={i}>{dup}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Conflicts with Existing Data */}
                  {importResult.conflicts && (
                    <div className="space-y-2">
                      <h4 className="font-semibold text-sm">เบอร์โทรที่มีอยู่แล้วในระบบ:</h4>
                      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                        {importResult.conflicts.map((conflict: string, i: number) => (
                          <li key={i}>{conflict}</li>
                        ))}
                      </ul>
                      {importResult.total_conflicts > importResult.conflicts.length && (
                        <p className="text-sm text-muted-foreground">
                          ... และอีก {importResult.total_conflicts - importResult.conflicts.length} รายการ
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>วิธีใช้งาน</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <ol className="list-decimal list-inside space-y-2">
              <li>
                <strong>เตรียมไฟล์ Excel</strong> ที่มีคอลัมน์:
                <ul className="list-disc list-inside ml-6 mt-1 space-y-1">
                  <li><strong>ชื่อ - สกุล</strong> (บังคับ)</li>
                  <li><strong>เบอร์โทร</strong> (บังคับ - ใช้เป็น unique identifier)</li>
                  <li>ชื่อเล่น, บริษัทฯ, ธุรกิจ, ผู้เชิญ (ตัวเลือก)</li>
                </ul>
              </li>
              <li>อัปโหลดไฟล์และตรวจสอบตัวอย่างข้อมูล</li>
              <li>กดปุ่ม "นำเข้าข้อมูล" เพื่อบันทึกลงระบบ</li>
              <li>
                ข้อมูลจะถูกนำเข้าเป็น <strong>สมาชิก (Member)</strong> โดยอัตโนมัติ
              </li>
              <li>
                สมาชิกสามารถ Activate บัญชีด้วยตัวเองผ่าน:
                <ul className="list-disc list-inside ml-6 mt-1">
                  <li>LINE Official Account (พิมพ์ "ลงทะเบียน")</li>
                  <li>หน้าเว็บลงทะเบียน (ใช้เบอร์โทรที่นำเข้า)</li>
                </ul>
              </li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
