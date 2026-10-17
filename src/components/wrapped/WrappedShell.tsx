import type { ReactNode, Ref } from "react";

import { BrandLogo } from "@/components/BrandLogo";
import { cn } from "@/lib/utils";

/** Thin L-shaped corner marks: the HUD feel, drawn with borders only (no filters, no images). */
function HudCorners() {
  const base = "pointer-events-none absolute h-3.5 w-3.5 border-[hsl(var(--energy)/0.55)]";
  return (
    <>
      <span aria-hidden className={cn(base, "left-2.5 top-2.5 rounded-tl-md border-l border-t")} />
      <span aria-hidden className={cn(base, "right-2.5 top-2.5 rounded-tr-md border-r border-t")} />
      <span aria-hidden className={cn(base, "bottom-2.5 left-2.5 rounded-bl-md border-b border-l")} />
      <span aria-hidden className={cn(base, "bottom-2.5 right-2.5 rounded-br-md border-b border-r")} />
    </>
  );
}

export interface WrappedShellProps {
  /** Id of the heading, which names the region. */
  titleId: string;
  /** Small uppercase line above the title. */
  eyebrow: string;
  /** The h2: plain text with one `k-gradient-text` span for the accent. */
  title: ReactNode;
  /** Keep the h2 as the panel's accessible name but do not draw it, when the page above already says it. */
  hideTitle?: boolean;
  /** One honest sentence under the title; leave out when the status line says enough. */
  subtitle?: ReactNode;
  /** The line of status under the title (a WrappedStatus); omit when there is nothing true to say. */
  status?: ReactNode;
  /** Right side of the header: a refresh button, a scene. */
  aside?: ReactNode;
  /** Ref for the outer section (visibility checks). */
  sectionRef?: Ref<HTMLElement>;
  /** The Kretopia lockup at the foot of the panel. On by default; a page that stacks two panels keeps it on the last one. */
  brandFooter?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * The frame of a "Wrapped" panel: one rounded surface on the brand surface
 * tokens with a faint grid, one soft light from the top left, HUD corners, and
 * a header made of eyebrow, title, one status line and a right-hand slot.
 *
 * Today's Radar and Scout's top section are both this frame, so they cannot
 * drift apart. It owns the look only: what goes inside, and where its numbers
 * come from, belongs to each surface.
 */
export function WrappedShell({ titleId, eyebrow, title, hideTitle = false, subtitle, status, aside, sectionRef, brandFooter = true, className, children }: WrappedShellProps) {
  return (
    <section
      ref={sectionRef}
      aria-labelledby={titleId}
      className={cn(
        "relative isolate overflow-hidden rounded-3xl border border-[hsl(var(--energy)/0.22)] bg-card p-4 sm:p-6",
        className,
      )}
    >
      {/* depth: a faint grid and one soft light from the top left, behind everything */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-grid-quadrille opacity-40" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: "radial-gradient(60% 45% at 0% 0%, hsl(var(--energy) / 0.10), transparent 70%)" }}
      />
      <HudCorners />

      <div className="space-y-5 sm:space-y-6">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{eyebrow}</p>
            <h2 id={titleId} className={cn("mt-1.5 text-xl font-bold leading-tight text-foreground sm:text-2xl", hideTitle && "sr-only")}>
              {title}
            </h2>
            {subtitle}
            {status && <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">{status}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">{aside}</div>
        </header>
        {children}
        {brandFooter && (
          <footer className="flex items-center justify-between gap-3 border-t border-border/60 pt-3">
            <BrandLogo lockup size="sm" className="opacity-90" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{eyebrow.replace(/^Kretopia( ·)?\s*/i, "")}</span>
          </footer>
        )}
      </div>
    </section>
  );
}

export default WrappedShell;
