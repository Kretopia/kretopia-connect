/**
 * StaggerReveal — the landing hero's word-split blur-stagger reveal
 * (KretopiaHero.tsx), extracted so every page's title speaks the same
 * animation language without copy-pasting the mechanics per file.
 *
 * `CinematicHeaderPlate` (the shared header behind FeaturePageHeader /
 * EditorialPageHero) consumes `renderStaggerWords` directly, since it
 * needs to interleave a `title`/`accentTitle` pair inside one `<h1>`.
 * Pages that keep their own bespoke header chrome instead of the full
 * cinematic plate (Passport Directory, Settings, Search — each has a
 * real reason not to adopt that plate's hardcoded dark background: a
 * light-theme-aware layout, inline back/close nav buttons, or a
 * different accent color) use `StaggerHeading` as a drop-in replacement
 * for a plain heading element, keeping their own layout and colors.
 */
import type { ElementType, ReactNode } from "react";
import { motion } from "framer-motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const EASE = [0.2, 0.65, 0.3, 0.95] as const;

const WORD_VARIANTS = {
  hidden: { opacity: 0, y: 22, filter: "blur(10px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.7, ease: EASE } },
};
const WORD_VARIANTS_STILL = { hidden: {}, show: {} };

/** Non-string nodes animate as a single unit -- splitting arbitrary JSX
 *  children into "words" isn't safe. */
export function renderStaggerWords(node: ReactNode, keyPrefix: string, reducedMotion: boolean) {
  const variants = reducedMotion ? WORD_VARIANTS_STILL : WORD_VARIANTS;
  if (typeof node !== "string") {
    return (
      <motion.span className="inline-block" variants={variants}>
        {node}
      </motion.span>
    );
  }
  const words = node.split(" ");
  return words.map((word, i) => (
    // Non-breaking space, not a plain " " -- a trailing plain space can
    // get collapsed at an inline-block's content edge in some browsers,
    // same reason the landing hero's own version of this pattern uses one.
    <motion.span key={`${keyPrefix}-${i}`} className="inline-block" variants={variants}>
      {word}
      {i < words.length - 1 ? " " : ""}
    </motion.span>
  ));
}

interface StaggerHeadingProps {
  /** Element to render as. Use "span" when nesting inside a heading that
   *  already exists elsewhere (e.g. alongside an icon inside a real <h1>). */
  as?: ElementType;
  text: string;
  className?: string;
}

/** Drop-in replacement for `<h1 className={...}>{text}</h1>` with the
 *  hero's word-stagger-blur reveal instead of a plain static render. */
export function StaggerHeading({ as: Tag = "h1", text, className }: StaggerHeadingProps) {
  const reducedMotion = useReducedMotion();
  return (
    <Tag className={className}>
      <motion.span
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: reducedMotion ? 0 : 0.075 } } }}
      >
        {renderStaggerWords(text, "w", reducedMotion)}
      </motion.span>
    </Tag>
  );
}

export default StaggerHeading;
