import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { X, Building2, Loader2, Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

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
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  const createCategoryMutation = useMutation({
    mutationFn: async (name_th: string) => {
      const response = await apiRequest("/api/business-categories/member-create", "POST", {
        name_th
      });
      return response;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/business-categories"] });
      
      if (data.category) {
        onChange(data.category.category_code);
        setOpen(false);
        setSearchValue("");
        
        if (data.isExisting) {
          toast({
            title: "พบหมวดหมู่ที่มีอยู่แล้ว",
            description: `เลือกหมวดหมู่ "${data.category.name_th}" ให้แล้ว`,
          });
        } else {
          toast({
            title: "เพิ่มหมวดหมู่สำเร็จ",
            description: `สร้างหมวดหมู่ "${data.category.name_th}" เรียบร้อย`,
          });
        }
      }
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "เกิดข้อผิดพลาด",
        description: error.message || "ไม่สามารถเพิ่มหมวดหมู่ได้",
      });
    }
  });

  const categories = data?.categories || [];

  const filteredCategories = useMemo(() => {
    if (!searchValue.trim()) return categories;
    const search = searchValue.toLowerCase().trim();
    return categories.filter(cat => 
      cat.name_th.toLowerCase().includes(search) ||
      (cat.name_en && cat.name_en.toLowerCase().includes(search)) ||
      cat.category_code.includes(search)
    );
  }, [categories, searchValue]);

  const showCreateOption = useMemo(() => {
    if (!searchValue.trim() || searchValue.trim().length < 2) return false;
    const search = searchValue.toLowerCase().trim();
    return !categories.some(cat => 
      cat.name_th.toLowerCase() === search
    );
  }, [categories, searchValue]);

  const handleSelect = (categoryCode: string) => {
    onChange(categoryCode);
    setOpen(false);
    setSearchValue("");
  };

  const handleCreateNew = () => {
    if (!searchValue.trim()) return;
    createCategoryMutation.mutate(searchValue.trim());
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
      <div className="flex items-center justify-between gap-2">
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

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={disabled || isLoading}
            data-testid="select-business-category"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>กำลังโหลด...</span>
              </div>
            ) : currentCategory ? (
              <span className="truncate">{currentCategory.name_th}</span>
            ) : (
              <span className="text-muted-foreground">ค้นหาหรือเลือกประเภทธุรกิจ...</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput 
              placeholder="พิมพ์ค้นหาหรือเพิ่มหมวดหมู่ใหม่..." 
              value={searchValue}
              onValueChange={setSearchValue}
              data-testid="input-search-category"
            />
            <CommandList>
              <CommandEmpty>
                {searchValue.trim().length >= 2 ? (
                  <div className="py-2 px-3 text-sm text-center">
                    ไม่พบหมวดหมู่ที่ค้นหา
                  </div>
                ) : (
                  <div className="py-2 px-3 text-sm text-center text-muted-foreground">
                    พิมพ์อย่างน้อย 2 ตัวอักษรเพื่อค้นหา
                  </div>
                )}
              </CommandEmpty>

              {showCreateOption && (
                <>
                  <CommandGroup heading="เพิ่มหมวดหมู่ใหม่">
                    <CommandItem
                      onSelect={handleCreateNew}
                      disabled={createCategoryMutation.isPending}
                      className="cursor-pointer"
                      data-testid="button-create-new-category"
                    >
                      {createCategoryMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="mr-2 h-4 w-4" />
                      )}
                      <span>
                        เพิ่ม "<strong>{searchValue.trim()}</strong>"
                      </span>
                    </CommandItem>
                  </CommandGroup>
                  <CommandSeparator />
                </>
              )}

              {filteredCategories.length > 0 && (
                <CommandGroup heading={showCreateOption ? "หมวดหมู่ที่มีอยู่" : "หมวดหมู่ธุรกิจ"}>
                  {filteredCategories.map((cat) => (
                    <CommandItem
                      key={cat.category_code}
                      value={cat.category_code}
                      onSelect={() => handleSelect(cat.category_code)}
                      className="cursor-pointer"
                      data-testid={`category-item-${cat.category_code}`}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === cat.category_code ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="flex-1">{cat.name_th}</span>
                      {cat.name_en && (
                        <span className="text-xs text-muted-foreground ml-2">
                          {cat.name_en}
                        </span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <p className="text-xs text-muted-foreground">
        ค้นหาหมวดหมู่หรือพิมพ์ชื่อใหม่เพื่อเพิ่มหมวดหมู่ของคุณเอง
      </p>
    </div>
  );
}
