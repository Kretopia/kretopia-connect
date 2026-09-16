// One accent family, no rainbow: every mood is a shade of the brand pink
// (hue 327, matching --energy) or neutral gray, differentiated by
// lightness/saturation instead of hue — keeps moods visually distinct
// without introducing teal/red/blue/green into the palette.
const MOOD_ACCENT: Record<string, string> = {
  creative: "hsl(327 70% 60%)",  // bright pink
  urgent: "hsl(327 90% 45%)",    // deep, saturated pink — reads as intense
  musical: "hsl(327 100% 59%)",  // canonical brand pink
  visual: "hsl(327 40% 72%)",    // soft, pale pink
  chill: "hsl(240 8% 55%)",      // neutral gray — calm, deliberately colorless
};
export const moodAccent = (m?: string | null) => MOOD_ACCENT[m ?? "creative"] ?? MOOD_ACCENT.creative;

export const monogram = (title: string) => {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "·";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
};

export interface StudioProject {
  id: string;
  title: string;
  status?: string | null;
  mood?: string | null;
  cover_url?: string | null;
  client_name?: string | null;
  description?: string | null;
  pinned_stage?: string | null;
  studio_folder_id?: string | null;
  updated_at: string;
}

export const STATUS_PILL: Record<string, { label: string; tone: string }> = {
  active: {
    label: "In Progress",
    tone: "bg-[hsl(var(--energy)/0.18)] text-[hsl(var(--energy))] ring-1 ring-[hsl(var(--energy)/0.45)]",
  },
  planning: { label: "Planning", tone: "bg-background/80 text-foreground ring-1 ring-border" },
  wrapping: { label: "Wrapping Up", tone: "bg-primary/20 text-primary-foreground ring-1 ring-primary/40" },
  // "Delivered" reads as neutral/final, not another accent color — active
  // work is the only state that gets the brand pink.
  completed: { label: "Delivered", tone: "bg-white/10 text-foreground ring-1 ring-white/20" },
};

// No red/amber/green traffic light: paid = brightest (fully resolved),
// invoiced = brand pink (in motion), unsent = dim neutral (needs
// attention, without borrowing red's "error" connotation). The label
// text next to each dot already says the actual state.
export const PAY_DOT: Record<string, string> = {
  paid: "bg-white",
  invoiced: "bg-[hsl(var(--energy))]",
  unsent: "bg-muted-foreground/50",
};

export const PAY_LABEL: Record<string, string> = {
  paid: "Paid",
  invoiced: "Invoiced",
  unsent: "No invoice",
};
