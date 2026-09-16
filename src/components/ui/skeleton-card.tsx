import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface SkeletonCardProps {
  className?: string;
  animate?: boolean;
}

export const SkeletonCard = ({ className, animate = true }: SkeletonCardProps) => (
  <Card className={cn("animate-slide-up", className)}>
    <CardHeader>
      <Skeleton shimmer={animate} className="h-5 w-3/4" />
    </CardHeader>
    <CardContent>
      <Skeleton shimmer={animate} className="h-4 w-full mb-2" />
      <Skeleton shimmer={animate} className="h-4 w-5/6" />
    </CardContent>
  </Card>
);

export const SkeletonStat = ({ className }: { className?: string }) => (
  <Card className={cn("animate-slide-up", className)}>
    <CardContent className="pt-6">
      <div className="flex items-center justify-between">
        <Skeleton shimmer className="h-8 w-8 rounded-full" />
        <Skeleton shimmer className="h-6 w-16" />
      </div>
      <Skeleton shimmer className="h-4 w-24 mt-2" />
    </CardContent>
  </Card>
);

export const SkeletonLeaderboardItem = () => (
  <Card className="p-4 animate-slide-up">
    <div className="flex items-center gap-4">
      <Skeleton shimmer className="h-12 w-12 rounded-full" />
      <div className="flex-1">
        <Skeleton shimmer className="h-5 w-32 mb-2" />
        <Skeleton shimmer className="h-4 w-24" />
      </div>
      <div className="text-right">
        <Skeleton shimmer className="h-5 w-20 mb-1" />
        <Skeleton shimmer className="h-4 w-16" />
      </div>
    </div>
  </Card>
);

export const SkeletonProfile = () => (
  <div className="space-y-4 animate-slide-up">
    {/* Hero skeleton */}
    <div className="flex items-center gap-4 p-4">
      <Skeleton shimmer className="h-20 w-20 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton shimmer className="h-6 w-40" />
        <Skeleton shimmer className="h-4 w-24" />
        <Skeleton shimmer className="h-4 w-32" />
      </div>
    </div>
    {/* Content skeleton */}
    <div className="space-y-4 px-4">
      <Skeleton shimmer className="h-32 w-full rounded-xl" />
      <Skeleton shimmer className="h-24 w-full rounded-xl" />
      <Skeleton shimmer className="h-24 w-full rounded-xl" />
    </div>
  </div>
);

export const SkeletonMatchCard = () => (
  <div className="aspect-[3/4] rounded-2xl overflow-hidden animate-slide-up">
    <Skeleton shimmer className="h-full w-full" />
  </div>
);

export const SkeletonList = ({ count = 3 }: { count?: number }) => (
  <div className="space-y-3">
    {Array.from({ length: count }).map((_, i) => (
      <div 
        key={i} 
        className="flex items-center gap-3 p-3 rounded-lg animate-slide-up"
        style={{ animationDelay: `${i * 100}ms` }}
      >
        <Skeleton shimmer className="h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton shimmer className="h-4 w-3/4" />
          <Skeleton shimmer className="h-3 w-1/2" />
        </div>
      </div>
    ))}
  </div>
);
