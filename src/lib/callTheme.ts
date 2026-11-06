import type { DailyTheme, DailyThemeColors } from "@daily-co/daily-js";

/**
 * Daily's own bars (its tray: camera, microphone, people, share; its top bar) are drawn inside its iframe, so the only way to make them
 * match the app is `call.setTheme`. That accepts `#RRGGBB` only: it logs "theme color should be provided in valid hex color format"
 * for `hsl(...)` and keeps its default, which is how the tray ended up white under a dark Kretopia header. The app's colour tokens are
 * bare `H S% L%` triples, so they are converted here.
 */

const NUMBER = "(-?\\d*\\.?\\d+)";
const HSL = new RegExp(`^(?:hsla?\\()?\\s*${NUMBER}(?:deg)?[\\s,]+${NUMBER}%[\\s,]+${NUMBER}%(?:\\s*[,/]\\s*[\\d.]+%?)?\\s*\\)?$`, "i");
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

const channel = (n: number) => Math.round(Math.min(1, Math.max(0, n)) * 255).toString(16).padStart(2, "0");

/** `"225 44.4444% 3.5294%"` (or `hsl(...)`, or a hex colour) as `#05070d`; null when it is none of those. */
export function colorTokenToHex(value: string | null | undefined): string | null {
  const text = (value ?? "").trim();
  if (!text) return null;
  const hex = HEX.exec(text);
  if (hex) return `#${hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join("") : hex[1]}`.toLowerCase();
  const match = HSL.exec(text);
  if (!match) return null;
  const hue = ((Number(match[1]) % 360) + 360) % 360;
  const saturation = Number(match[2]) / 100;
  const lightness = Number(match[3]) / 100;
  if (![hue, saturation, lightness].every(Number.isFinite)) return null;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * Math.min(1, Math.max(0, saturation));
  const second = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const offset = lightness - chroma / 2;
  const [r, g, b] = hue < 60 ? [chroma, second, 0] : hue < 120 ? [second, chroma, 0] : hue < 180 ? [0, chroma, second]
    : hue < 240 ? [0, second, chroma] : hue < 300 ? [second, 0, chroma] : [chroma, 0, second];
  return `#${channel(r + offset)}${channel(g + offset)}${channel(b + offset)}`;
}

/** Which of the app's tokens Daily's colours follow. */
const TOKENS: Record<keyof DailyThemeColors, string> = {
  accent: "--primary", accentText: "--primary-foreground",
  background: "--background", backgroundAccent: "--secondary",
  baseText: "--foreground", border: "--border",
  mainAreaBg: "--background", mainAreaBgAccent: "--card",
  mainAreaText: "--foreground", supportiveText: "--muted-foreground",
};

/**
 * The theme to hand to `call.setTheme`, read through `read(token)` (the computed value of a CSS variable). A colour whose token is
 * missing or unreadable is left out, so Daily keeps its own for that one; null when none could be read (nothing is sent then).
 */
export function dailyThemeFromTokens(read: (token: string) => string): DailyTheme | null {
  const colors: DailyThemeColors = {};
  for (const [name, token] of Object.entries(TOKENS) as [keyof DailyThemeColors, string][]) {
    const hex = colorTokenToHex(read(token));
    if (hex) colors[name] = hex;
  }
  return Object.keys(colors).length ? { colors } : null;
}
