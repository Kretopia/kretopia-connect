import * as React from "react";
import { cn } from "@/lib/utils";
import type { CarouselApi } from "@/components/ui/carousel";

export interface CarouselPositionDotsProps {
  api: CarouselApi | undefined;
  label: string;
  className?: string;
}

/**
 * Live position-dot indicator for an Embla-backed Carousel. Shared by
 * GlassCarousel and every Studio-home rail so the selection-tracking
 * logic exists in exactly one place.
 */
export const CarouselPositionDots = ({ api, label, className }: CarouselPositionDotsProps) => {
  const [selected, setSelected] = React.useState(0);
  const [count, setCount] = React.useState(0);

  React.useEffect(() => {
    if (!api) return;
    setCount(api.scrollSnapList().length);
    setSelected(api.selectedScrollSnap());
    const onSelect = () => setSelected(api.selectedScrollSnap());
    api.on("select", onSelect);
    api.on("reInit", onSelect);
    return () => {
      api.off("select", onSelect);
      api.off("reInit", onSelect);
    };
  }, [api]);

  if (count <= 1) return null;

  return (
    <div className={cn("flex items-center justify-center gap-1.5", className)} role="tablist" aria-label={`${label} position`}>
      {Array.from({ length: count }).map((_, i) => (
        <button
          key={i}
          type="button"
          role="tab"
          aria-selected={i === selected}
          aria-label={`Go to slide ${i + 1} of ${count}`}
          onClick={() => api?.scrollTo(i)}
          className={cn(
            "h-1.5 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-accent))]",
            i === selected ? "w-4 bg-[hsl(var(--color-accent))]" : "w-1.5 bg-white/20 hover:bg-white/35",
          )}
        />
      ))}
    </div>
  );
};

export default CarouselPositionDots;
