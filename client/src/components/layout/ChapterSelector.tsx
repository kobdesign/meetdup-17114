import { Building2, Check, ChevronsUpDown } from "lucide-react";
import { useTenantContext } from "@/contexts/TenantContext";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function ChapterSelector() {
  const { selectedTenant, availableTenants, setSelectedTenant, isSuperAdmin } = useTenantContext();
  const [open, setOpen] = useState(false);

  const currentChapter = selectedTenant?.tenant_name || "No Chapter Selected";

  // If not super admin, show chapter name only (no dropdown)
  if (!isSuperAdmin) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/50">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">{currentChapter}</span>
      </div>
    );
  }

  // Super Admin: show dropdown selector
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="min-w-[200px] justify-between"
          data-testid="button-chapter-selector"
        >
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <span className="truncate">{currentChapter}</span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search chapter..." />
          <CommandList>
            <CommandEmpty>No chapter found.</CommandEmpty>
            <CommandGroup>
              {availableTenants.map((tenant) => (
                <CommandItem
                  key={tenant.tenant_id}
                  value={tenant.tenant_name}
                  onSelect={() => {
                    setSelectedTenant(tenant.tenant_id);
                    setOpen(false);
                  }}
                  data-testid={`chapter-option-${tenant.tenant_id}`}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedTenant?.tenant_id === tenant.tenant_id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span className="font-medium">{tenant.tenant_name}</span>
                    {tenant.subdomain && (
                      <span className="text-xs text-muted-foreground truncate">
                        {tenant.subdomain}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
