// Metric ↔ imperial conversions for model measurements.
// All values stored in metric (cm). UI toggles display only.

export type UnitSystem = "metric" | "imperial";
export type ShoeSystem = "EU" | "US" | "UK";
export type DressSystem = "EU" | "US" | "UK";

export const cmToFeetInches = (cm?: number | null): string => {
  if (!cm || cm <= 0) return "";
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches - feet * 12);
  return `${feet}'${inches}"`;
};

export const cmToInches = (cm?: number | null): string => {
  if (!cm || cm <= 0) return "";
  return `${Math.round(cm / 2.54)}"`;
};

export const inchesToCm = (inches: number): number => Math.round(inches * 2.54);
export const feetInchesToCm = (feet: number, inches: number): number =>
  Math.round((feet * 12 + inches) * 2.54);

// Shoe — rough EU↔US/UK conversion (women's; tweak when sub-role indicates men's)
const SHOE_EU_TO_US = (eu: number) => Math.round((eu - 31) * 10) / 10;
const SHOE_EU_TO_UK = (eu: number) => Math.round((eu - 33) * 10) / 10;
export const shoeDisplay = (eu?: number | null, system: ShoeSystem = "EU"): string => {
  if (!eu) return "";
  if (system === "EU") return `EU ${eu}`;
  if (system === "US") return `US ${SHOE_EU_TO_US(eu)}`;
  return `UK ${SHOE_EU_TO_UK(eu)}`;
};

// Dress sizing (women's, rough mapping)
const DRESS_EU_TO_US: Record<number, number> = { 32: 0, 34: 2, 36: 4, 38: 6, 40: 8, 42: 10, 44: 12, 46: 14, 48: 16 };
const DRESS_EU_TO_UK: Record<number, number> = { 32: 4, 34: 6, 36: 8, 38: 10, 40: 12, 42: 14, 44: 16, 46: 18, 48: 20 };
export const dressDisplay = (eu?: number | null, system: DressSystem = "EU"): string => {
  if (!eu) return "";
  if (system === "EU") return `EU ${eu}`;
  const map = system === "US" ? DRESS_EU_TO_US : DRESS_EU_TO_UK;
  return `${system} ${map[eu] ?? "—"}`;
};

export interface ModelStats {
  height_cm?: number | null;
  bust_cm?: number | null;
  waist_cm?: number | null;
  hips_cm?: number | null;
  inseam_cm?: number | null;
  shoe_eu?: number | null;
  dress_eu?: number | null;
  hair?: string | null;
  eyes?: string | null;
  skin_tone?: string | null;
}

export const formatStatLine = (s: ModelStats | null | undefined, units: UnitSystem = "metric"): string => {
  if (!s) return "";
  const parts: string[] = [];
  if (s.height_cm) parts.push(units === "metric" ? `${s.height_cm}cm` : cmToFeetInches(s.height_cm));
  const trio = [s.bust_cm, s.waist_cm, s.hips_cm].filter(Boolean) as number[];
  if (trio.length === 3) {
    parts.push(
      units === "metric"
        ? `${trio[0]}-${trio[1]}-${trio[2]}cm`
        : `${Math.round(trio[0] / 2.54)}-${Math.round(trio[1] / 2.54)}-${Math.round(trio[2] / 2.54)}"`
    );
  }
  if (s.shoe_eu) parts.push(shoeDisplay(s.shoe_eu, "EU"));
  if (s.dress_eu) parts.push(dressDisplay(s.dress_eu, "EU"));
  if (s.hair) parts.push(`Hair: ${s.hair}`);
  if (s.eyes) parts.push(`Eyes: ${s.eyes}`);
  return parts.join(" · ");
};

export const MODEL_CATEGORIES = [
  "Editorial", "Commercial", "Runway", "Fitness", "Fit",
  "Hand", "Plus", "Petite", "Mature", "Alt", "Parts", "Promo", "Print",
];

export const MODEL_UNIONS = ["SAG-AFTRA", "Equity", "ACTRA", "Non-union", "Other"];
