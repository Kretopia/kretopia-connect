import { Skeleton } from "@/components/ui/skeleton";

export const ConversationListSkeleton = () => (
  <div className="divide-y divide-border">
    {Array.from({ length: 6 }).map((_, i) => (
      <div
        key={i}
        className="flex items-start gap-3 p-4 animate-pulse"
        style={{ animationDelay: `${i * 80}ms` }}
      >
        <Skeleton shimmer className="h-12 w-12 rounded-full flex-shrink-0" />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex justify-between">
            <Skeleton shimmer className="h-4 w-28" />
            <Skeleton shimmer className="h-3 w-12" />
          </div>
          <Skeleton shimmer className="h-3 w-3/4" />
        </div>
      </div>
    ))}
  </div>
);

export const ChatMessagesSkeleton = () => (
  <div className="space-y-4 p-4">
    {[false, true, false, true, false].map((isOwn, i) => (
      <div key={i} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
        <div className={`max-w-[70%] space-y-1.5 ${isOwn ? "items-end" : "items-start"}`}>
          <Skeleton
            shimmer
            className={`h-10 rounded-2xl ${isOwn ? "w-48" : "w-56"}`}
          />
          <Skeleton shimmer className="h-3 w-16" />
        </div>
      </div>
    ))}
  </div>
);

export const CreatorGridSkeleton = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
    {Array.from({ length: 9 }).map((_, i) => (
      <div
        key={i}
        className="rounded-xl border bg-card p-5 space-y-4 animate-pulse"
        style={{ animationDelay: `${i * 60}ms` }}
      >
        <div className="flex items-center gap-3">
          <Skeleton shimmer className="h-14 w-14 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton shimmer className="h-4 w-28" />
            <Skeleton shimmer className="h-3 w-20" />
          </div>
        </div>
        <Skeleton shimmer className="h-3 w-full" />
        <Skeleton shimmer className="h-3 w-4/5" />
        <div className="flex gap-2">
          <Skeleton shimmer className="h-6 w-16 rounded-full" />
          <Skeleton shimmer className="h-6 w-16 rounded-full" />
          <Skeleton shimmer className="h-6 w-16 rounded-full" />
        </div>
        <Skeleton shimmer className="h-9 w-full rounded-md" />
      </div>
    ))}
  </div>
);
