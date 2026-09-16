// Visual themes for Thrive-generated documents.
// Token-only (no hardcoded hex) so they respect vibe + remain on-brand.
export type DeckTheme =
  | "editorial"
  | "bold"
  | "minimal"
  | "cinematic"
  | "playful"
  | "magazine"
  | "noir"
  | "caribbean"
  | "letterhead";

export interface ThemeStyle {
  name: string;
  description: string;
  page: string;        // outer slide container
  eyebrow: string;
  heading: string;
  body: string;
  bullet: string;
  callout: string;
  divider: string;
  cover: string;       // cover slide override
  font: string;        // tailwind font family class
  /** Optional accent color applied to numerals, stat values, quote marks */
  accentClass?: string;
}

export const DECK_THEMES: Record<DeckTheme, ThemeStyle> = {
  editorial: {
    name: "Editorial",
    description: "Magazine-style. Serif headlines, generous white space.",
    page: "bg-background text-foreground border border-border",
    eyebrow: "text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3",
    heading: "font-serif text-4xl md:text-5xl leading-tight mb-4",
    body: "text-base leading-relaxed text-foreground/85 max-w-prose",
    bullet: "text-foreground/85",
    callout: "border-l-2 border-primary pl-4 italic text-foreground/80",
    divider: "border-border",
    cover: "bg-gradient-to-br from-background via-background to-muted",
    font: "font-sans",
    accentClass: "text-primary",
  },
  bold: {
    name: "Bold",
    description: "Big type, high contrast. Lead with statement.",
    page: "bg-foreground text-background border border-foreground",
    eyebrow: "text-xs uppercase tracking-[0.3em] text-background/60 mb-3",
    heading: "font-sans font-black text-5xl md:text-6xl leading-[0.95] mb-5 uppercase",
    body: "text-base leading-relaxed text-background/85",
    bullet: "text-background/85",
    callout: "bg-background/10 px-4 py-3 rounded-md border border-background/20",
    divider: "border-background/20",
    cover: "bg-foreground text-background",
    font: "font-sans",
    accentClass: "text-background",
  },
  minimal: {
    name: "Minimal",
    description: "Quiet, precise. Lots of air.",
    page: "bg-background text-foreground border border-border",
    eyebrow: "text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-6",
    heading: "font-sans font-light text-3xl md:text-4xl leading-snug mb-6 tracking-tight",
    body: "text-sm leading-relaxed text-foreground/75 max-w-prose",
    bullet: "text-foreground/75 text-sm",
    callout: "text-foreground/60 italic text-sm",
    divider: "border-border/60",
    cover: "bg-background",
    font: "font-sans",
    accentClass: "text-foreground",
  },
  cinematic: {
    name: "Cinematic",
    description: "Letterbox, film-grade. Image-forward.",
    page: "bg-foreground text-background border border-foreground relative overflow-hidden",
    eyebrow: "text-xs uppercase tracking-[0.35em] text-background/50 mb-4",
    heading: "font-serif text-4xl md:text-5xl leading-tight mb-5 text-background",
    body: "text-base leading-relaxed text-background/80 max-w-prose",
    bullet: "text-background/80",
    callout: "border-l border-background/40 pl-4 text-background/70 italic",
    divider: "border-background/20",
    cover: "bg-foreground text-background",
    font: "font-serif",
    accentClass: "text-background",
  },
  playful: {
    name: "Playful",
    description: "Warm, energetic. Friendly headings.",
    page: "bg-card text-foreground border border-border rounded-2xl",
    eyebrow: "text-xs uppercase tracking-wider text-primary mb-3 font-semibold",
    heading: "font-sans font-bold text-4xl md:text-5xl leading-tight mb-4",
    body: "text-base leading-relaxed text-foreground/85",
    bullet: "text-foreground/85",
    callout: "bg-primary/10 text-primary px-4 py-3 rounded-xl",
    divider: "border-border",
    cover: "bg-gradient-to-br from-primary/10 via-card to-background",
    font: "font-sans",
    accentClass: "text-primary",
  },
  magazine: {
    name: "Magazine",
    description: "Editorial cover. Big serif display + caption rule.",
    page: "bg-background text-foreground border-y-2 border-foreground",
    eyebrow: "text-[10px] uppercase tracking-[0.4em] text-foreground/60 mb-4 border-b border-foreground/30 pb-2",
    heading: "font-serif text-5xl md:text-6xl leading-[0.95] mb-6 tracking-tight",
    body: "text-base leading-[1.7] text-foreground/85 columns-1 md:columns-2 gap-8",
    bullet: "text-foreground/85",
    callout: "font-serif italic text-2xl leading-snug text-foreground border-l-4 border-primary pl-5 my-4",
    divider: "border-foreground/40",
    cover: "bg-background",
    font: "font-sans",
    accentClass: "text-primary",
  },
  noir: {
    name: "Noir",
    description: "Late-night gallery. Deep ink, gold rule.",
    page: "bg-foreground text-background border border-background/10",
    eyebrow: "text-[10px] uppercase tracking-[0.45em] text-background/40 mb-4",
    heading: "font-serif text-4xl md:text-5xl leading-tight mb-4 text-background",
    body: "text-sm leading-relaxed text-background/75 max-w-prose",
    bullet: "text-background/75 text-sm",
    callout: "border-y border-primary/60 py-3 text-background italic",
    divider: "border-background/15",
    cover: "bg-foreground text-background",
    font: "font-serif",
    accentClass: "text-primary",
  },
  caribbean: {
    name: "Caribbean",
    description: "Warm sun, hand-set headlines. Story-forward.",
    page: "bg-card text-foreground border border-border",
    eyebrow: "text-xs uppercase tracking-[0.25em] text-primary mb-3 font-semibold",
    heading: "font-serif italic text-4xl md:text-5xl leading-tight mb-4",
    body: "text-base leading-relaxed text-foreground/85 max-w-prose",
    bullet: "text-foreground/85",
    callout: "bg-primary/10 border-l-4 border-primary pl-4 py-3 text-foreground/90",
    divider: "border-primary/40",
    cover: "bg-gradient-to-br from-primary/15 via-card to-accent/10",
    font: "font-sans",
    accentClass: "text-primary",
  },
  letterhead: {
    name: "Letterhead",
    description: "Formal correspondence. Letter-grade, no decoration.",
    page: "bg-background text-foreground border border-border",
    eyebrow: "text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-4",
    heading: "font-serif text-3xl md:text-4xl leading-tight mb-4",
    body: "text-base leading-[1.75] text-foreground/90 max-w-prose",
    bullet: "text-foreground/85",
    callout: "border-t border-b border-border py-3 text-foreground/80",
    divider: "border-border",
    cover: "bg-background",
    font: "font-serif",
    accentClass: "text-primary",
  },
};

// Per-archetype default theme. Used when the user hasn't manually chosen one.
// Engine + UI both honor this so the deck "feels right" out of the gate.
export const DEFAULT_THEME_BY_INTENT: Record<string, DeckTheme> = {
  sponsor_deck: "bold",
  pitch_deck: "editorial",
  business_plan: "minimal",
  client_proposal: "editorial",
  treatment: "cinematic",
  rate_card: "minimal",
  moodboard_deck: "cinematic",
  one_pager: "magazine",
  letter_of_intent: "letterhead",
};

export function defaultThemeFor(intent: string): DeckTheme {
  return DEFAULT_THEME_BY_INTENT[intent] || "editorial";
}
