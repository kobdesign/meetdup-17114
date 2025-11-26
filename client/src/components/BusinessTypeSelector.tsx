import { useState, useEffect } from "react";
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
import {
  BUSINESS_TYPES,
  getBusinessTypePath,
  getBusinessTypeLabel,
  getCategoriesForDropdown,
  getSubcategoriesForCategory,
  getDetailsForSubcategory,
} from "@/lib/business-types";

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
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>("");
  const [selectedDetail, setSelectedDetail] = useState<string>("");

  useEffect(() => {
    if (value) {
      const path = getBusinessTypePath(value);
      setSelectedCategory(path.category || "");
      setSelectedSubcategory(path.subcategory || "");
      setSelectedDetail(path.detail || "");
    } else {
      setSelectedCategory("");
      setSelectedSubcategory("");
      setSelectedDetail("");
    }
  }, [value]);

  const categories = getCategoriesForDropdown();
  const subcategories = selectedCategory 
    ? getSubcategoriesForCategory(selectedCategory) 
    : [];
  const details = selectedCategory && selectedSubcategory
    ? getDetailsForSubcategory(selectedCategory, selectedSubcategory)
    : [];

  const handleCategoryChange = (newCategory: string) => {
    setSelectedCategory(newCategory);
    setSelectedSubcategory("");
    setSelectedDetail("");
    onChange(newCategory);
  };

  const handleSubcategoryChange = (newSubcategory: string) => {
    setSelectedSubcategory(newSubcategory);
    setSelectedDetail("");
    
    const sub = subcategories.find(s => s.value === newSubcategory);
    if (sub && !sub.hasDetails) {
      onChange(newSubcategory);
    } else {
      onChange(newSubcategory);
    }
  };

  const handleDetailChange = (newDetail: string) => {
    setSelectedDetail(newDetail);
    onChange(newDetail);
  };

  const handleClear = () => {
    setSelectedCategory("");
    setSelectedSubcategory("");
    setSelectedDetail("");
    onChange(null);
  };

  const currentLabel = value ? getBusinessTypeLabel(value) : null;

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

      <div className="grid gap-2">
        <Select
          value={selectedCategory}
          onValueChange={handleCategoryChange}
          disabled={disabled}
        >
          <SelectTrigger data-testid="select-business-category">
            <SelectValue placeholder="เลือกหมวดหลัก" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedCategory && subcategories.length > 0 && (
          <Select
            value={selectedSubcategory}
            onValueChange={handleSubcategoryChange}
            disabled={disabled}
          >
            <SelectTrigger data-testid="select-business-subcategory">
              <SelectValue placeholder="เลือกหมวดย่อย" />
            </SelectTrigger>
            <SelectContent>
              {subcategories.map((sub) => (
                <SelectItem key={sub.value} value={sub.value}>
                  {sub.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {selectedSubcategory && details.length > 0 && (
          <Select
            value={selectedDetail}
            onValueChange={handleDetailChange}
            disabled={disabled}
          >
            <SelectTrigger data-testid="select-business-detail">
              <SelectValue placeholder="เลือกประเภทย่อย" />
            </SelectTrigger>
            <SelectContent>
              {details.map((detail) => (
                <SelectItem key={detail.value} value={detail.value}>
                  {detail.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        เลือกประเภทธุรกิจให้ตรงกับธุรกิจของคุณมากที่สุด
      </p>
    </div>
  );
}
