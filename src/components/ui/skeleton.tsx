import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  shimmer?: boolean;
}

function Skeleton({ className, shimmer = false, ...props }: SkeletonProps) {
  return (
    <div 
      className={cn(
        "rounded-md bg-muted relative overflow-hidden",
        shimmer ? "after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-background/20 after:to-transparent after:animate-shimmer" : "animate-pulse",
        className
      )} 
      {...props} 
    />
  );
}

export { Skeleton };
