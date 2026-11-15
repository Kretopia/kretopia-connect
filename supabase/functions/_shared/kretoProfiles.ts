// Kreto models and effort levels, server side. Pure and dependency-free (it imports only the model-id constants and the
// receipt pricer), so thrive-ai-chat (Deno) and the tests (Vite) run the same code.
//
// A "Kreto model" is a Kretopia-branded route, not a separate model: a server-side bundle of one configured model tier
// (aiModels.ts), a prompt focus and per-request caps. The provider mapping never leaves the server. The browser has its
// own label-only copy (src/lib/kretoProfiles.ts) and only ever receives a profile id back.
// Design and decisions: docs/kreto/KRETO_MODEL_PROFILES.md.
//
// Rules this module enforces (and the tests pin):
//   * The user's explicit choice wins. It is refused only when that profile is switched off or not on their plan, and
//     then the refusal names the nearest allowed profile. It is never swapped for a pricier one.
//   * Auto picks the profile from the kind of request, never from its length alone, and never goes above the tier the
//     chosen effort allows. Balanced reproduces today's routing: the fast tier, and the strong tier only for documents
//     and multi-step planning (which used to be chosen silently by message length, and is now named in the reply).
//   * A request that would use a large share of what is left asks first; one that does not fit stops before any model call.

import { GEMINI_3_1_PRO, GEMINI_3_8_FLASH, GEMINI_3_FLASH, GEMINI_FLASH_LITE } from "./aiModels.ts";
import { priceProviderUsage } from "./providerUsage.ts";

export type KretoTier = "lite" | "fast" | "strong" | "pro";
const TIER_RANK: Record<KretoTier, number> = { lite: 0, fast: 1, strong: 2, pro: 3 };

/** Server-only: which configured model backs each tier. Swapping a provider model is a change in aiModels.ts. */
export const TIER_MODEL: Readonly<Record<KretoTier, string>> = {
  lite: GEMINI_FLASH_LITE,
  fast: GEMINI_3_FLASH,
  strong: GEMINI_3_8_FLASH,
  pro: GEMINI_3_1_PRO,
};

/**
 * The most expensive tier for everyone. Off: for now it is on only for admins and Premium accounts (deepTierFor). For
 * everyone else Kreto Oracle is refused with Kreto Vision as the alternative, and Maximum stops at the strong tier.
 */
export const PRO_TIER_ENABLED = false;

/** A Premium account for the deepest tier: a paid plan whose subscription is active or trialing (founders are activated as active). */
export function isPremiumSubscription(tier: string | null | undefined, status: string | null | undefined): boolean {
  return !!tier && tier !== "free" && (status === "active" || status === "trialing");
}

/** Whether this account may use the deepest tier: everyone once PRO_TIER_ENABLED is on, until then admins and Premium accounts. */
export function deepTierFor(account: { isAdmin: boolean; premium: boolean }): boolean {
  return PRO_TIER_ENABLED || account.isAdmin || account.premium;
}

export const KRETO_PROFILE_IDS = ["signal", "pulse", "vision", "oracle", "forge", "echo", "atlas", "ledger", "studio", "scout"] as const;
export type KretoProfileId = (typeof KRETO_PROFILE_IDS)[number];
export type KretoEffort = 1 | 2 | 3 | 4;

interface ProfileSpec {
  /** The tier at each effort level when the user picks this profile explicitly. */
  tiers: Readonly<Record<KretoEffort, KretoTier>>;
  /** On paid plans only (while Premium is not enforced, every account counts as paid: see premiumSwitch.ts). */
  paid: boolean;
  /** One line added to Kreto's instructions. Empty for the everyday profile. */
  focus: string;
  /** The nearest profile to offer when this one cannot run. */
  fallback: KretoProfileId;
}

const T = (q: KretoTier, b: KretoTier, d: KretoTier, m: KretoTier) => ({ 1: q, 2: b, 3: d, 4: m }) as const;

