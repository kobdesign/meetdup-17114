# Meetdup App - Starter Template

## Quick Start

Copy this template to create a new app for the Meetdup App Marketplace.

---

## Step 1: Create Your App File

Create a new file at `client/src/pages/apps/YourAppName.tsx`

---

## Step 2: Use This Template

```typescript
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { 
  Calculator,      // Change to your app icon
  Plus, 
  Trash2, 
  Download,
  ArrowLeft 
} from "lucide-react";

// =============================================================================
// TYPES - Define your data structures
// =============================================================================

interface YourDataItem {
  id: string;
  name: string;
  value: number;
  category: string;
}

// =============================================================================
// CONSTANTS - Define your static data
// =============================================================================

const CATEGORIES = [
  { value: "category1", label: "Category 1" },
  { value: "category2", label: "Category 2" },
  { value: "category3", label: "Category 3" },
];

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface YourAppNameProps {
  isLiff: boolean;           // true if running inside LINE app
  tenantId: string | null;   // Chapter UUID
  participantId?: string;    // Member UUID (only for member/admin apps)
}

export default function YourAppName({ 
  isLiff, 
  tenantId, 
  participantId 
}: YourAppNameProps) {
  const { toast } = useToast();
  
  // ==========================================================================
  // STATE
  // ==========================================================================
  
  const [items, setItems] = useState<YourDataItem[]>([]);
  const [projectName, setProjectName] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [inputValue, setInputValue] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);

  // ==========================================================================
  // COMPUTED VALUES
  // ==========================================================================
  
  const totalValue = items.reduce((sum, item) => sum + item.value, 0);
  const itemCount = items.length;

  // ==========================================================================
  // HANDLERS
  // ==========================================================================
  
  // Helper function to generate unique ID (works in all browsers)
  const generateId = () => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const handleAddItem = () => {
    if (!selectedCategory || inputValue <= 0) {
      toast({
        title: "กรุณากรอกข้อมูลให้ครบ",
        description: "เลือกหมวดหมู่และใส่ค่าที่มากกว่า 0",
        variant: "destructive",
      });
      return;
    }

    const categoryLabel = CATEGORIES.find(c => c.value === selectedCategory)?.label || selectedCategory;
    
    const newItem: YourDataItem = {
      id: generateId(),  // Use helper instead of crypto.randomUUID
      name: categoryLabel,
      value: inputValue,
      category: selectedCategory,
    };

    setItems([...items, newItem]);
    setInputValue(0);
    
    toast({
      title: "เพิ่มรายการสำเร็จ",
      description: `${categoryLabel}: ${inputValue.toLocaleString()}`,
    });
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const handleClear = () => {
    setItems([]);
    setProjectName("");
    toast({
      title: "ล้างข้อมูลแล้ว",
    });
  };

  const handleExport = async () => {
    if (items.length === 0) {
      toast({
        title: "ไม่มีข้อมูลให้ Export",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      // Example: Export to Excel using xlsx library
      const { utils, writeFile } = await import("xlsx");
      
      const exportData = items.map(item => ({
        "รายการ": item.name,
        "หมวดหมู่": item.category,
        "มูลค่า": item.value,
      }));

      const ws = utils.json_to_sheet(exportData);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, "Data");
      
      const filename = projectName || "export";
      writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
      
      toast({
        title: "Export สำเร็จ",
        description: `ไฟล์ ${filename}.xlsx ถูกดาวน์โหลดแล้ว`,
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Export ไม่สำเร็จ",
        description: "เกิดข้อผิดพลาด กรุณาลองใหม่",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================
  
  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      {/* ================================================================== */}
      {/* HEADER */}
      {/* ================================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <ArrowLeft 
            className="h-5 w-5 cursor-pointer hover:text-primary" 
            onClick={() => window.history.back()}
            data-testid="button-back-header"
          />
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Calculator className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-app-title">
              Your App Name
            </h1>
            <p className="text-muted-foreground text-sm">
              คำอธิบายแอปของคุณ
            </p>
          </div>
        </div>
        
        <Button 
          onClick={handleExport}
          disabled={isLoading || items.length === 0}
          data-testid="button-export"
        >
          <Download className="h-4 w-4 mr-2" />
          Export Excel
        </Button>
      </div>

      {/* ================================================================== */}
      {/* INPUT FORM */}
      {/* ================================================================== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            เพิ่มรายการ
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Project Name (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="projectName">ชื่อโปรเจค (ถ้ามี)</Label>
            <Input
              id="projectName"
              placeholder="ระบุชื่อโปรเจค"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              data-testid="input-project-name"
            />
          </div>

          {/* Category + Value Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>หมวดหมู่</Label>
              <Select 
                value={selectedCategory} 
                onValueChange={setSelectedCategory}
              >
                <SelectTrigger data-testid="select-category">
                  <SelectValue placeholder="เลือกหมวดหมู่" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="value">มูลค่า</Label>
              <Input
                id="value"
                type="number"
                placeholder="0"
                value={inputValue || ""}
                onChange={(e) => setInputValue(Number(e.target.value))}
                data-testid="input-value"
              />
            </div>

            <div className="flex items-end">
              <Button 
                onClick={handleAddItem}
                className="w-full"
                data-testid="button-add-item"
              >
                <Plus className="h-4 w-4 mr-2" />
                เพิ่ม
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ================================================================== */}
      {/* ITEMS LIST */}
      {/* ================================================================== */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>รายการทั้งหมด</CardTitle>
            <Badge variant="secondary" data-testid="badge-item-count">
              {itemCount} รายการ
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calculator className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>ยังไม่มีรายการ</p>
              <p className="text-sm">เพิ่มรายการเพื่อเริ่มต้น</p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item, index) => (
                <div 
                  key={item.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  data-testid={`item-row-${index}`}
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{item.category}</Badge>
                    <span className="font-medium">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold" data-testid={`item-value-${index}`}>
                      {item.value.toLocaleString()}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveItem(item.id)}
                      data-testid={`button-remove-${index}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
        {items.length > 0 && (
          <CardFooter className="flex justify-between gap-2 border-t pt-4">
            <Button 
              variant="outline" 
              onClick={handleClear}
              data-testid="button-clear"
            >
              ล้างทั้งหมด
            </Button>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">รวมทั้งหมด</p>
              <p className="text-2xl font-bold" data-testid="text-total">
                {totalValue.toLocaleString()}
              </p>
            </div>
          </CardFooter>
        )}
      </Card>

      {/* ================================================================== */}
      {/* SUMMARY CARD (Optional) */}
      {/* ================================================================== */}
      {items.length > 0 && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-sm text-muted-foreground">จำนวนรายการ</p>
                <p className="text-xl font-bold">{itemCount}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">มูลค่ารวม</p>
                <p className="text-xl font-bold">{totalValue.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">เฉลี่ยต่อรายการ</p>
                <p className="text-xl font-bold">
                  {itemCount > 0 ? Math.round(totalValue / itemCount).toLocaleString() : 0}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">โปรเจค</p>
                <p className="text-xl font-bold truncate">
                  {projectName || "-"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ================================================================== */}
      {/* NOTES/HELP SECTION (Optional) */}
      {/* ================================================================== */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">หมายเหตุ</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
            <li>ข้อมูลที่แสดงเป็นการประมาณการเบื้องต้น</li>
            <li>สามารถ Export เป็นไฟล์ Excel ได้</li>
            <li>ข้อมูลจะไม่ถูกบันทึกหลังปิดแอป</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## Step 3: Register Your App

Edit `client/src/pages/liff/LiffAppShell.tsx`:

```typescript
// Add to appComponents
const appComponents = {
  "boq-estimator": lazy(() => import("@/pages/apps/BOQEstimator")),
  "your-app-name": lazy(() => import("@/pages/apps/YourAppName")),  // Add this
};

// Add to appConfigs
const appConfigs = {
  "boq-estimator": { /* ... */ },
  "your-app-name": {                    // Add this block
    app_id: "your-app-name",
    name: "Your App Name",
    description: "คำอธิบายแอปของคุณ",
    route: "/apps/your-app-name",
    access_level: "public",             // or "member" or "admin"
    component: "your-app-name",
  },
};
```

---

## Step 4: Test Your App

### Web Access
```
http://localhost:5000/apps/your-app-name
```

### LIFF Access
```
http://localhost:5000/liff/apps/your-app-name?tenant=<tenant-uuid>
```

---

## Checklist Before Submission

- [ ] App works on both web and LIFF modes
- [ ] All buttons have `data-testid` attributes
- [ ] Thai language UI
- [ ] Mobile responsive
- [ ] No console errors
- [ ] Toast notifications for user feedback
- [ ] Loading states for async operations
- [ ] Empty states handled gracefully

---

## Common Patterns

### Fetching Data from API

```typescript
import { useQuery } from "@tanstack/react-query";

const { data, isLoading, error } = useQuery({
  queryKey: ['/api/your-endpoint', tenantId],
  enabled: !!tenantId,
});
```

### Saving Data to API

```typescript
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

const mutation = useMutation({
  mutationFn: (data: YourDataType) => 
    apiRequest('/api/your-endpoint', { method: 'POST', body: JSON.stringify(data) }),
  onSuccess: () => {
    toast({ title: "บันทึกสำเร็จ" });
  },
});
```

### Conditional LIFF Features

```typescript
// Share to LINE (only works in LIFF)
const handleShare = async () => {
  if (!isLiff) {
    toast({ title: "ฟีเจอร์นี้ใช้ได้เฉพาะใน LINE เท่านั้น" });
    return;
  }
  
  const liff = (await import("@line/liff")).default;
  await liff.shareTargetPicker([/* messages */]);
};
```

---

*Template Version: 1.0*
*Last Updated: December 2024*
