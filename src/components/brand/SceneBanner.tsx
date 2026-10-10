import { BrandLogo } from "@/components/BrandLogo";
import { cn } from "@/lib/utils";
import { KretoScene } from "./KretoScene";
import type { KretoSceneId } from "./kretoScenes";

interface SceneBannerProps {
  scene: KretoSceneId;
  /** Words after the K in the corner chip, e.g. "Passport" gives "Kretopia · Passport". */
  label?: string;
  /** Shape and size come from the slot (`h-28`, `h-36 rounded-3xl border`, ...). */
  className?: string;
  /** Draw the K chip. Off where the banner already sits under another brand mark. */
  brand?: boolean;
  /** Fade the bottom edge into the surface below (cards); off for a framed banner. */
  fade?: boolean;
  lazy?: boolean;
}

/**
 * A Kreto scene as a full-width banner, signed Kretopia: the scene fills the
 * slot, a small K chip names the brand (and the feature) in the corner, and
 * the bottom edge can melt into the card under it. Decorative: no alt text.
 */
export function SceneBanner({ scene, label, className, brand = true, fade = false, lazy = true }: SceneBannerProps) {
  return (
    <div className={cn("relative isolate overflow-hidden", className)}>
      <KretoScene scene={scene} lazy={lazy} className="h-full w-full" />
      {fade && <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-card to-transparent" />}
      {brand && (
        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-card/90 py-1 pl-1.5 pr-3 text-[10px] font-bold uppercase tracking-[0.16em] text-foreground">
          <BrandLogo iconOnly size="sm" className="[&_img]:h-4 [&_img]:w-4" />
          {label ? `Kretopia · ${label}` : "Kretopia"}
        </span>
      )}
    </div>
  );
}

export default SceneBanner;
