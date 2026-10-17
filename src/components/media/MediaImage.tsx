import { useEffect, useRef, useState, type ImgHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface MediaImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "onError" | "onLoad"> {
  /** The real image. Null, empty or a URL that fails to load shows `fallback`. */
  src: string | null | undefined;
  alt: string;
  /** Tailwind aspect utility, e.g. "aspect-[16/9]". The box is reserved before the image arrives, so nothing shifts. */
  aspect: string;
  /** Shown when there is no image, while it loads, and if it fails. */
  fallback: ReactNode;
  /** Above the fold only: loads eagerly and at high priority. Everything else is lazy. */
  priority?: boolean;
  /** Class for the reserved box (rounding, width). */
  className?: string;
  /** Class for the <img> itself. */
  imgClassName?: string;
}

/**
 * One way to show a real picture of a real thing (an event cover, a person, a
 * cover image): the box has its final shape from the first paint, the picture
 * is lazy and decoded off the main thread, it fades in over the fallback, and
 * a broken URL falls back instead of leaving a broken-image icon.
 *
 * There is deliberately no resizing here: images are served as uploaded, and
 * asking the storage layer for thumbnails is a separate, paid decision.
 */
export function MediaImage({
  src,
  alt,
  aspect,
  fallback,
  priority = false,
  className,
  imgClassName,
  ...imgProps
}: MediaImageProps) {
  const [status, setStatus] = useState<"loading" | "loaded" | "failed">(src ? "loading" : "failed");
  const ref = useRef<HTMLImageElement>(null);

  // A new URL starts over; an image that finished loading before React
  // attached its handler (cache hit) never fires onLoad, so check `complete`.
  useEffect(() => {
    if (!src) {
      setStatus("failed");
      return;
    }
    const el = ref.current;
    setStatus(el?.complete && el.naturalWidth > 0 ? "loaded" : "loading");
  }, [src]);

  return (
    <div className={cn("relative overflow-hidden bg-muted", aspect, className)}>
      {status !== "loaded" && <div className="absolute inset-0">{fallback}</div>}
      {src && status !== "failed" && (
        <img
          ref={ref}
          src={src}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          {...(priority ? ({ fetchpriority: "high" } as Record<string, string>) : {})}
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("failed")}
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-100 motion-reduce:transition-none",
            status === "loaded" ? "opacity-100" : "opacity-0",
            imgClassName,
          )}
          {...imgProps}
        />
      )}
    </div>
  );
}

export default MediaImage;
