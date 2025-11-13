import { useTenantContext } from "@/contexts/TenantContext";
import { useUserTenantInfo } from "@/hooks/useUserTenantInfo";
import { useAvailableTenants } from "@/hooks/useAvailableTenants";
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
    setSelectedTenant, 
    isLoading: contextLoading,
  } = useTenantContext();
  
  // Get query states directly
  const userInfoQuery = useUserTenantInfo();
  const tenantsQuery = useAvailableTenants(userInfoQuery.data?.isSuperAdmin || false);

  // Show skeleton only during true initial load (no cached data)
  const isInitialLoading = contextLoading && !tenantsQuery.data;

  if (isInitialLoading) {
    return (
      <Card className="border-2">
        <CardContent className="p-3">
          <Skeleton className="h-10 w-full" data-testid="skeleton-tenant-selector" />
        </CardContent>
      </Card>
    );
  }

  // Show error state with retry button
  if (tenantsQuery.isError) {
    return (
      <Card className="border-2">
        <CardContent className="p-3 space-y-2">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="ml-2">
              {tenantsQuery.error?.message || "ไม่สามารถโหลดรายชื่อ Tenant ได้"}
            </AlertDescription>
          </Alert>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => tenantsQuery.refetch()}
            disabled={tenantsQuery.isFetching}
            className="w-full"
            data-testid="button-retry-tenants"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${tenantsQuery.isFetching ? 'animate-spin' : ''}`} />
            {tenantsQuery.isFetching ? 'กำลังโหลด...' : 'ลองใหม่'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Show loading state while fetching (but show stale data underneath)
  const availableTenants = tenantsQuery.data || [];

  return (
    <Card className="border-2">
      <CardContent className="p-3">
        {tenantsQuery.isFetching && tenantsQuery.data && (
          <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
            <RefreshCw className="h-3 w-3 animate-spin" />
            <span>กำลังอัปเดต...</span>
          </div>
        )}
        
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
