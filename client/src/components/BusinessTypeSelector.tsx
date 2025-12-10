import { useQuery } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Building2, Loader2 } from "lucide-react";

interface BusinessCategory {
  category_code: string;
  name_th: string;
  name_en: string | null;
  is_active: boolean;
}

interface BusinessTypeSelectorProps {
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  disabled?: boolean;
}

export default function BusinessTypeSelector({ 
  value, 
  onChange,
  disabled = false 
}: BusinessTypeSelectorProps) {
  const { data, isLoading, error } = useQuery<{ categories: BusinessCategory[] }>({
    queryKey: ["/api/business-categories"],
    queryFn: async () => {
      const response = await fetch("/api/business-categories");
      if (!response.ok) {
        throw new Error("Failed to fetch categories");
      }
      return response.json();
    },
    staleTime: 1000 * 60 * 5,
  });

  const categories = data?.categories || [];

  const handleChange = (newValue: string) => {
    onChange(newValue);
  };

  const handleClear = () => {
    onChange(null);
  };

  const currentCategory = value 
    ? categories.find(c => c.category_code === value) 
    : null;
  const currentLabel = currentCategory?.name_th || (value ? `รหัส ${value}` : null);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          ประเภทธุรกิจ
        </Label>
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            disabled={disabled}
            data-testid="button-clear-business-type"
          >
            <X className="h-3 w-3" />
            ล้าง
          </button>
        )}
      </div>

      {currentLabel && (
        <Badge variant="secondary" className="text-xs">
          {currentLabel}
        </Badge>
      )}

      <Select
        value={value || ""}
        onValueChange={handleChange}
        disabled={disabled || isLoading}
      >
        <SelectTrigger data-testid="select-business-category">
          {isLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>กำลังโหลด...</span>
            </div>
          ) : (
            <SelectValue placeholder="เลือกประเภทธุรกิจ" />
          )}
        </SelectTrigger>
        <SelectContent>
          {categories.map((cat) => (
            <SelectItem key={cat.category_code} value={cat.category_code}>
              {cat.name_th}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <p className="text-xs text-muted-foreground">
        เลือกประเภทธุรกิจที่ตรงกับธุรกิจของคุณ
      </p>
    </div>
  );
}
