import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const statusConfig: Record<string, { variant: string; label: string }> = {
  // Participant statuses (5 types)
  prospect: { variant: "warning", label: "🟡 ผู้สนใจ" },
  visitor: { variant: "success", label: "🟢 ผู้เยี่ยมชม" },
  declined: { variant: "destructive", label: "🔴 ไม่สนใจ" },
  member: { variant: "info", label: "🔵 สมาชิก" },
  alumni: { variant: "secondary", label: "⚫ อดีตสมาชิก" },
  
  // Payment statuses
  
  // Payment statuses
  pending: { variant: "warning", label: "Pending" },
  paid: { variant: "success", label: "Paid" },
  waived: { variant: "info", label: "Waived" },
  failed: { variant: "destructive", label: "Failed" },
  refunded: { variant: "secondary", label: "Refunded" },
  
  // Tenant statuses
  active: { variant: "success", label: "Active" },
  suspended: { variant: "destructive", label: "Suspended" },
  cancelled: { variant: "secondary", label: "Cancelled" },
  
  // Subscription statuses
  canceled: { variant: "secondary", label: "Canceled" },
  past_due: { variant: "warning", label: "Past Due" },
  
  // Invoice statuses
  unpaid: { variant: "warning", label: "Unpaid" },
  void: { variant: "secondary", label: "Void" },
};

export const StatusBadge = ({ status, className }: StatusBadgeProps) => {
  const config = statusConfig[status] || { variant: "secondary", label: status };
  
  const variantClasses = {
    success: "bg-success/10 text-success border-success/20 hover:bg-success/20",
    warning: "bg-warning/10 text-warning border-warning/20 hover:bg-warning/20",
    info: "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20",
    destructive: "bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20",
    secondary: "bg-secondary text-secondary-foreground",
  };
  
  return (
    <Badge 
      variant="outline"
      className={cn(
        variantClasses[config.variant as keyof typeof variantClasses],
        className
      )}
    >
      {config.label}
    </Badge>
  );
};