export const KRETO_PROFILES: Readonly<Record<KretoProfileId, ProfileSpec>> = {
  signal: { tiers: T("lite", "fast", "fast", "fast"), paid: false, fallback: "pulse", focus: "Answer in one or two sentences. If something is missing, ask one precise question." },
  pulse: { tiers: T("fast", "fast", "strong", "strong"), paid: false, fallback: "signal", focus: "" },
  vision: { tiers: T("strong", "strong", "strong", "pro"), paid: true, fallback: "pulse", focus: "Think it through before answering: give a numbered plan of at most five steps, the reason for the order, what is unknown, then the first concrete action." },
  oracle: { tiers: T("pro", "pro", "pro", "pro"), paid: true, fallback: "vision", focus: "Weigh the options. State your assumptions and what is unknown, name the USER FACTS you relied on, then give a decision and the next action." },
  forge: { tiers: T("strong", "strong", "strong", "strong"), paid: true, fallback: "pulse", focus: "Produce structured work: headings, tables or clean lists, ready to drop into a deck, proposal, rate card or brief. No filler." },
  echo: { tiers: T("fast", "fast", "fast", "fast"), paid: false, fallback: "pulse", focus: "This will be spoken aloud: at most two short sentences, no markdown, no lists, no links." },
  atlas: { tiers: T("fast", "fast", "strong", "strong"), paid: false, fallback: "pulse", focus: "Keep what comes from Kretopia data apart from anything that would need the web. Never state an outside fact as known: offer to research it with an <action> instead." },
  ledger: { tiers: T("fast", "fast", "strong", "strong"), paid: false, fallback: "pulse", focus: "Focus on money. Draft invoices, quotes and summaries from USER FACTS only. Never call anything paid unless USER FACTS says it was paid and by whom it was recorded. Nothing is sent without approval." },
  studio: { tiers: T("fast", "fast", "strong", "strong"), paid: false, fallback: "pulse", focus: "Work inside the project in context: its brief, tasks, deliverables, dates and people. Name the task or deliverable you mean." },
  scout: { tiers: T("fast", "fast", "strong", "strong"), paid: false, fallback: "pulse", focus: "Focus on opportunities and applications. Use the Passport's real credits and skills. Never invent a gig, a deadline or a fee." },
};

export const EFFORT_LABEL: Readonly<Record<KretoEffort, string>> = { 1: "Quick", 2: "Balanced", 3: "Deep", 4: "Maximum" };

/** Highest tier Auto may use at each effort. Balanced allows the strong tier only for documents and planning (see autoProfile). */
const EFFORT_CEILING: Readonly<Record<KretoEffort, KretoTier>> = { 1: "fast", 2: "strong", 3: "strong", 4: "pro" };

/**
 * Prior messages sent with the request. Balanced and above keep today's window (the last 40); Quick sends fewer. A rolling
 * summary that lets every level send fewer comes with the context work (Phase 3).
 */
const HISTORY_MESSAGES: Readonly<Record<KretoEffort, number>> = { 1: 16, 2: 40, 3: 40, 4: 40 };

/** Output ceiling per effort and tier. Balanced is today's: 400 on the fast tier, 800 on the strong one. */
export function outputTokensFor(effort: KretoEffort, tier: KretoTier): number {
  if (effort === 1) return 300;
  if (effort === 2) return TIER_RANK[tier] >= TIER_RANK.strong ? 800 : 400;
  if (effort === 3) return 1200;
  return 2000;
}

export const DEFAULT_EFFORT: KretoEffort = 2;

export const isKretoProfileId = (v: unknown): v is KretoProfileId =>
  typeof v === "string" && (KRETO_PROFILE_IDS as readonly string[]).includes(v);

export const toEffort = (v: unknown): KretoEffort => (v === 1 || v === 2 || v === 3 || v === 4 ? v : DEFAULT_EFFORT);

// The document words are today's (thrive-ai-chat's docIntent), with word boundaries: never more strong-tier routes than before.
const DOC_RE = /\b(deck|proposal|treatment|one[- ]?pager|rate card|moodboard|document|pdf|brief|contract)\b/i;
const MONEY_RE = /\b(invoices?|quotes?|payment links?|receipts?|overdue|unpaid|expenses?|deposits?|day rate|fees?)\b/i;
const GIG_RE = /\b(gigs?|castings?|auditions?|apply (to|for)|applications?|opportunit(y|ies)|job (posting|listing|offer)s?)\b/i;
const RESEARCH_RE = /\b(research|look up|find (me )?(venues?|brands?|sponsors?|vendors?|agencies)|competitors?)\b/i;
const PLAN_RE = /\b(plan|strategy|roadmap|step[- ]by[- ]step|launch|timeline)\b/i;
/** Planning words in a short line ("what's my plan today?") are not a multi-step brief. */
const PLAN_MIN_CHARS = 120;

export interface RouteInput {
  /** The user's choice: a profile id, "auto", or nothing. */
  requested?: unknown;
  effort?: unknown;
  /** The latest user message (plus attachment text). */
  text: string;
  hasAttachments?: boolean;
  /** Where Kreto was opened (e.g. "krepay", "studio"). */
  surface?: string | null;
  /** A project is selected in context. */
  projectSelected?: boolean;
  /** The turn arrives from voice. */
  voice?: boolean;
  /** effectiveIsPro(...) for the caller. */
  paidPlan: boolean;
  /** This account's access to the deepest tier (deepTierFor); defaults to PRO_TIER_ENABLED. */
  proTierEnabled?: boolean;
}

