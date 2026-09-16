/**
 * KretoMark — Kretopia's compact identity mark for Kreto: the K-mark logo,
 * not a portrait. Use in place of KretoAvatar wherever a smaller, brand-first
 * signal fits better than the full portrait (chips, inline buttons, empty
 * states, loading rows, contextual recommendation cards).
 *
 * Not a face, not a robot, not a generic AI orb. The mark itself never
 * implies activity on its own -- pass `state` only when something real is
 * happening, and it always carries a paired sr-only label, never color or
 * motion alone.
 *
 * Renders the official multicolor K-mark asset as-is (same image BrandLogo
 * uses in the navbar) rather than recoloring it -- Kreto's own mark used to
 * be masked down to a flat brand-pink fill, which read as a different logo
 * from the one in the navbar instead of the same mark in a smaller context.
 */
import kMarkAsset from "@/assets/brand/kretopia-k-mark.png.asset.json";
import { cn } from "@/lib/utils";

/** "bare" renders just the icon, no surrounding surface/ring at all --
 *  for callers that already provide their own circular surface (e.g. a
 *  launcher FAB) and would otherwise get a nested circle-in-circle look. */
type Variant = "default" | "compact" | "interactive" | "muted" | "status" | "bare";
type Size = "xs" | "sm" | "md" | "lg" | "xl";
/** "recording" is a deliberate, distinct fourth state -- not folded into
 *  "active" -- because a live mic is a safety-relevant signal (matching
 *  KretoAvatar's own prior red-halo treatment), not a branding moment. */
type ActivityState = "idle" | "active" | "pending" | "recording";

const SIZE: Record<Size, { box: string; mark: string }> = {
  xs: { box: "h-6 w-6", mark: "h-3 w-3" },
  sm: { box: "h-8 w-8", mark: "h-4 w-4" },
  md: { box: "h-10 w-10", mark: "h-5 w-5" },
  lg: { box: "h-14 w-14", mark: "h-7 w-7" },
  xl: { box: "h-20 w-20", mark: "h-10 w-10" },
};

const STATE_LABEL: Record<ActivityState, string> = {
  idle: "",
  active: "Kreto is working on this",
  pending: "Kreto is waiting on you",
  recording: "Kreto is recording",
};

interface KretoMarkProps {
  variant?: Variant;
  size?: Size;
  /** Only render a pulse when something is genuinely active/pending -- never invent one. */
  state?: ActivityState;
  /** Required (and enforced via aria-label) when variant is "interactive". */
  label?: string;
  onClick?: () => void;
  className?: string;
}

export const KretoMark = ({
  variant = "default",
  size = "md",
  state = "idle",
  label,
  onClick,
  className,
}: KretoMarkProps) => {
  const s = SIZE[size];
  const isInteractive = variant === "interactive" || !!onClick;
  const showPulse = state !== "idle";

  const surfaceClass = cn(
    "relative inline-flex shrink-0 select-none items-center justify-center rounded-full",
    s.box,
    variant === "compact" && "bg-[hsl(var(--energy))]",
    variant === "muted" && "bg-white/5 opacity-60",
    (variant === "default" || variant === "status") &&
      "bg-[hsl(var(--k-midnight))] ring-1 ring-white/10",
    // "bare": no background/ring -- the caller supplies its own surface.
    isInteractive &&
      "transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--energy))] focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    className,
  );

  const visual = (
    <>
      <img
        aria-hidden
        src={kMarkAsset.url}
        alt=""
        draggable={false}
        className={cn(s.mark, "select-none object-contain", variant === "muted" && "opacity-70")}
      />
      {showPulse && (
        <span
          aria-hidden
          className={cn(
            "absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-background motion-safe:animate-pulse",
            state === "pending" ? "bg-amber-400" : state === "recording" ? "bg-destructive" : "bg-[hsl(var(--energy))]",
          )}
        />
      )}
    </>
  );

  // The state announcement always renders as real, non-hidden text -- never
  // nested inside a decorative aria-hidden wrapper -- so "state is
  // represented in text, not color/motion alone" holds even when this mark
  // is used with no adjacent caption of its own.
  const stateAnnouncement = showPulse ? <span className="sr-only">{STATE_LABEL[state]}</span> : null;

  if (isInteractive) {
    return (
      <button type="button" onClick={onClick} aria-label={label || "Open Kreto"} className={surfaceClass}>
        {visual}
        {stateAnnouncement}
      </button>
    );
  }

  // sr-only is `position: absolute`, so it never affects the caller's flex/grid
  // layout regardless of nesting -- no extra layout wrapper needed here, and
  // `className` (spacing/sizing utilities the caller passed in) stays on the
  // actual visible box rather than an intermediary element.
  return (
    <>
      <span
        className={surfaceClass}
        aria-hidden={!label}
        role={label ? "img" : undefined}
        aria-label={label}
      >
        {visual}
      </span>
      {stateAnnouncement}
    </>
  );
};

export default KretoMark;
