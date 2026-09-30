// Gradient backgrounds for projects without a cover image.
// Uses fixed HSL stops (not opacity-on-tokens) so cards always render with
// the same look regardless of theme, secondary token, or surface.
// One accent family only (dark gray -> the logo's own violet stop, hue
// 289 / #A516C5 -- was pink, hue 327, rolled back per the app-wide brand
// rollback) -- each mood is still visually distinct via angle/mix/
// intensity, not a different hue.

import { MOODS } from "./MoodPicker";

const GRADIENTS: Record<string, string> = {
  // Dark gray -> brand violet — creative default
  creative: "linear-gradient(135deg, hsl(240 8% 20%), hsl(289 100% 59%))",
  // Deep violet -> bright violet — reads as intense without leaving the family
  urgent: "linear-gradient(135deg, hsl(289 90% 38%), hsl(289 100% 64%))",
  // Near-black -> violet — dramatic, for music
  musical: "linear-gradient(135deg, hsl(240 12% 12%), hsl(289 90% 55%))",
  // Mid gray -> soft pale violet — cooler, for visual/photo
  visual: "linear-gradient(135deg, hsl(240 6% 32%), hsl(289 55% 72%))",
  // Gray -> gray — deliberately colorless, for chill
  chill: "linear-gradient(135deg, hsl(240 8% 22%), hsl(240 6% 52%))",
};

export const moodGradient = (mood: string | null | undefined): string => {
  if (mood && GRADIENTS[mood]) return GRADIENTS[mood];
  return GRADIENTS.creative;
};

export const moodLabel = (mood: string | null | undefined): string =>
  MOODS.find((m) => m.id === mood)?.label ?? "Creative";