export interface KretoRoute {
  profile: KretoProfileId;
  /** Chosen by Auto rather than by the user. */
  auto: boolean;
  effort: KretoEffort;
  tier: KretoTier;
  /** Server-only. Never put in a response. */
  model: string;
  outputTokens: number;
  historyMessages: number;
  focus: string;
  /** Auto wanted a higher tier than this effort allows: offer, never switch. */
  suggestEffort?: KretoEffort;
  /** A plain line for the user when the route differs from what they asked (e.g. the pro tier is off). */
  notice?: string;
}

export type RouteResult =
  | { ok: true; route: KretoRoute }
  | { ok: false; code: "KRETO_PROFILE_UNAVAILABLE"; message: string; alternative: KretoProfileId };

const NAME: Readonly<Record<KretoProfileId, string>> = {
  signal: "Kreto Signal", pulse: "Kreto Pulse", vision: "Kreto Vision", oracle: "Kreto Oracle", forge: "Kreto Forge",
  echo: "Kreto Echo", atlas: "Kreto Atlas", ledger: "Kreto Ledger", studio: "Kreto Studio", scout: "Kreto Scout",
};
export const kretoProfileName = (id: KretoProfileId): string => NAME[id];

/** The profile Auto would like for this request, from what it is about (never from its length alone). */
export function autoProfile(input: Pick<RouteInput, "text" | "hasAttachments" | "surface" | "projectSelected" | "voice">, effort: KretoEffort): KretoProfileId {
  const text = input.text ?? "";
  if (input.voice) return "echo";
  if (input.hasAttachments || DOC_RE.test(text)) return "forge";
  if (input.surface === "krepay" || MONEY_RE.test(text)) return "ledger";
  if (input.projectSelected || input.surface === "studio" || input.surface === "desk") return "studio";
  if (GIG_RE.test(text)) return "scout";
  if (RESEARCH_RE.test(text)) return "atlas";
  if (PLAN_RE.test(text) && (text.length >= PLAN_MIN_CHARS || effort >= 3)) return "vision";
  if (effort === 1) return "signal";
  return "pulse";
}

function available(id: KretoProfileId, paidPlan: boolean, proOn: boolean): boolean {
  const spec = KRETO_PROFILES[id];
  if (spec.paid && !paidPlan) return false;
  // A profile whose every tier is the pro tier cannot run while that tier is off.
  if (!proOn && Object.values(spec.tiers).every((t) => t === "pro")) return false;
  return true;
}

function nearestAvailable(id: KretoProfileId, paidPlan: boolean, proOn: boolean): KretoProfileId {
  let next = KRETO_PROFILES[id].fallback;
  for (let i = 0; i < KRETO_PROFILE_IDS.length && !available(next, paidPlan, proOn); i++) next = KRETO_PROFILES[next].fallback;
  return available(next, paidPlan, proOn) ? next : "pulse";
}

function build(profile: KretoProfileId, auto: boolean, effort: KretoEffort, tier: KretoTier, extra: Partial<KretoRoute> = {}): KretoRoute {
  return {
    profile, auto, effort, tier, model: TIER_MODEL[tier],
    outputTokens: outputTokensFor(effort, tier),
    historyMessages: HISTORY_MESSAGES[effort],
    focus: KRETO_PROFILES[profile].focus,
    ...extra,
  };
}

/** Never above the ceiling; the pro tier steps down to strong while it is off. */
function cap(tier: KretoTier, ceiling: KretoTier, proOn: boolean): KretoTier {
  let t = TIER_RANK[tier] > TIER_RANK[ceiling] ? ceiling : tier;
  if (t === "pro" && !proOn) t = "strong";
  return t;
}

export function resolveKretoRoute(input: RouteInput): RouteResult {
  const effort = toEffort(input.effort);
  const proOn = input.proTierEnabled ?? PRO_TIER_ENABLED;
  const requested = isKretoProfileId(input.requested) ? input.requested : null;

  if (requested) {
    if (!available(requested, input.paidPlan, proOn)) {
      const alternative = nearestAvailable(requested, input.paidPlan, proOn);
      const why = KRETO_PROFILES[requested].paid && !input.paidPlan ? "is on paid plans" : "is on Premium for now";
      return { ok: false, code: "KRETO_PROFILE_UNAVAILABLE", alternative, message: `${NAME[requested]} ${why}. I can run this with ${NAME[alternative]}.` };
    }
    const wanted = KRETO_PROFILES[requested].tiers[effort];
    // Explicit choice: its own tier at this effort, except the pro tier while it is off.
    const tier = wanted === "pro" && !proOn ? "strong" : wanted;
    const notice = wanted === "pro" && !proOn ? `The deepest tier is on Premium for now, so ${NAME[requested]} ran at Deep strength.` : undefined;
    return { ok: true, route: build(requested, false, effort, tier, notice ? { notice } : {}) };
  }

  // Auto.
  let profile = autoProfile(input, effort);
  if (!available(profile, input.paidPlan, proOn)) profile = nearestAvailable(profile, input.paidPlan, proOn);
  const wanted = KRETO_PROFILES[profile].tiers[effort];
  let ceiling = EFFORT_CEILING[effort];
  // Balanced: the strong tier only for documents and multi-step planning; everything else stays on the fast tier.
  if (effort === 2 && profile !== "forge" && profile !== "vision") ceiling = "fast";
  const tier = cap(wanted, ceiling, proOn);
  const extra: Partial<KretoRoute> = {};
  if (TIER_RANK[tier] < TIER_RANK[wanted] && wanted !== "pro") extra.suggestEffort = effort === 1 ? 2 : 3;
  return { ok: true, route: build(profile, true, effort, tier, extra) };
}

