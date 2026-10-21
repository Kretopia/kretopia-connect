import { useEffect, useState } from "react";
import type { CarouselApi } from "@/components/ui/carousel";

/**
 * True only when the carousel has somewhere to go: false while it is still starting and whenever every slide already
 * fits, so a short list shows no previous/next controls that would do nothing. Follows resizes and re-initialisation.
 */
export function useCarouselScrollable(api: CarouselApi | undefined): boolean {
  const [scrollable, setScrollable] = useState(false);

  useEffect(() => {
    if (!api) {
      setScrollable(false);
      return;
    }
    const update = () => setScrollable(api.canScrollPrev() || api.canScrollNext());
    update();
    api.on("reInit", update);
    api.on("resize", update);
    api.on("select", update);
    return () => {
      api.off("reInit", update);
      api.off("resize", update);
      api.off("select", update);
    };
  }, [api]);

  return scrollable;
}
