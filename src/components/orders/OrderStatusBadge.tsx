import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle, Shield, AlertTriangle, Package, Download, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Clock; className: string }> = {
  completed: { label: "Completed", icon: CheckCircle, className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
  escrow: { label: "In Escrow", icon: Shield, className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" },
  pending: { label: "Pending", icon: Clock, className: "bg-muted text-muted-foreground border-border" },
  disputed: { label: "Disputed", icon: AlertTriangle, className: "bg-destructive/10 text-destructive border-destructive/20" },
  refunded: { label: "Refunded", icon: AlertTriangle, className: "bg-muted text-muted-foreground border-border" },
};

const DELIVERY_CONFIG: Record<string, { label: string; icon: typeof Clock }> = {
  pending: { label: "Awaiting Fulfillment", icon: Clock },
  shipped: { label: "Shipped", icon: Package },
  delivered: { label: "Delivered", icon: CheckCircle },
  completed: { label: "Service Complete", icon: Wrench },
};

const TYPE_CONFIG: Record<string, { label: string; icon: typeof Download; className: string }> = {
  digital: { label: "Digital", icon: Download, className: "bg-primary/10 text-primary dark:text-primary" },
  physical: { label: "Physical", icon: Package, className: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  service: { label: "Service", icon: Wrench, className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
};

export function OrderStatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const Icon = config.icon;
  return (
    <Badge variant="outline" className={cn("gap-1 font-medium", config.className)}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

export function DeliveryStatusBadge({ status }: { status: string }) {
  const config = DELIVERY_CONFIG[status] || DELIVERY_CONFIG.pending;
  const Icon = config.icon;
  return (
    <Badge variant="secondary" className="gap-1 text-xs">
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

export function ListingTypeBadge({ type }: { type: string }) {
  const config = TYPE_CONFIG[type] || TYPE_CONFIG.digital;
  const Icon = config.icon;
  return (
    <Badge variant="secondary" className={cn("gap-1 border-0 text-xs", config.className)}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}