// ---------------------------------------------------------------------------------------------------------------------
// Estimate and guard
// ---------------------------------------------------------------------------------------------------------------------

/** Share of what is left at or above which Kreto asks before running. Configurable; see KRETO_MODEL_PROFILES.md §7. */
export const DEFAULT_CONFIRM_SHARE = 0.25;

/**
 * Weekly credit allowance per subscription tier, measured from settled receipts (decided 2026-11-15: the efficient
 * option). At the measured 0.006 credits per everyday reply, free is about 80 replies a week. The daily allowances still
 * apply on top. Null would switch the weekly check off for a tier.
 */
export const WEEKLY_CREDIT_ALLOWANCE: Readonly<Record<string, number | null>> = {
  free: 0.5,
  pro: 2,
  brand_pro: 2,
  creator_pro: 5,
  founder: 10,
  brand_enterprise: 10,
};

/** This account's weekly allowance: none for admins (they test every tier), the free amount for a plan this table does not know. */
export function weeklyAllowanceFor(tier: string, isAdmin: boolean): number | null {
  if (isAdmin) return null;
  return tier in WEEKLY_CREDIT_ALLOWANCE ? WEEKLY_CREDIT_ALLOWANCE[tier] : WEEKLY_CREDIT_ALLOWANCE.free;
}

/** Monday 00:00 UTC of the week containing `now`. */
export function weekStartUtc(now: Date = new Date()): Date {
  const day = (now.getUTCDay() + 6) % 7; // Monday = 0
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day));
}

/** Credits for a request from the workspace catalog, or null when the catalog cannot price it (never an invented zero). */
export function estimateCredits(inputTokens: number, outputTokens: number, pricing: unknown): number | null {
  try {
    return priceProviderUsage({ prompt_tokens: Math.max(0, Math.ceil(inputTokens)), completion_tokens: Math.max(0, Math.ceil(outputTokens)) }, pricing).credits;
  } catch {
    return null;
  }
}

export interface GuardInput {
  /** Tokens this request reserves (prompt + history + output ceiling). */
  estimateTokens: number;
  /** What is left of today's token allowance; null when there is no cap or it cannot be read. */
  remainingTokens: number | null;
  /** Estimated credits; null when the catalog cannot price it. */
  estimateCredits: number | null;
  /** What is left of this week's credit allowance; null when no weekly allowance is set. */
  weeklyRemainingCredits: number | null;
  /** The person already confirmed this estimate. */
  confirmed: boolean;
  confirmShare?: number;
}

export type GuardDecision =
  | { action: "run"; share: number | null }
  | { action: "confirm"; share: number; basis: "today" | "week" }
  | { action: "stop"; basis: "today" | "week"; share: number };

export function guardKretoRequest(g: GuardInput): GuardDecision {
  const threshold = g.confirmShare ?? DEFAULT_CONFIRM_SHARE;
  const today = g.remainingTokens === null ? null : g.remainingTokens <= 0 ? Infinity : g.estimateTokens / g.remainingTokens;
  const week = g.weeklyRemainingCredits === null || g.estimateCredits === null
    ? null
    : g.weeklyRemainingCredits <= 0 ? Infinity : g.estimateCredits / g.weeklyRemainingCredits;

  // Does not fit: stop before any model call, whatever was confirmed.
  if (week !== null && week > 1) return { action: "stop", basis: "week", share: week };
  if (today !== null && today > 1) return { action: "stop", basis: "today", share: today };

  const share = Math.max(today ?? 0, week ?? 0);
  const basis: "today" | "week" = (week ?? 0) >= (today ?? 0) && week !== null ? "week" : "today";
  if (today === null && week === null) return { action: "run", share: null };
  if (!g.confirmed && share >= threshold) return { action: "confirm", share, basis };
  return { action: "run", share };
}

/** The words for a share, rounded the way the person will read it ("about 30%"). */
export const sharePct = (share: number): number => Math.min(100, Math.max(1, Math.round(share * 100)));
