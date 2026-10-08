import { forwardRef, type HTMLAttributes } from "react";
import kMarkAsset from "@/assets/brand/kretopia-k-mark.png.asset.json";
import { cn } from "@/lib/utils";

/**
 * The one Kretopia loading indicator: the real K-mark breathing inside a
 * slowly rotating brand-gradient ring (the look PassportLoader introduced).
 * Every wait state in the product uses this -- never a lucide spinner, a CSS
 * border ring, bare "Loading..." text or the old orbit/dots loaders.
 *
 *   <KretopiaSpinner className="h-4 w-4" />        // inline: buttons, rows, chips
 *   <KretopiaLoader label="Loading events…" />      // block: a card or section
 *   <KretopiaLoader size="page" />                  // a whole page / route
 *
 * The motion is pure CSS (`.k-spinner*` in index.css) so hundreds of inline
 * instances stay cheap, and it falls back to a soft opacity pulse under
 * prefers-reduced-motion.
 */

const SPIN_CLASS = /(^|\s)animate-spin(?=\s|$)/g;

/** `animate-spin` was the old spinner's motion; the ring animates itself now. */
const withoutSpin = (className?: string) => className?.replace(SPIN_CLASS, " ").trim() || undefined;

export interface KretopiaSpinnerProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  /** Pixel size; omit to size with Tailwind (`h-4 w-4`) like any icon. Defaults to 24px. */
  size?: number;
}

/**
 * Inline spinner, a drop-in for lucide's `Loader2`: it takes the same
 * `className`/`style`, sizes from `h-*`/`w-*`, and is hidden from assistive
 * tech unless an `aria-label` is passed (the surrounding button/label already
 * says what is happening).
 */
export const KretopiaSpinner = forwardRef<HTMLSpanElement, KretopiaSpinnerProps>(function KretopiaSpinner(
  { className, style, size, "aria-label": ariaLabel, ...rest },
  ref,
) {
  return (
    <span
      ref={ref}
      role={ariaLabel ? "status" : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      className={cn("k-spinner", withoutSpin(className))}
      style={size ? { width: size, height: size, ...style } : style}
      {...rest}
    >
      <span className="k-spinner__ring" aria-hidden />
      <img
        src={kMarkAsset.url}
        alt=""
        aria-hidden
        draggable={false}
        decoding="async"
        className="k-spinner__mark"
        // if the mark can't load (offline, blocked) keep the ring, not a broken-image icon
        onError={(e) => {
          e.currentTarget.style.visibility = "hidden";
        }}
      />
    </span>
  );
});

const LOADER_SIZES = {
  sm: { box: "h-8 w-8", gap: "gap-2", pad: "py-4", text: "text-xs", glow: false },
  md: { box: "h-14 w-14", gap: "gap-3", pad: "py-8", text: "text-xs", glow: false },
  lg: { box: "h-24 w-24", gap: "gap-5", pad: "py-12", text: "text-sm", glow: true },
  page: { box: "h-24 w-24", gap: "gap-5", pad: "min-h-[60vh] py-12", text: "text-sm", glow: true },
} as const;

export type KretopiaLoaderSize = keyof typeof LOADER_SIZES;

export interface KretopiaLoaderProps {
  /** Short status shown under the mark and announced to screen readers. */
  label?: string;
  /** Optional second line under the label. */
  hint?: string;
  size?: KretopiaLoaderSize;
  /** Fill the viewport (route-level fallbacks). Overrides the size's own height. */
  fullscreen?: boolean;
  className?: string;
}

/** Block loader: the spinner centred, with an optional label and hint. */
export function KretopiaLoader({ label, hint, size = "md", fullscreen = false, className }: KretopiaLoaderProps) {
  const s = LOADER_SIZES[size];
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label ?? "Loading"}
      className={cn(
        "flex flex-col items-center justify-center text-center",
        s.gap,
        fullscreen ? "min-h-screen w-full" : s.pad,
        className,
      )}
    >
      <span className="relative inline-flex">
        {s.glow && (
          <span
            aria-hidden
            className="absolute inset-2 rounded-full opacity-40 blur-lg"
            style={{ background: "radial-gradient(circle, #E0179C, transparent 70%)" }}
          />
        )}
        <KretopiaSpinner className={cn("relative", s.box)} />
      </span>
      {label && <p className={cn("font-medium text-muted-foreground", s.text)}>{label}</p>}
      {hint && <p className={cn("max-w-xs text-muted-foreground/80", s.text)}>{hint}</p>}
    </div>
  );
}

export default KretopiaLoader;
