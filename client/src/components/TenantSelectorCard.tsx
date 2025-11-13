import { useTenantContext } from "@/contexts/TenantContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, RefreshCw, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

const TenantSelectorCard = () => {
  const { 
    selectedTenant, 
    availableTenants, 
    setSelectedTenant, 
    isLoading, 
    isLoadingTenants, 
    tenantsError,
    retryLoadTenants 
  } = useTenantContext();

  if (isLoading) {
    return (
      <Card className="border-2">
        <CardContent className="p-3">
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (tenantsError) {
    return (
      <Card className="border-2">
        <CardContent className="p-3 space-y-2">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="ml-2">
              {tenantsError}
            </AlertDescription>
          </Alert>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={retryLoadTenants}
            disabled={isLoadingTenants}
            className="w-full"
            data-testid="button-retry-tenants"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingTenants ? 'animate-spin' : ''}`} />
            {isLoadingTenants ? 'กำลังโหลด...' : 'ลองใหม่'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isLoadingTenants) {
    return (
      <Card className="border-2">
        <CardContent className="p-3">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">กำลังโหลดรายชื่อ Chapter...</span>
          </div>
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
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              
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
              <SelectItem 
                key={tenant.tenant_id} 
                value={tenant.tenant_id}
                data-testid={`item-tenant-${tenant.tenant_id}`}
              >
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
