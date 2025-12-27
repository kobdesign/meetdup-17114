import { useState, useMemo, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Plus, 
  Trash2, 
  FileSpreadsheet, 
  Calculator,
  Building2,
  Hammer,
  Zap,
  Droplets,
  PaintBucket,
  ArrowLeft,
  Package,
  Search,
  Upload,
  X,
  Sparkles,
  FileImage,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { toast } from "sonner";

interface WorkCategory {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
}

interface WorkItem {
  id: string;
  categoryId: string;
  name: string;
  unit: string;
  unitPrice: number;
}

interface BOQLine {
  id: string;
  workItemId: string;
  workItem: WorkItem;
  quantity: number;
  totalPrice: number;
}

interface AISuggestion {
  itemId: string;
  itemName: string;
  quantity: number;
  reason: string;
  selected: boolean;
}

interface UploadedFile {
  id: string;
  file: File;
  preview?: string;
  type: 'image' | 'pdf';
}

const workCategories: WorkCategory[] = [
  { id: "structure", name: "งานโครงสร้าง", icon: <Building2 className="h-4 w-4" />, color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  { id: "architecture", name: "งานสถาปัตยกรรม", icon: <Hammer className="h-4 w-4" />, color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" },
  { id: "electrical", name: "งานไฟฟ้า", icon: <Zap className="h-4 w-4" />, color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
  { id: "plumbing", name: "งานประปา", icon: <Droplets className="h-4 w-4" />, color: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200" },
  { id: "finishing", name: "งานตกแต่ง", icon: <PaintBucket className="h-4 w-4" />, color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
];

const workItems: WorkItem[] = [
  { id: "str-001", categoryId: "structure", name: "คอนกรีตผสมเสร็จ 240 กก./ตร.ซม.", unit: "ลบ.ม.", unitPrice: 2800 },
  { id: "str-002", categoryId: "structure", name: "เหล็กเส้นกลม SR24 ขนาด 6 มม.", unit: "กก.", unitPrice: 28 },
  { id: "str-003", categoryId: "structure", name: "เหล็กข้ออ้อย SD40 ขนาด 12 มม.", unit: "กก.", unitPrice: 32 },
  { id: "str-004", categoryId: "structure", name: "เหล็กข้ออ้อย SD40 ขนาด 16 มม.", unit: "กก.", unitPrice: 32 },
  { id: "str-005", categoryId: "structure", name: "เหล็กข้ออ้อย SD40 ขนาด 20 มม.", unit: "กก.", unitPrice: 32 },
  { id: "str-006", categoryId: "structure", name: "ไม้แบบหล่อคอนกรีต", unit: "ตร.ม.", unitPrice: 350 },
  { id: "str-007", categoryId: "structure", name: "เสาเข็มตอก ขนาด 0.22x0.22 ม. ยาว 18 ม.", unit: "ต้น", unitPrice: 4500 },
  { id: "str-008", categoryId: "structure", name: "เสาเข็มเจาะ ขนาด 0.35 ม.", unit: "ม.", unitPrice: 1200 },
  
  { id: "arc-001", categoryId: "architecture", name: "ผนังก่ออิฐมอญ หนา 7 ซม.", unit: "ตร.ม.", unitPrice: 180 },
  { id: "arc-002", categoryId: "architecture", name: "ผนังก่ออิฐมอญ หนา 10 ซม.", unit: "ตร.ม.", unitPrice: 220 },
  { id: "arc-003", categoryId: "architecture", name: "ผนังก่อคอนกรีตบล็อก หนา 7 ซม.", unit: "ตร.ม.", unitPrice: 150 },
  { id: "arc-004", categoryId: "architecture", name: "ฉาบปูนผนัง (2 ด้าน)", unit: "ตร.ม.", unitPrice: 180 },
  { id: "arc-005", categoryId: "architecture", name: "กระเบื้องปูพื้น 60x60 ซม.", unit: "ตร.ม.", unitPrice: 450 },
  { id: "arc-006", categoryId: "architecture", name: "กระเบื้องผนังห้องน้ำ 30x60 ซม.", unit: "ตร.ม.", unitPrice: 550 },
  { id: "arc-007", categoryId: "architecture", name: "หน้าต่างอลูมิเนียม พร้อมกระจก", unit: "ตร.ม.", unitPrice: 2500 },
  { id: "arc-008", categoryId: "architecture", name: "ประตูไม้สัก พร้อมวงกบ", unit: "บาน", unitPrice: 8500 },
  { id: "arc-009", categoryId: "architecture", name: "ประตู UPVC พร้อมวงกบ", unit: "บาน", unitPrice: 4500 },
  { id: "arc-010", categoryId: "architecture", name: "หลังคาเมทัลชีท พร้อมโครงเหล็ก", unit: "ตร.ม.", unitPrice: 850 },
  
  { id: "elec-001", categoryId: "electrical", name: "สายไฟ THW 1x2.5 ตร.มม.", unit: "ม.", unitPrice: 15 },
  { id: "elec-002", categoryId: "electrical", name: "สายไฟ THW 1x4 ตร.มม.", unit: "ม.", unitPrice: 22 },
  { id: "elec-003", categoryId: "electrical", name: "สายไฟ THW 1x6 ตร.มม.", unit: "ม.", unitPrice: 35 },
  { id: "elec-004", categoryId: "electrical", name: "ท่อร้อยสาย PVC 3/4 นิ้ว", unit: "ม.", unitPrice: 18 },
  { id: "elec-005", categoryId: "electrical", name: "เต้ารับคู่พร้อมฝาครอบ", unit: "ชุด", unitPrice: 180 },
  { id: "elec-006", categoryId: "electrical", name: "สวิตซ์ไฟพร้อมฝาครอบ", unit: "ชุด", unitPrice: 150 },
  { id: "elec-007", categoryId: "electrical", name: "โคมไฟดาวน์ไลท์ LED 12W", unit: "ชุด", unitPrice: 350 },
  { id: "elec-008", categoryId: "electrical", name: "ตู้ MDB 12 ช่อง พร้อมเบรกเกอร์", unit: "ชุด", unitPrice: 4500 },
  
  { id: "plum-001", categoryId: "plumbing", name: "ท่อ PVC ขนาด 1/2 นิ้ว", unit: "ม.", unitPrice: 25 },
  { id: "plum-002", categoryId: "plumbing", name: "ท่อ PVC ขนาด 3/4 นิ้ว", unit: "ม.", unitPrice: 35 },
  { id: "plum-003", categoryId: "plumbing", name: "ท่อ PVC ขนาด 4 นิ้ว (ระบายน้ำ)", unit: "ม.", unitPrice: 120 },
  { id: "plum-004", categoryId: "plumbing", name: "สุขภัณฑ์โถส้วมชักโครก", unit: "ชุด", unitPrice: 3500 },
  { id: "plum-005", categoryId: "plumbing", name: "อ่างล้างหน้าพร้อมขาตั้ง", unit: "ชุด", unitPrice: 2200 },
  { id: "plum-006", categoryId: "plumbing", name: "ก๊อกน้ำอ่างล้างหน้า", unit: "ชุด", unitPrice: 850 },
  { id: "plum-007", categoryId: "plumbing", name: "ฝักบัวอาบน้ำพร้อมชุดติดตั้ง", unit: "ชุด", unitPrice: 1500 },
  { id: "plum-008", categoryId: "plumbing", name: "ถังเก็บน้ำ PE 1000 ลิตร", unit: "ใบ", unitPrice: 4500 },
  
  { id: "fin-001", categoryId: "finishing", name: "สีรองพื้นปูนใหม่ (ICI)", unit: "ตร.ม.", unitPrice: 45 },
  { id: "fin-002", categoryId: "finishing", name: "สีน้ำอะคริลิคทาภายใน", unit: "ตร.ม.", unitPrice: 85 },
  { id: "fin-003", categoryId: "finishing", name: "สีน้ำอะคริลิคทาภายนอก", unit: "ตร.ม.", unitPrice: 95 },
  { id: "fin-004", categoryId: "finishing", name: "บัวเชิงผนัง PVC", unit: "ม.", unitPrice: 120 },
  { id: "fin-005", categoryId: "finishing", name: "ฝ้าเพดานยิปซัม 9 มม.", unit: "ตร.ม.", unitPrice: 280 },
  { id: "fin-006", categoryId: "finishing", name: "ฝ้าเพดานแคลเซียมซิลิเกต", unit: "ตร.ม.", unitPrice: 350 },
];

export default function BOQEstimator() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [boqLines, setBOQLines] = useState<BOQLine[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedWorkItem, setSelectedWorkItem] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [projectName, setProjectName] = useState<string>("");
  
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [projectDescription, setProjectDescription] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([]);
  const [aiSummary, setAiSummary] = useState<string>("");
  const [aiError, setAiError] = useState<string>("");
  const [showAiPanel, setShowAiPanel] = useState(true);
  const [isDragging, setIsDragging] = useState(false);

  const filteredWorkItems = useMemo(() => {
    let items = workItems;
    
    if (selectedCategory) {
      items = items.filter(item => item.categoryId === selectedCategory);
    }
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      items = items.filter(item => 
        item.name.toLowerCase().includes(term) ||
        item.unit.toLowerCase().includes(term)
      );
    }
    
    return items;
  }, [selectedCategory, searchTerm]);

  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files) return;
    
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    const newFiles: UploadedFile[] = [];
    
    Array.from(files).forEach(file => {
      if (!allowedTypes.includes(file.type)) {
        toast.error(`ไฟล์ ${file.name} ไม่รองรับ (รองรับ JPG, PNG, PDF)`);
        return;
      }
      
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`ไฟล์ ${file.name} ใหญ่เกินไป (สูงสุด 10MB)`);
        return;
      }
      
      const uploadedFile: UploadedFile = {
        id: `file-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        type: file.type === 'application/pdf' ? 'pdf' : 'image'
      };
      
      if (uploadedFile.type === 'image') {
        uploadedFile.preview = URL.createObjectURL(file);
      }
      
      newFiles.push(uploadedFile);
    });
    
    setUploadedFiles(prev => [...prev, ...newFiles].slice(0, 5));
  }, []);

  const handleRemoveFile = useCallback((fileId: string) => {
    setUploadedFiles(prev => {
      const file = prev.find(f => f.id === fileId);
      if (file?.preview) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter(f => f.id !== fileId);
    });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  const handleAIAnalyze = async () => {
    if (!uploadedFiles.length && !projectDescription.trim()) {
      toast.error("กรุณาอัปโหลดไฟล์หรือพิมพ์รายละเอียดโครงการ");
      return;
    }

    setIsAnalyzing(true);
    setAiError("");
    setAiSuggestions([]);
    setAiSummary("");

    try {
      const formData = new FormData();
      
      uploadedFiles.forEach(uf => {
        formData.append('files', uf.file);
      });
      
      formData.append('description', projectDescription);
      formData.append('availableItems', JSON.stringify(
        workItems.map(item => ({
          id: item.id,
          name: item.name,
          unit: item.unit,
          unitPrice: item.unitPrice,
          categoryId: item.categoryId
        }))
      ));

      const response = await fetch('/api/boq/ai-estimate', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (!result.success) {
        setAiError(result.error || "ไม่สามารถวิเคราะห์ได้");
        return;
      }

      const suggestionsWithSelection = result.suggestions.map((s: AISuggestion) => ({
        ...s,
        selected: true
      }));

      setAiSuggestions(suggestionsWithSelection);
      setAiSummary(result.summary || "");
      
      if (suggestionsWithSelection.length > 0) {
        toast.success(`AI แนะนำ ${suggestionsWithSelection.length} รายการ`);
      } else {
        toast.info("AI ไม่พบรายการที่เกี่ยวข้อง");
      }
    } catch (error: any) {
      console.error("AI analysis error:", error);
      setAiError(error.message || "เกิดข้อผิดพลาดในการวิเคราะห์");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleSuggestionSelection = (index: number) => {
    setAiSuggestions(prev => prev.map((s, i) => 
      i === index ? { ...s, selected: !s.selected } : s
    ));
  };

  const handleAddSelectedSuggestions = () => {
    const selectedItems = aiSuggestions.filter(s => s.selected);
    
    if (selectedItems.length === 0) {
      toast.error("กรุณาเลือกรายการที่ต้องการเพิ่ม");
      return;
    }

    let addedCount = 0;
    selectedItems.forEach(suggestion => {
      const workItem = workItems.find(item => item.id === suggestion.itemId);
      if (!workItem) return;

      const newLine: BOQLine = {
        id: `line-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        workItemId: workItem.id,
        workItem,
        quantity: suggestion.quantity,
        totalPrice: suggestion.quantity * workItem.unitPrice,
      };

      setBOQLines(prev => [...prev, newLine]);
      addedCount++;
    });

    if (addedCount > 0) {
      toast.success(`เพิ่ม ${addedCount} รายการเข้า BOQ`);
      setAiSuggestions(prev => prev.filter(s => !s.selected));
    }
  };

  const handleAddLine = () => {
    if (!selectedWorkItem || !quantity || parseFloat(quantity) <= 0) {
      toast.error("กรุณาเลือกรายการและระบุปริมาณ");
      return;
    }

    const workItem = workItems.find(item => item.id === selectedWorkItem);
    if (!workItem) return;

    const qty = parseFloat(quantity);
    const newLine: BOQLine = {
      id: `line-${Date.now()}`,
      workItemId: workItem.id,
      workItem,
      quantity: qty,
      totalPrice: qty * workItem.unitPrice,
    };

    setBOQLines(prev => [...prev, newLine]);
    setSelectedWorkItem("");
    setQuantity("");
    toast.success("เพิ่มรายการเรียบร้อย");
  };

  const handleRemoveLine = (lineId: string) => {
    setBOQLines(prev => prev.filter(line => line.id !== lineId));
  };

  const handleUpdateQuantity = (lineId: string, newQuantity: number) => {
    setBOQLines(prev => prev.map(line => {
      if (line.id === lineId) {
        return {
          ...line,
          quantity: newQuantity,
          totalPrice: newQuantity * line.workItem.unitPrice,
        };
      }
      return line;
    }));
  };

  const totalAmount = useMemo(() => {
    return boqLines.reduce((sum, line) => sum + line.totalPrice, 0);
  }, [boqLines]);

  const summaryByCategory = useMemo(() => {
    const summary: Record<string, { count: number; total: number }> = {};
    
    boqLines.forEach(line => {
      const catId = line.workItem.categoryId;
      if (!summary[catId]) {
        summary[catId] = { count: 0, total: 0 };
      }
      summary[catId].count += 1;
      summary[catId].total += line.totalPrice;
    });
    
    return summary;
  }, [boqLines]);

  const handleExportExcel = () => {
    if (boqLines.length === 0) {
      toast.error("ไม่มีรายการให้ส่งออก");
      return;
    }

    const exportData = boqLines.map((line, index) => {
      const category = workCategories.find(c => c.id === line.workItem.categoryId);
      return {
        "ลำดับ": index + 1,
        "หมวดงาน": category?.name || "-",
        "รายการ": line.workItem.name,
        "หน่วย": line.workItem.unit,
        "ราคาต่อหน่วย": line.workItem.unitPrice,
        "ปริมาณ": line.quantity,
        "รวมเงิน": line.totalPrice,
      };
    });

    const summaryData = workCategories
      .filter(cat => summaryByCategory[cat.id])
      .map(cat => ({
        "หมวดงาน": cat.name,
        "จำนวนรายการ": summaryByCategory[cat.id].count,
        "รวมเงิน": summaryByCategory[cat.id].total,
      }));

    summaryData.push({
      "หมวดงาน": "รวมทั้งหมด",
      "จำนวนรายการ": boqLines.length,
      "รวมเงิน": totalAmount,
    });

    const wb = XLSX.utils.book_new();
    
    const wsItems = XLSX.utils.json_to_sheet(exportData);
    XLSX.utils.book_append_sheet(wb, wsItems, "รายการ BOQ");
    
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, "สรุป");

    const fileName = projectName 
      ? `BOQ_${projectName.replace(/\s+/g, "_")}.xlsx`
      : `BOQ_${new Date().toISOString().split("T")[0]}.xlsx`;
    
    XLSX.writeFile(wb, fileName);
    toast.success("ดาวน์โหลด Excel เรียบร้อย");
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("th-TH", {
      style: "decimal",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const selectedSuggestionsCount = aiSuggestions.filter(s => s.selected).length;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-6 px-4 max-w-6xl">
        <div className="flex items-center gap-4 mb-6">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate(-1)}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Calculator className="h-6 w-6" />
              BOQ Estimator
            </h1>
            <p className="text-muted-foreground text-sm">
              ประเมินราคางานก่อสร้างเบื้องต้น
            </p>
          </div>
          <Button
            onClick={handleExportExcel}
            disabled={boqLines.length === 0}
            data-testid="button-export-excel"
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  AI ช่วยประเมิน BOQ
                </CardTitle>
                <CardDescription>
                  อัปโหลดแบบแปลน รูปภาพ หรือ PDF แล้วให้ AI ช่วยวิเคราะห์
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.pdf"
                  multiple
                  onChange={(e) => handleFileSelect(e.target.files)}
                  className="hidden"
                  data-testid="input-file-upload"
                />
                
                <div
                  className={`border-2 border-dashed rounded-md p-6 text-center transition-colors cursor-pointer ${
                    isDragging 
                      ? 'border-primary bg-primary/5' 
                      : 'border-muted-foreground/25 hover:border-primary/50'
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  data-testid="dropzone-files"
                >
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือก
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    รองรับ: JPG, PNG, PDF (สูงสุด 5 ไฟล์, ไฟล์ละไม่เกิน 10MB)
                  </p>
                </div>

                {uploadedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {uploadedFiles.map(uf => (
                      <div
                        key={uf.id}
                        className="relative group flex items-center gap-2 bg-muted rounded-md px-3 py-2"
                        data-testid={`uploaded-file-${uf.id}`}
                      >
                        {uf.type === 'image' ? (
                          <FileImage className="h-4 w-4 text-blue-500" />
                        ) : (
                          <FileText className="h-4 w-4 text-red-500" />
                        )}
                        <span className="text-sm truncate max-w-[150px]">{uf.file.name}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveFile(uf.id);
                          }}
                          data-testid={`button-remove-file-${uf.id}`}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  <Label>หรือพิมพ์รายละเอียดโครงการ</Label>
                  <Textarea
                    placeholder="เช่น: บ้าน 2 ชั้น พื้นที่ใช้สอย 150 ตร.ม. 3 ห้องนอน 2 ห้องน้ำ โครงสร้างคอนกรีต หลังคาเมทัลชีท"
                    value={projectDescription}
                    onChange={(e) => setProjectDescription(e.target.value)}
                    className="min-h-[80px]"
                    data-testid="textarea-project-description"
                  />
                </div>

                <Button
                  className="w-full"
                  onClick={handleAIAnalyze}
                  disabled={isAnalyzing || (!uploadedFiles.length && !projectDescription.trim())}
                  data-testid="button-ai-analyze"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      กำลังวิเคราะห์...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      AI วิเคราะห์และประเมิน BOQ
                    </>
                  )}
                </Button>

                {aiError && (
                  <div className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive rounded-md" data-testid="ai-error">
                    <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                    <p className="text-sm">{aiError}</p>
                  </div>
                )}

                {aiSuggestions.length > 0 && (
                  <div className="space-y-3" data-testid="ai-suggestions-panel">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                        <span className="font-medium">AI แนะนำ {aiSuggestions.length} รายการ</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowAiPanel(!showAiPanel)}
                        data-testid="button-toggle-ai-panel"
                      >
                        {showAiPanel ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </div>

                    {aiSummary && (
                      <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md" data-testid="ai-summary">
                        {aiSummary}
                      </p>
                    )}

                    {showAiPanel && (
                      <>
                        <ScrollArea className="max-h-[300px]">
                          <div className="space-y-2">
                            {aiSuggestions.map((suggestion, index) => {
                              const workItem = workItems.find(w => w.id === suggestion.itemId);
                              const category = workCategories.find(c => c.id === workItem?.categoryId);
                              const estimatedPrice = (workItem?.unitPrice || 0) * suggestion.quantity;

                              return (
                                <div
                                  key={`${suggestion.itemId}-${index}`}
                                  className={`flex items-start gap-3 p-3 rounded-md border transition-colors ${
                                    suggestion.selected ? 'bg-primary/5 border-primary/30' : 'bg-background border-border'
                                  }`}
                                  data-testid={`ai-suggestion-${index}`}
                                >
                                  <Checkbox
                                    checked={suggestion.selected}
                                    onCheckedChange={() => toggleSuggestionSelection(index)}
                                    data-testid={`checkbox-suggestion-${index}`}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                      <div>
                                        <p className="font-medium text-sm">{suggestion.itemName}</p>
                                        {category && (
                                          <Badge variant="secondary" className={`text-xs mt-1 ${category.color}`}>
                                            {category.name}
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="text-right shrink-0">
                                        <p className="font-medium text-sm">{suggestion.quantity} {workItem?.unit}</p>
                                        <p className="text-xs text-muted-foreground">
                                          {formatCurrency(estimatedPrice)} บาท
                                        </p>
                                      </div>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">{suggestion.reason}</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </ScrollArea>

                        <Button
                          className="w-full"
                          onClick={handleAddSelectedSuggestions}
                          disabled={selectedSuggestionsCount === 0}
                          data-testid="button-add-suggestions"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          เพิ่มที่เลือก ({selectedSuggestionsCount} รายการ) เข้า BOQ
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  เพิ่มรายการด้วยตนเอง
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>ชื่อโครงการ (ถ้ามี)</Label>
                    <Input
                      placeholder="ระบุชื่อโครงการ"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      data-testid="input-project-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>ค้นหารายการ</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="พิมพ์ชื่อวัสดุหรืองาน..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9"
                        data-testid="input-search"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>หมวดงาน</Label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={selectedCategory === "" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedCategory("")}
                      data-testid="button-category-all"
                    >
                      <Package className="h-4 w-4 mr-1" />
                      ทั้งหมด
                    </Button>
                    {workCategories.map(cat => (
                      <Button
                        key={cat.id}
                        variant={selectedCategory === cat.id ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedCategory(cat.id)}
                        data-testid={`button-category-${cat.id}`}
                      >
                        {cat.icon}
                        <span className="ml-1">{cat.name}</span>
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2 space-y-2">
                    <Label>รายการงาน/วัสดุ</Label>
                    <Select
                      value={selectedWorkItem}
                      onValueChange={setSelectedWorkItem}
                    >
                      <SelectTrigger data-testid="select-work-item">
                        <SelectValue placeholder="เลือกรายการ" />
                      </SelectTrigger>
                      <SelectContent>
                        <ScrollArea className="h-[300px]">
                          {filteredWorkItems.map(item => (
                            <SelectItem key={item.id} value={item.id}>
                              <div className="flex justify-between items-center w-full gap-4">
                                <span className="truncate">{item.name}</span>
                                <span className="text-muted-foreground text-sm shrink-0">
                                  {formatCurrency(item.unitPrice)} บาท/{item.unit}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </ScrollArea>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>ปริมาณ</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder="0"
                        min="0"
                        step="0.01"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        data-testid="input-quantity"
                      />
                      <Button onClick={handleAddLine} data-testid="button-add-item">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">รายการ BOQ</CardTitle>
                <CardDescription>
                  {boqLines.length} รายการ
                </CardDescription>
              </CardHeader>
              <CardContent>
                {boqLines.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Calculator className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>ยังไม่มีรายการ</p>
                    <p className="text-sm">ใช้ AI ช่วยประเมิน หรือเลือกรายการด้วยตนเอง</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[50px]">ลำดับ</TableHead>
                          <TableHead>รายการ</TableHead>
                          <TableHead className="text-right w-[100px]">ราคา/หน่วย</TableHead>
                          <TableHead className="text-center w-[120px]">ปริมาณ</TableHead>
                          <TableHead className="text-right w-[120px]">รวม</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {boqLines.map((line, index) => {
                          const category = workCategories.find(c => c.id === line.workItem.categoryId);
                          return (
                            <TableRow key={line.id} data-testid={`row-boq-${line.id}`}>
                              <TableCell className="font-medium">{index + 1}</TableCell>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{line.workItem.name}</p>
                                  <Badge variant="secondary" className={`text-xs mt-1 ${category?.color}`}>
                                    {category?.name}
                                  </Badge>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(line.workItem.unitPrice)}
                                <span className="text-muted-foreground text-xs ml-1">/{line.workItem.unit}</span>
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={line.quantity}
                                  onChange={(e) => handleUpdateQuantity(line.id, parseFloat(e.target.value) || 0)}
                                  className="w-20 text-center mx-auto"
                                  data-testid={`input-qty-${line.id}`}
                                />
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {formatCurrency(line.totalPrice)}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRemoveLine(line.id)}
                                  data-testid={`button-remove-${line.id}`}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">สรุปราคา</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {workCategories.map(cat => {
                  const summary = summaryByCategory[cat.id];
                  if (!summary) return null;
                  
                  return (
                    <div key={cat.id} className="flex justify-between items-center gap-2" data-testid={`summary-category-${cat.id}`}>
                      <div className="flex items-center gap-2">
                        {cat.icon}
                        <span className="text-sm">{cat.name}</span>
                        <Badge variant="outline" className="text-xs" data-testid={`badge-count-${cat.id}`}>
                          {summary.count}
                        </Badge>
                      </div>
                      <span className="font-medium" data-testid={`text-total-${cat.id}`}>{formatCurrency(summary.total)}</span>
                    </div>
                  );
                })}

                {boqLines.length > 0 && (
                  <>
                    <Separator />
                    <div className="flex justify-between items-center gap-2 text-lg font-bold" data-testid="summary-grand-total">
                      <span>รวมทั้งหมด</span>
                      <span className="text-primary" data-testid="text-grand-total">{formatCurrency(totalAmount)} บาท</span>
                    </div>
                  </>
                )}

                {boqLines.length === 0 && (
                  <p className="text-center text-muted-foreground text-sm py-4">
                    เพิ่มรายการเพื่อดูสรุปราคา
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">หมายเหตุ</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>ราคาที่แสดงเป็นราคาประมาณการเท่านั้น อาจแตกต่างจากราคาจริงขึ้นอยู่กับ:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>พื้นที่ก่อสร้าง</li>
                  <li>ปริมาณงานรวม</li>
                  <li>ราคาวัสดุ ณ เวลาที่สั่งซื้อ</li>
                  <li>ค่าแรงงานในพื้นที่</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
