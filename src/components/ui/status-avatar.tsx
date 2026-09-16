import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { type StatusTier } from "@/lib/statusEngine";

/**
 * Tier ring styles — Emirates Skywards-inspired prestige rings.
 * Each tier gets a distinctive ring color + optional glow.
 */
const tierRingStyles: Record<StatusTier, string> = {
  hobbyist: "ring-2 ring-border",
  freelancer: "ring-2 ring-muted-foreground/50",
  thriver: "ring-[2.5px] ring-primary shadow-[0_0_8px_1px_hsl(var(--primary)/0.3)]",
  professional: "ring-[3px] ring-accent shadow-[0_0_10px_2px_hsl(var(--accent)/0.35)]",
  celebrity: "ring-[3px] ring-foreground shadow-[0_0_12px_2px_hsl(var(--foreground)/0.2)]",
  icon: "ring-[3px] ring-primary shadow-[0_0_16px_3px_hsl(var(--primary)/0.4)] animate-pulse",
};

interface StatusAvatarProps {
  src?: string | null;
  fallback: string;
  tier?: StatusTier | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  onClick?: () => void;
  /** If provided, frame from rewards shop takes precedence over tier ring */
  frame?: string | null;
}

const sizeClasses = {
  xs: "h-6 w-6",
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-14 w-14",
  xl: "h-20 w-20",
};

const fallbackTextSize = {
  xs: "text-[10px]",
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
  xl: "text-xl",
};

export function StatusAvatar({
  src,
  fallback,
  tier,
  size = "md",
  className,
  onClick,
  frame,
}: StatusAvatarProps) {
  // Reward frames take precedence over tier rings
  const ringClass = frame
    ? "" // handled externally via FramedAvatar if needed
    : tier
      ? tierRingStyles[tier]
      : "";

  return (
    <Avatar
      className={cn(
        sizeClasses[size],
        "transition-all duration-300",
        ringClass,
        className,
      )}
      onClick={onClick}
    >
      <AvatarImage src={src || undefined} />
      <AvatarFallback className={cn(
        "bg-primary/10 text-primary font-semibold",
        fallbackTextSize[size],
      )}>
        {fallback}
      </AvatarFallback>
    </Avatar>
  );
}
