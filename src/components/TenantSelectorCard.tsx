import { useTenantContext } from "@/contexts/TenantContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Building2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const TenantSelectorCard = () => {
  const { selectedTenant, availableTenants, setSelectedTenant, isLoading } = useTenantContext();

  if (isLoading) {
    return (
      <Card className="border-2">
        <CardContent className="p-3">
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2">
      <CardContent className="p-3">
        <Select 
          value={selectedTenant?.tenant_id || ""} 
          onValueChange={setSelectedTenant}
        >
          <SelectTrigger className="border-0 focus:ring-0 h-auto p-0">
            <div className="flex items-center gap-3 w-full">
              {/* Logo or Icon */}
              {selectedTenant?.logo_url ? (
                <img 
                  src={selectedTenant.logo_url} 
                  alt="Logo" 
                  className="h-10 w-10 rounded object-cover flex-shrink-0"
                />
              ) : (
                <div className="h-10 w-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              
              {/* Tenant Name */}
              <div className="flex-1 text-left min-w-0">
                <SelectValue placeholder="เลือก Chapter">
                  {selectedTenant ? (
                    <span className="font-medium truncate block">{selectedTenant.name}</span>
                  ) : (
                    <span className="text-muted-foreground">เลือก Chapter</span>
                  )}
                </SelectValue>
              </div>
            </div>
          </SelectTrigger>
          
          <SelectContent>
            {availableTenants.map((tenant) => (
              <SelectItem key={tenant.tenant_id} value={tenant.tenant_id}>
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  {tenant.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
};

export default TenantSelectorCard;
