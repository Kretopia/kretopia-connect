/**
 * Primary Intent — what the user is here to do.
 * Multi-select (max 2). Drives starter steps, home nudges, badges, matching.
 */
export type PrimaryIntent = "collaborate" | "gigs" | "fund" | "hire" | "manage";

export const INTENT_MAX = 2;

export const INTENTS: {
  id: PrimaryIntent;
  label: string;
  short: string;
  /** Public badge text shown on profile/cards */
  badge: string;
  blurb: string;
  emoji: string;
}[] = [
  {
    id: "gigs",
    label: "Find paid work",
    short: "Paid work",
    badge: "Looking for paid work",
    blurb: "Apply to paid gigs, casting calls, and creative briefs.",
    emoji: "💰",
  },
  {
    id: "collaborate",
    label: "Collaborate",
    short: "Collaborate",
    badge: "Open to collaborate",
    blurb: "Connect with creators, build your circle, jam on projects.",
    emoji: "🤝",
  },
  {
    id: "fund",
    label: "Fund a project",
    short: "Fund",
    badge: "Raising funds",
    blurb: "Launch a campaign, raise from your community, ship it.",
    emoji: "🚀",
  },
  {
    id: "hire",
    label: "Hire creatives",
    short: "Hire",
    badge: "Hiring creatives",
    blurb: "Find verified creators, post gigs, build your team.",
    emoji: "🧑‍💼",
  },
  {
    id: "manage",
    label: "Manage my work",
    short: "Manage",
    badge: "Managing projects",
    blurb: "Run projects, send invoices, get paid, stay organized.",
    emoji: "🗂️",
  },
];

export function intentMeta(id: PrimaryIntent | string | null | undefined) {
  return INTENTS.find((i) => i.id === id) ?? null;
}

/** Normalize raw DB value (array or legacy single) to a clean array */
export function normalizeIntents(raw: unknown): PrimaryIntent[] {
  if (!raw) return [];
  const arr = Array.isArray(raw) ? raw : [raw];
  const valid = INTENTS.map((i) => i.id) as string[];
  return arr.filter((v): v is PrimaryIntent => typeof v === "string" && valid.includes(v));
}
