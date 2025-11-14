import { useTenantContext } from "@/contexts/TenantContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, RefreshCw, Globe } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const TenantSelectorCard = () => {
  const { 
    selectedTenant,
    selectedTenantId,
    availableTenants,
    setSelectedTenant,
    isLoading,
    isReady,
    isSuperAdmin,
  } = useTenantContext();

  // Show skeleton while loading or before ready state
  const isInitialLoading = isLoading || !isReady;

  if (isInitialLoading) {
    return (
      <Card className="border-2">
        <CardContent className="p-3">
          <Skeleton className="h-10 w-full" data-testid="skeleton-tenant-selector" />
        </CardContent>
      </Card>
    );
  }

  // Handle value change: convert "__all__" to null
  const handleValueChange = (value: string) => {
    if (value === "__all__") {
      setSelectedTenant(null);
    } else {
      setSelectedTenant(value);
    }
  };

  // Determine select value: null → "__all__"
  const selectValue = selectedTenantId === null ? "__all__" : (selectedTenantId || "");

  return (
    <Card className="border-2">
      <CardContent className="p-3">
        <Select 
          value={selectValue} 
          onValueChange={handleValueChange}
          data-testid="select-tenant"
        >
          <SelectTrigger className="border-0 focus:ring-0 h-auto p-0" data-testid="trigger-tenant">
            <div className="flex items-center gap-3 w-full">
              {selectedTenant?.logo_url ? (
                <img 
                  src={selectedTenant.logo_url} 
                  alt="Logo" 
                  className="h-10 w-10 rounded object-cover flex-shrink-0"
                />
              ) : (
                <div className="h-10 w-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
                  {selectedTenantId === null ? (
                    <Globe className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              )}
              
              <div className="flex-1 text-left min-w-0">
                <SelectValue placeholder="เลือก Chapter">
                  {selectedTenant ? (
                    <span className="font-medium truncate block">{selectedTenant.tenant_name}</span>
                  ) : selectedTenantId === null && isSuperAdmin ? (
                    <span className="font-medium">All Tenants</span>
                  ) : (
                    <span className="text-muted-foreground">เลือก Chapter</span>
                  )}
                </SelectValue>
              </div>
            </div>
          </SelectTrigger>
          
          <SelectContent>
            {isSuperAdmin && (
              <SelectItem value="__all__" data-testid="item-tenant-all">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  <span className="font-medium">All Tenants</span>
                </div>
              </SelectItem>
            )}
            
            {availableTenants.map((tenant) => (
              <SelectItem 
                key={tenant.tenant_id} 
                value={tenant.tenant_id}
                data-testid={`item-tenant-${tenant.tenant_id}`}
              >
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  {tenant.tenant_name}
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
