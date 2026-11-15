// Which parts of the person's Kretopia data Kreto sees for one message. Pure: no I/O, so the composer's choice, the
// defaults and the attribution can be tested on their own.
//
// - Auto (the composer's default): the sections this message or page is about go in with their details; the rest go in
//   as a one-line summary (counts, project names), so Kreto knows they exist without carrying them.
// - Chosen: only the sections the person ticked are shared at all. The rest are left out, and Kreto is told they were
//   not shared, so it asks instead of guessing. This is the "only what I allow" control.
// - Full: callers that send no choice (the floating Kreto, drafts, internal callers) keep today's behaviour.
//
// Memory is separate: `memory: false` means Kreto neither reads nor learns from this message.

export const KRETO_CONTEXT_SECTIONS = ["passport", "projects", "money", "events"] as const;
export type KretoContextSection = (typeof KRETO_CONTEXT_SECTIONS)[number];

/** How a section appears for this message: with details, as a one-line summary, or not at all. */
export type SectionDepth = "detail" | "summary" | "omitted";

export interface KretoContextPlan {
  mode: "auto" | "chosen" | "full";
  depth: Record<KretoContextSection, SectionDepth>;
  /** Read long-term memory and learn from this message. */
  memory: boolean;
}

export const isContextSection = (v: unknown): v is KretoContextSection =>
  typeof v === "string" && (KRETO_CONTEXT_SECTIONS as readonly string[]).includes(v);

// What a message is about. Deliberately broad: a missed section only drops to its summary, never out of sight.
const SECTION_RE: Record<KretoContextSection, RegExp> = {
  money: /\b(invoices?|quotes?|paid|pay(ment|ments|ing)?|owe[ds]?|owing|money|budgets?|rates?|fees?|expenses?|deposits?|revenue|income|earn(ed|ings)?|overdue|unpaid|krepay|cash|price|pricing)\b/i,
  projects: /\b(projects?|tasks?|deadlines?|due|studio|briefs?|deliverables?|milestones?|crew|shoot|clients?|rooms?|collaborators?|team)\b/i,
  passport: /\b(passport|credits?|bio|skills?|portfolio|epk|profile|resume|cv|experience|showreel|reel|pitch|apply|applications?)\b/i,
  events: /\b(events?|sessions?|rsvps?|guests?|attend(ing|ees)?|calendar|schedule|tonight|tomorrow|weekend)\b/i,
};
/** Questions about everything at once: every section goes in with its details. */
const OVERVIEW_RE = /\b(catch me up|what'?s new|what is new|overview|recap|this week|today|focus|priorit(y|ies|ise|ize)|plan my|what should i|where do i stand|status)\b/i;

const SURFACE_SECTION: Record<string, KretoContextSection> = {
  pay: "money",
  krepay: "money",
  desk: "projects",
  studio: "projects",
  profile: "passport",
  credit: "passport",
  passport: "passport",
  event: "events",
  events: "events",
};

const all = (depth: SectionDepth): Record<KretoContextSection, SectionDepth> =>
  Object.fromEntries(KRETO_CONTEXT_SECTIONS.map((s) => [s, depth])) as Record<KretoContextSection, SectionDepth>;

export function planKretoContext(input: {
  /** "auto", a list of sections, or nothing (full, as before). */
  include?: unknown;
  memory?: unknown;
  text: string;
  surface?: string | null;
  projectSelected?: boolean;
}): KretoContextPlan {
  const memory = input.memory !== false;

  if (Array.isArray(input.include)) {
    const chosen = new Set(input.include.filter(isContextSection));
    const depth = all("omitted");
    for (const s of chosen) depth[s] = "detail";
    return { mode: "chosen", depth, memory };
  }

  if (input.include === "auto") {
    if (OVERVIEW_RE.test(input.text)) return { mode: "auto", depth: all("detail"), memory };
    const depth = all("summary");
    for (const s of KRETO_CONTEXT_SECTIONS) if (SECTION_RE[s].test(input.text)) depth[s] = "detail";
    const fromSurface = input.surface ? SURFACE_SECTION[input.surface] : undefined;
    if (fromSurface) depth[fromSurface] = "detail";
    if (input.projectSelected) depth.projects = "detail";
    return { mode: "auto", depth, memory };
  }

  return { mode: "full", depth: all("detail"), memory };
}

/** Sections Kreto saw in detail for this message, in a fixed order (for the reply's "From your Kretopia data" line). */
export const detailedSections = (plan: KretoContextPlan): KretoContextSection[] =>
  KRETO_CONTEXT_SECTIONS.filter((s) => plan.depth[s] === "detail");

/**
 * The X-Kreto-Context header: what this reply drew on, never the content. Sections seen in detail, then
 * "memory:N" when N memories were used, then "project-facts" when the selected project's facts were loaded.
 */
export function contextSourcesHeader(plan: KretoContextPlan, used: { memories: number; projectFacts: boolean }): string {
  const parts: string[] = [...detailedSections(plan)];
  if (used.memories > 0) parts.push(`memory:${used.memories}`);
  if (used.projectFacts) parts.push("project-facts");
  return parts.join(",");
}
