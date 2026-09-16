import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  type CarouselApi,
} from "@/components/ui/carousel";
import { CarouselPositionDots } from "@/components/ui/glass/CarouselPositionDots";
import { useReducedMotion } from "@/hooks/useReducedMotion";

export { CarouselItem as GlassCarouselItem };

export interface GlassCarouselProps {
  children: React.ReactNode;
  className?: string;
  /** Loading skeleton state — pass a fixed count of placeholder cards. */
  loading?: boolean;
  loadingCount?: number;
  /** Empty state — shown instead of the carousel when there's nothing to scroll. */
  empty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  /** Accessible label for the carousel region (e.g. "Live sound stages"). */
  label: string;
}

/**
 * Batteries-included Liquid Glass carousel: horizontal scroll + swipe +
 * snap (via embla, from the base Carousel), glass prev/next buttons,
 * a visible position-dot indicator, keyboard arrow support (inherited),
 * and loading/empty states so callers don't have to build those per use.
 */
export const GlassCarousel = ({
  children,
  className,
  loading = false,
  loadingCount = 4,
  empty = false,
  emptyTitle = "Nothing here yet",
  emptyDescription,
  label,
}: GlassCarouselProps) => {
  const [api, setApi] = React.useState<CarouselApi>();
  const reducedMotion = useReducedMotion();

  if (loading) {
    return (
      <div className={cn("flex gap-3 overflow-hidden", className)} aria-busy="true" aria-label={`${label} — loading`}>
        {Array.from({ length: loadingCount }).map((_, i) => (
          <div key={i} className="h-40 w-56 shrink-0 rounded-2xl glass-surface animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
        ))}
      </div>
    );
  }

  if (empty) {
    return (
      <div className={cn("rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-center", className)}>
        <p className="text-sm font-semibold text-foreground">{emptyTitle}</p>
        {emptyDescription && <p className="mt-1 text-xs text-muted-foreground">{emptyDescription}</p>}
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      <Carousel
        setApi={setApi}
        opts={{ align: "start", dragFree: true, duration: reducedMotion ? 0 : 20 }}
        className="w-full"
        aria-label={label}
      >
        <CarouselContent className="-ml-3">{children}</CarouselContent>
        <CarouselPrevious variant="glass" className="hidden sm:flex -left-3" aria-label={`Previous — ${label}`} />
        <CarouselNext variant="glass" className="hidden sm:flex -right-3" aria-label={`Next — ${label}`} />
      </Carousel>

      <CarouselPositionDots api={api} label={label} className="mt-2" />
    </div>
  );
};
GlassCarousel.displayName = "GlassCarousel";

export default GlassCarousel;
