import { useState, KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X, Tag } from "lucide-react";
import { Label } from "@/components/ui/label";

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  maxTags?: number;
  disabled?: boolean;
}

export default function TagInput({
  value = [],
  onChange,
  placeholder = "พิมพ์แล้วกด Enter",
  maxTags = 10,
  disabled = false,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState("");

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag();
    } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
      removeTag(value.length - 1);
    }
  };

  const addTag = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !value.includes(trimmed) && value.length < maxTags) {
      onChange([...value, trimmed]);
      setInputValue("");
    }
  };

  const removeTag = (index: number) => {
    const newTags = value.filter((_, i) => i !== index);
    onChange(newTags);
  };

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        <Tag className="h-4 w-4" />
        Keywords / Tags
      </Label>
      
      <div className="flex flex-wrap gap-1.5 min-h-[38px] p-2 border rounded-md bg-background">
        {value.map((tag, index) => (
          <Badge
            key={index}
            variant="secondary"
            className="gap-1 pr-1"
          >
            {tag}
            {!disabled && (
              <button
                type="button"
                onClick={() => removeTag(index)}
                className="ml-1 rounded-full hover:bg-muted p-0.5"
                data-testid={`button-remove-tag-${index}`}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </Badge>
        ))}
        {value.length < maxTags && !disabled && (
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={addTag}
            placeholder={value.length === 0 ? placeholder : ""}
            className="flex-1 min-w-[120px] border-0 p-0 h-6 focus-visible:ring-0 shadow-none"
            disabled={disabled}
            data-testid="input-tag"
          />
        )}
      </div>
      
      <p className="text-xs text-muted-foreground">
        ใส่ keywords ที่เกี่ยวกับธุรกิจของคุณ เช่น IT, ซอฟต์แวร์, Startup (สูงสุด {maxTags} รายการ)
      </p>
    </div>
  );
}
