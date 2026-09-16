/**
 * EditorialChapter — full-bleed chapter plate using the landing/About language:
 * theme-aware surface, grain overlay, numbered kicker, serif title + magenta
 * accent word. Used on feature pages (PostOpportunity), so it follows the
 * user's Dark/Light choice rather than a permanent #05070D plate.
 */
import { motion } from "framer-motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";

const ACCENT = "#FF2DA1";

const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

interface EditorialChapterProps {
  index: string;
  kicker: string;
  title: string;
  accentWord: string;
  children: React.ReactNode;
  /** Centre the kicker/title/children block instead of the default left
   * alignment — use when the children (eg. a search bar) are themselves
   * centered, so the title above them lines up with what's below it. */
  align?: "left" | "center";
  /** Drop the section's own top padding — use when this chapter sits
   * directly under a hero/header that already supplies bottom spacing, so
   * the two don't stack into an oversized gap. */
  tightenTop?: boolean;
}

export const EditorialChapter = ({ index, kicker, title, accentWord, children, align = "left", tightenTop = false }: EditorialChapterProps) => {
  const reducedMotion = useReducedMotion();
  const centered = align === "center";
  return (
    <section className="relative overflow-hidden" style={{ backgroundColor: "hsl(var(--background))" }}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 mix-blend-overlay opacity-[0.13]"
        style={{ backgroundImage: GRAIN }}
      />
      <div className={cn(
        "relative mx-auto max-w-[1100px] px-5 sm:px-8 pb-14 sm:pb-20",
        tightenTop ? "pt-0" : "pt-14 sm:pt-20",
      )}>
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.9, ease: [0.2, 0.65, 0.3, 0.95] }}
          className={centered ? "text-center" : undefined}
        >
          <div className={cn("flex items-center gap-3 mb-4", centered && "justify-center")}>
            <span className="font-serif italic text-2xl pink-glow-breathe" style={{ color: ACCENT }}>{index}.</span>
            {/* Inline override, not a Tailwind utility class: both a text
                utility and .landing-eyebrow's own default live in the same
                Tailwind layer, so an inline style is the only way to
                guarantee this numbered kicker stays neutral (and
                theme-aware) instead of inheriting the class's pink
                default. */}
            <span className="landing-eyebrow" style={{ color: "hsl(var(--muted-foreground))" }}>{kicker}</span>
          </div>
          <h2
            className={cn("font-serif font-normal text-foreground leading-[1.0] tracking-[-0.02em] max-w-3xl", centered && "mx-auto")}
            style={{ fontSize: "clamp(1.9rem, 4.4vw, 3.4rem)" }}
          >
            {title}{" "}
            <span className="landing-accent">{accentWord}</span>
          </h2>
        </motion.div>
        <div className="mt-6">{children}</div>
      </div>
    </section>
  );
};

export default EditorialChapter;
