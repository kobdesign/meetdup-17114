import { Label } from "@/components/ui/label";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Building2 } from "lucide-react";
import { BUSINESS_CATEGORIES, getBusinessCategoryLabel } from "@/lib/business-categories";

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
  const handleChange = (newValue: string) => {
    onChange(newValue);
  };

  const handleClear = () => {
    onChange(null);
  };

  const currentLabel = value ? getBusinessCategoryLabel(value) : null;

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
        disabled={disabled}
      >
        <SelectTrigger data-testid="select-business-category">
          <SelectValue placeholder="เลือกประเภทธุรกิจ" />
        </SelectTrigger>
        <SelectContent>
          {BUSINESS_CATEGORIES.map((cat) => (
            <SelectItem key={cat.code} value={cat.code}>
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

export { getBusinessCategoryLabel };
