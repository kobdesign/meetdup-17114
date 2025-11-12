import { useTenantContext } from "@/contexts/TenantContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2 } from "lucide-react";

const TenantSelector = () => {
  const { selectedTenantId, availableTenants, setSelectedTenant, isLoading } = useTenantContext();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Building2 className="h-4 w-4" />
        <span>กำลังโหลด...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Building2 className="h-4 w-4 text-muted-foreground" />
      <Select value={selectedTenantId || ""} onValueChange={setSelectedTenant}>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="เลือก Chapter" />
        </SelectTrigger>
        <SelectContent>
          {availableTenants.map((tenant) => (
            <SelectItem key={tenant.tenant_id} value={tenant.tenant_id}>
              {tenant.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default TenantSelector;
