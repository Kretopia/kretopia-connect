import { BRAND_GRADIENT } from "@/components/nav/bottomNavMetrics";

/**
 * The one place the shape of a card is decided. The values are those of the Scout hybrid card (Scout_Card_Hybrid.html: radius 16, a 16:9 cover,
 * 20px of padding and a 13px gap, a 21px headline, a hairline above the footer, 34px buttons with a 9px radius, a .28s flip, a gentle tilt),
 * written in the app's theme tokens so Daylight and Midnight both work. A card never declares its own radius, shadow, cover ratio, padding
 * or type scale: it fills the slots of CardShell, and cardDrift.test.ts fails the build when a card file tries.
 */

/** What a face may hold. The shell enforces it, so a card cannot grow with its content. */
export const CARD_BUDGET = { titleLines: 2, descriptionLines: 2, tags: 3, trustLines: 2 } as const;

// Tailwind needs whole class names in the source, so a number of lines is looked up, never interpolated.
const CLAMP: Record<number, string> = { 1: "line-clamp-1", 2: "line-clamp-2", 3: "line-clamp-3" };
export const clampClass = (lines: number) => CLAMP[lines] ?? CLAMP[2];

// Shape. HoloCard (the tilt shell) takes the radius and the elevation from here too, so there is one answer.
export const CARD_RADIUS = "rounded-2xl";
export const CARD_SHADOW = "shadow-[0_18px_44px_-20px_rgba(0,0,0,0.65),0_2px_0_0_rgba(255,255,255,0.06)_inset]";
export const CARD_COVER_RATIO = "aspect-[16/9]";

// Faces. Front and back share one grid cell; the back is turned away by backface-visibility.
export const CARD_FACE = `relative flex min-w-0 flex-col overflow-hidden ${CARD_RADIUS} border border-border bg-card [grid-area:1/1]`;
export const CARD_FACE_BACK = "bg-[linear-gradient(138deg,hsl(var(--primary)/0.10),hsl(var(--card))_65%)]";
export const CARD_FACE_STYLE = { backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" } as const;
export const CARD_FLIP_OUTER = "h-full [perspective:1300px]";
export const CARD_FLIP_INNER = "grid h-full [transform-style:preserve-3d] transition-transform duration-[280ms] ease-[cubic-bezier(0.2,0.7,0.3,1)] motion-reduce:transition-none";

// Cover: a fixed ratio, so every card in a row has the same picture height.
export const CARD_COVER = `relative ${CARD_COVER_RATIO} shrink-0 overflow-hidden`;
export const CARD_COVER_SCRIM = "pointer-events-none absolute inset-0 bg-gradient-to-b from-background/10 via-transparent to-card/60";
export const CARD_COVER_OVERLAY = "absolute inset-x-[15px] top-[15px] z-[2] flex items-start justify-between gap-2.5";

// Body and type scale.
export const CARD_BODY = "flex min-w-0 flex-1 flex-col gap-[13px] p-5 max-[420px]:p-4";
export const CARD_BODY_BACK = "flex min-w-0 flex-1 flex-col gap-[18px] p-6 max-[420px]:p-[19px]";
export const CARD_TITLE = "text-left text-[21px] font-bold leading-[1.28] tracking-[-0.025em] text-foreground [overflow-wrap:anywhere] max-[420px]:text-[19px]";
export const CARD_META = "truncate text-xs leading-normal text-muted-foreground";
export const CARD_DESCRIPTION = "text-xs leading-[1.55] text-foreground/80";
export const CARD_LABEL = "text-[9px] font-bold uppercase tracking-[0.07em] text-muted-foreground";
export const CARD_BACK_LABEL = "flex items-center gap-[7px] text-[10px] font-extrabold uppercase tracking-[0.12em] text-primary";
export const CARD_TAGS = "flex flex-wrap gap-1.5";
// Provenance: what a listing is and who stands behind it. Small, bounded, and never moved off the front (it is a trust rule, not decoration).
export const CARD_TRUST = "text-[10px] leading-snug text-muted-foreground";
export const CARD_FOOTER = "mt-auto flex flex-wrap items-center justify-between gap-[9px] border-t border-border pt-[13px]";

// A title that makes the whole card its target: the link's ::after covers the face, and what must stay clickable sits above it.
export const CARD_STRETCH = "after:absolute after:inset-0 after:rounded-2xl after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring";
export const CARD_ABOVE = "relative z-[3]";

// Actions. One primary (brand-gradient border) and one icon-only secondary; the only other icon controls live on the cover.
export const CARD_BTN =
  "relative inline-flex min-h-[34px] items-center justify-center gap-[7px] whitespace-nowrap rounded-[9px] border border-border bg-muted/40 px-3 text-[11px] font-bold leading-[1.3] text-foreground " +
  "transition duration-150 hover:-translate-y-px hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none motion-reduce:hover:translate-y-0";
export const CARD_BTN_PRIMARY = "border-transparent shadow-[0_0_16px_hsl(330_93%_55%/0.13)] hover:shadow-[0_0_22px_hsl(330_93%_55%/0.24)]";
// The primary button: a card-coloured fill inside the brand gradient's border.
export const CARD_BTN_PRIMARY_STYLE = { background: `linear-gradient(hsl(var(--card)), hsl(var(--card))) padding-box, ${BRAND_GRADIENT} border-box` };
export const CARD_ICON_BTN =
  "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border border-border bg-background/70 text-foreground/80 backdrop-blur-md transition-colors " +
  "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
export const CARD_ICON_BTN_ON = "border-energy/50 bg-energy/15 text-energy";
export const CARD_TEXT_ACTION =
  "inline-flex min-h-[34px] items-center gap-[5px] rounded-md px-1 py-1.5 text-[11px] font-bold text-energy hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring whitespace-nowrap";

// Small labels on the cover and in the tags.
export const CARD_PILL = "inline-flex items-center gap-[5px] rounded-full border px-2 py-[5px] text-[10px] font-bold leading-[1.2] tracking-[0.025em]";
export const CARD_PILL_TONE = {
  origin: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  type: "border-border bg-background/75 font-medium text-foreground/80 backdrop-blur-sm",
  plain: "border-border bg-muted/50 text-muted-foreground",
} as const;
export type CardPillTone = keyof typeof CARD_PILL_TONE;
