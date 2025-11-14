import { useState } from "react";
import { Check, Building2, Search, ChevronDown } from "lucide-react";
import { useTenantContext } from "@/contexts/TenantContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function ChapterSwitcher() {
  const { userChapters, selectedTenantId, setSelectedChapter, isSuperAdmin } = useTenantContext();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // If user has no chapters (only super_admin), don't show switcher
  if (isSuperAdmin && userChapters.length === 0) {
    return null;
  }

  // If user has only one chapter, show it without popover
  if (userChapters.length === 1) {
    const chapter = userChapters[0];
    return (
      <div className="flex items-center gap-2 px-3 py-2" data-testid="chapter-switcher-single">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <div className="flex flex-col">
          <span className="text-sm font-medium">{chapter.tenantName}</span>
          <Badge variant="secondary" className="text-xs w-fit">
            {chapter.role}
          </Badge>
        </div>
      </div>
    );
  }

  const selectedChapter = userChapters.find(c => c.tenantId === selectedTenantId);

  // Filter chapters based on search
  const filteredChapters = userChapters.filter(chapter =>
    chapter.tenantName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[280px] justify-between"
          data-testid="button-chapter-switcher"
        >
          <div className="flex items-center gap-2 overflow-hidden">
            <Building2 className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
            <div className="flex flex-col items-start overflow-hidden">
              <span className="text-sm font-medium truncate w-full">
                {selectedChapter?.tenantName || "Select Chapter"}
              </span>
              {selectedChapter && (
                <Badge variant="secondary" className="text-xs">
                  {selectedChapter.role}
                </Badge>
              )}
            </div>
          </div>
          <ChevronDown className="ml-2 h-4 w-4 flex-shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <div className="flex flex-col gap-2 p-2">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search chapters..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
              data-testid="input-chapter-search"
            />
          </div>

          {/* Chapter count */}
          <div className="px-2 py-1 text-xs text-muted-foreground">
            {filteredChapters.length} of {userChapters.length} chapters
          </div>

          {/* Chapter list */}
          <div className="flex flex-col gap-1 max-h-[300px] overflow-y-auto">
            {filteredChapters.length === 0 ? (
              <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                No chapters found
              </div>
            ) : (
              filteredChapters.map((chapter) => {
                const isSelected = chapter.tenantId === selectedTenantId;
                return (
                  <Button
                    key={chapter.tenantId}
                    variant="ghost"
                    className={cn(
                      "justify-start gap-2 h-auto py-2",
                      isSelected && "bg-accent"
                    )}
                    onClick={() => {
                      setSelectedChapter(chapter.tenantId);
                      setOpen(false);
                      setSearch("");
                    }}
                    data-testid={`button-select-chapter-${chapter.tenantId}`}
                  >
                    <Check
                      className={cn(
                        "h-4 w-4 flex-shrink-0",
                        isSelected ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col items-start overflow-hidden flex-1">
                      <span className="text-sm font-medium truncate w-full">
                        {chapter.tenantName}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {chapter.role}
                      </Badge>
                    </div>
                  </Button>
                );
              })
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
