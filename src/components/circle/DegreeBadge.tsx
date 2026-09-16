import { Badge } from "@/components/ui/badge";
import { Users, Link2, Network, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface DegreeBadgeProps {
  degree: number | null;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

export function DegreeBadge({ degree, size = "sm", showLabel = true, className }: DegreeBadgeProps) {
  if (degree === null || degree === 0) return null;

  const config = {
    1: {
      label: "1st",
      fullLabel: "1st degree",
      icon: UserCheck,
      className: "bg-primary/20 text-primary border-primary/30 hover:bg-primary/30"
    },
    2: {
      label: "2nd",
      fullLabel: "2nd degree",
      icon: Link2,
      className: "bg-accent/20 text-accent-foreground border-accent/30 hover:bg-accent/30"
    },
    3: {
      label: "3rd",
      fullLabel: "3rd degree",
      icon: Network,
      className: "bg-muted text-muted-foreground border-muted-foreground/30 hover:bg-muted/80"
    }
  };

  const degreeConfig = config[degree as 1 | 2 | 3];
  if (!degreeConfig) return null;

  const Icon = degreeConfig.icon;
  const sizeClasses = {
    sm: "text-[10px] px-1.5 py-0.5 gap-0.5",
    md: "text-xs px-2 py-1 gap-1",
    lg: "text-sm px-2.5 py-1.5 gap-1.5"
  };

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-3.5 w-3.5",
    lg: "h-4 w-4"
  };

  return (
    <Badge 
      variant="outline" 
      className={cn(
        "font-medium border",
        sizeClasses[size],
        degreeConfig.className,
        className
      )}
    >
      <Icon className={iconSizes[size]} />
      {showLabel && (size === "lg" ? degreeConfig.fullLabel : degreeConfig.label)}
    </Badge>
  );
}

interface ConnectionPathDisplayProps {
  path: Array<{
    userId: string;
    fullName: string;
    avatarUrl: string | null;
    role: string | null;
  }>;
  targetName?: string;
  className?: string;
}

export function ConnectionPathDisplay({ path, targetName, className }: ConnectionPathDisplayProps) {
  if (!path || path.length === 0) return null;

  return (
    <div className={cn("flex items-center gap-1 text-xs text-muted-foreground", className)}>
      <span>Connected via</span>
      {path.map((connection, index) => (
        <span key={connection.userId} className="font-medium text-foreground">
          {connection.fullName}
          {index < path.length - 1 && " → "}
        </span>
      ))}
      {targetName && (
        <>
          <span className="text-muted-foreground"> → </span>
          <span className="font-medium text-foreground">{targetName}</span>
        </>
      )}
    </div>
  );
}
