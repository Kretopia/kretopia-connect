/**
 * EditorialPageHero — the landing page's cinematic chapter opening, reused
 * as the top of a standalone page (Verified Credits, Spotlight, About).
 * Same magenta aurora, same grain, same typographic scale (.landing-eyebrow
 * / .landing-h1 / .landing-sub) and the same restrained reveal motion as the
 * landing chapters — so every page reads as one continuous film rather than
 * separate product screens. Unlike the landing page's own hero (a separate
 * component, permanently dark by design), this one follows the user's
 * Dark/Light choice: the plate color and title/subtitle text both resolve
 * from --background/--foreground/--muted-foreground rather than a
 * hardcoded #05070D + white, so it reads correctly in Daylight too.
 */
import type { ReactNode } from "react";
import { CinematicHeaderPlate } from "@/components/features/CinematicHeaderPlate";

export interface EditorialPageHeroProps {
  /** Small uppercase kicker in the pill, eg. "Verified Credits". */
  kicker: string;
  /** Main line, rendered white. */
  title: ReactNode;
  /** Emphasised magenta line, rendered italic serif beneath the title. */
  accentTitle?: ReactNode;
  subtitle?: string;
  /** Search bar, CTA row, tutorial trigger — anything placed under the copy. */
  children?: ReactNode;
  /** Centre the whole block (Spotlight / About) or keep it left (default). */
  align?: "left" | "center";
  /** Keep title + accent on a single line (auto-scaled to fit). Defaults to true. */
  oneLine?: boolean;
  /** Keep the subtitle itself on one line too (see CinematicHeaderPlate). Defaults to false. */
  subtitleOneLine?: boolean;
}

export const EditorialPageHero = ({
  kicker, title, accentTitle, subtitle, children, align = "center", oneLine = true, subtitleOneLine = false,
}: EditorialPageHeroProps) => {
  const centered = align === "center";

  return (
    <section
      className="relative overflow-hidden"
      style={{ backgroundColor: "hsl(var(--background))" }}
    >
      {/* aurora */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 ai-ambient-breathe"
        style={{ background: "radial-gradient(60% 55% at 50% 0%, rgba(255,45,161,0.14), transparent 62%)" }}
      />
      {/* grain — same plate as the landing chapters */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 mix-blend-overlay opacity-[0.13]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />
      {/* quadrillé grid texture — restrained graph-paper lines, faded via mask */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid-quadrille" />

      <CinematicHeaderPlate
        eyebrow={kicker}
        title={title}
        accentTitle={accentTitle}
        subtitle={subtitle}
        align={align}
        oneLine={oneLine}
        subtitleOneLine={subtitleOneLine}
        footer={children && <div className={`mt-8 w-full ${centered ? "flex flex-col items-center" : ""}`}>{children}</div>}
      />
    </section>
  );
};

export default EditorialPageHero;
