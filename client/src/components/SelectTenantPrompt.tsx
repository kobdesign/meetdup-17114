import { Card, CardContent } from "@/components/ui/card";
import { Building2, ChevronDown } from "lucide-react";

interface SelectTenantPromptProps {
  message?: string;
  description?: string;
}

export default function SelectTenantPrompt({ 
  message = "กรุณาเลือก Chapter ก่อน",
  description = "เนื่องจากคุณเป็น Super Admin กรุณาเลือก Chapter ที่ต้องการดูข้อมูลจากเมนูด้านบน"
}: SelectTenantPromptProps) {
  return (
    <div className="flex items-center justify-center min-h-[400px]" data-testid="select-tenant-prompt">
      <Card className="max-w-md">
        <CardContent className="pt-6 pb-6 text-center">
          <div className="mb-4 flex justify-center">
            <div className="relative">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Building2 className="h-8 w-8 text-primary" />
              </div>
              <div className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-warning/20 flex items-center justify-center animate-pulse">
                <ChevronDown className="h-4 w-4 text-warning" />
              </div>
            </div>
          </div>
          <h3 className="text-lg font-semibold mb-2" data-testid="text-prompt-title">
            {message}
          </h3>
          <p className="text-sm text-muted-foreground" data-testid="text-prompt-description">
            {description}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
