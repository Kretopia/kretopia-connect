import { Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function CompanyModeBadge({ className }: { className?: string }) {
  return (
    <Badge variant="outline" className={cn("gap-1.5 border-primary/30 bg-primary/5 text-foreground", className)}>
      <Building2 aria-hidden className="h-3.5 w-3.5 text-primary" />
      Company mode
    </Badge>
  );
}