import { Skeleton } from "@/components/ui/skeleton";

export const SwipeCardSkeleton = () => (
  <div className="flex flex-col items-center gap-4 pt-4">
    {/* Tab bar skeleton */}
    <div className="flex gap-2 w-full max-w-md px-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} shimmer className="h-9 flex-1 rounded-lg" />
      ))}
    </div>
    {/* Card skeleton */}
    <div className="w-full max-w-sm mx-auto px-4">
      <div className="aspect-[3/4] rounded-2xl overflow-hidden relative">
        <Skeleton shimmer className="h-full w-full" />
        <div className="absolute bottom-0 left-0 right-0 p-5 space-y-3">
          <Skeleton shimmer className="h-6 w-40 bg-white/20" />
          <Skeleton shimmer className="h-4 w-28 bg-white/20" />
          <div className="flex gap-2">
            <Skeleton shimmer className="h-6 w-16 rounded-full bg-white/20" />
            <Skeleton shimmer className="h-6 w-16 rounded-full bg-white/20" />
          </div>
        </div>
      </div>
    </div>
    {/* Action buttons skeleton */}
    <div className="flex gap-6 pt-2">
      <Skeleton shimmer className="h-14 w-14 rounded-full" />
      <Skeleton shimmer className="h-14 w-14 rounded-full" />
      <Skeleton shimmer className="h-14 w-14 rounded-full" />
    </div>
  </div>
);

export const ConnectionListSkeleton = () => (
  <div className="space-y-3 px-4">
    {Array.from({ length: 8 }).map((_, i) => (
      <div
        key={i}
        className="flex items-center gap-3 p-3 rounded-xl animate-pulse"
        style={{ animationDelay: `${i * 60}ms` }}
      >
        <Skeleton shimmer className="h-12 w-12 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton shimmer className="h-4 w-32" />
          <Skeleton shimmer className="h-3 w-24" />
        </div>
        <Skeleton shimmer className="h-8 w-20 rounded-md" />
      </div>
    ))}
  </div>
);
