import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface MemberOption {
  participant_id: string;
  full_name_th?: string | null;
  full_name?: string | null;
  nickname_th?: string | null;
  nickname?: string | null;
  display_name?: string;
}

interface MemberSearchSelectProps {
  members: MemberOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  "data-testid"?: string;
}

export function MemberSearchSelect({
  members,
  value,
  onChange,
  placeholder = "เลือกสมาชิก...",
  emptyText = "ไม่พบสมาชิก",
  disabled = false,
  className,
  "data-testid": testId,
}: MemberSearchSelectProps) {
  const [open, setOpen] = useState(false);

  const getDisplayName = (member: MemberOption): string => {
    if (member.display_name) return member.display_name;
    const name = member.full_name_th || member.full_name || "";
    const nick = member.nickname_th || member.nickname || "";
    if (nick) return `${nick} (${name})`;
    return name;
  };

  const getSearchableText = (member: MemberOption): string => {
    const parts = [
      member.full_name_th,
      member.full_name,
      member.nickname_th,
      member.nickname,
      member.display_name,
    ].filter(Boolean);
    return parts.join(" ").toLowerCase();
  };

  const selectedMember = members.find((m) => m.participant_id === value);
  const selectedDisplay = selectedMember ? getDisplayName(selectedMember) : "";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground",
            className
          )}
          data-testid={testId}
        >
          <span className="truncate">
            {value ? selectedDisplay : placeholder}
          </span>
          <div className="flex items-center gap-1 shrink-0 ml-2">
            {value && (
              <X
                className="h-4 w-4 opacity-50 hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange("");
                  setOpen(false);
                }}
              />
            )}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command
          filter={(value, search) => {
            const member = members.find((m) => m.participant_id === value);
            if (!member) return 0;
            const searchable = getSearchableText(member);
            if (searchable.includes(search.toLowerCase())) return 1;
            return 0;
          }}
        >
          <CommandInput placeholder="พิมพ์ค้นหา..." />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value=""
                onSelect={() => {
                  onChange("");
                  setOpen(false);
                }}
                className="text-muted-foreground"
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    !value ? "opacity-100" : "opacity-0"
                  )}
                />
                -- ไม่ระบุ --
              </CommandItem>
              {members.map((member) => (
                <CommandItem
                  key={member.participant_id}
                  value={member.participant_id}
                  onSelect={(currentValue) => {
                    onChange(currentValue === value ? "" : currentValue);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === member.participant_id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {getDisplayName(member)}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
