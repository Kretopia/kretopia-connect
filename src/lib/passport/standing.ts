/**
 * Standing — the Passport level-up system.
 *
 * The ONE canonical level system. Replaces the retired tier/XP shims.
 * Tells creators exactly what their next high-leverage move is.
 *
 * Inputs (all real moat signals — no daily-login padding):
 *  - verified credits (capped recency bonus)
 *  - co-signs received (heaviest weight, capped at 10 unique)
 *  - profile completion (small contribution, prevents profile-padding)
 *  - recent activity (gigs / studios / collabs in last 90 days)
 *  - reply SLA (<24h bonus)
 *  - lastActivityAt → score decay if dormant 180d+
 *  - verificationScore → gates L3+ (Verified Pro and above)
 *
 * Pure function. No DB writes.
 */

export type StandingLevel = 0 | 1 | 2 | 3 | 4 | 5;

export interface StandingInputs {
  verifiedCredits: number;
  recentCredits90d?: number;
  cosignsReceived: number;
  profileCompletionPct: number; // 0..100
  activeProjects90d?: number;
  replySlaHours?: number | null;
  /** ISO timestamp of last meaningful activity (latest credit, project, message). */
  lastActivityAt?: string | null;
  /** 0..100 — drives the L3+ gate. From profiles.verification_score. */
  verificationScore?: number | null;
  /** True for scraped/unclaimed Passports. Forces L0. */
  unclaimed?: boolean;
}

export interface StandingNextAction {
  id: string;
  label: string;
  points: number;
  deeplink: string;
}

export interface StandingUnlock {
  level: StandingLevel;
  label: string;
}

export interface Standing {
  level: StandingLevel;
  title: string;
  score: number;            // raw 0..200+ (post-decay)
  progressPct: number;      // 0..100 toward next level
  nextLevelAt: number;      // raw score required for next level
  nextLevelTitle: string | null;
  nextActions: StandingNextAction[];
  /** Set when the user qualifies by score but is blocked by a gate (e.g. verification). */
  gatedAt: StandingLevel | null;
  gateReason: string | null;
  /** True when the score has been reduced by inactivity decay. */
  decaying: boolean;
  /** What unlocks at the next claimable level — display-only in v1. */
  unlocks: StandingUnlock[];
}

const LEVELS: Array<{ level: StandingLevel; title: string; min: number }> = [
  { level: 0, title: "Unclaimed",        min: -1 },  // never reached via score
  { level: 1, title: "Newcomer",         min: 0 },
  { level: 2, title: "Working Creative", min: 30 },
  { level: 3, title: "Verified Pro",     min: 75 },
  { level: 4, title: "Headliner",        min: 140 },
  { level: 5, title: "Marquee",          min: 220 },
];

/** Verification score required to claim L3+. */
const VERIFICATION_GATE = 60;
/** Levels that require verification. */
const GATED_LEVELS: StandingLevel[] = [3, 4, 5];

/** What unlocks at each level — surfaced on LevelUpCard. */
const UNLOCKS: Record<StandingLevel, string> = {
  0: "Claim your Passport to get started",
  1: "Your Passport goes live",
  2: "Listed in Discover",
  3: "Scout priority + Verified badge on your EPK",
  4: "Featured in Discover + press-kit badge",
  5: "Top of the Match queue + Marquee mark",
};

const DECAY_THRESHOLD_DAYS = 180;
const DECAY_FACTOR = 0.85;
const COSIGN_CAP = 10;

export function computeStanding(inputs: StandingInputs): Standing {
  // L0 short-circuit — unclaimed Passports get a dedicated rung.
  if (inputs.unclaimed) {
    return {
      level: 0,
      title: "Unclaimed",
      score: 0,
      progressPct: 0,
      nextLevelAt: 0,
      nextLevelTitle: "Newcomer",
      nextActions: [
        { id: "claim", label: "Claim your Passport", points: 0, deeplink: "/claim" },
      ],
      gatedAt: null,
      gateReason: null,
      decaying: false,
      unlocks: [{ level: 1, label: UNLOCKS[1] }],
    };
  }

  const {
    verifiedCredits,
    recentCredits90d = 0,
    cosignsReceived,
    profileCompletionPct,
    activeProjects90d = 0,
    replySlaHours,
    lastActivityAt,
    verificationScore,
  } = inputs;

  // Cap co-signs so one viral creator can't run away.
  const cappedCosigns = Math.min(cosignsReceived, COSIGN_CAP);

  let score =
    verifiedCredits * 4 +
    recentCredits90d * 2 +
    cappedCosigns * 6 +
    Math.min(profileCompletionPct, 100) * 0.3 +
    activeProjects90d * 3 +
    (replySlaHours != null && replySlaHours < 24 ? 5 : 0);

  // Decay: dormant 180d+ → score * 0.85.
  let decaying = false;
  if (lastActivityAt) {
    const daysSince = (Date.now() - new Date(lastActivityAt).getTime()) / 86_400_000;
    if (daysSince > DECAY_THRESHOLD_DAYS) {
      score = score * DECAY_FACTOR;
      decaying = true;
    }
  }
  score = Math.round(score);

  // Resolve scored level (skip L0).
  const scoreableLevels = LEVELS.filter((l) => l.level >= 1);
  const earned =
    [...scoreableLevels].reverse().find((l) => score >= l.min) ?? scoreableLevels[0];

  // Apply verification gate for L3+.
  let claimed = earned;
  let gatedAt: StandingLevel | null = null;
  let gateReason: string | null = null;
  if (
    GATED_LEVELS.includes(earned.level) &&
    (verificationScore ?? 0) < VERIFICATION_GATE
  ) {
    gatedAt = earned.level;
    gateReason = `Finish verification to claim ${earned.title}`;
    // Drop to the highest non-gated level the user has earned.
    claimed =
      [...scoreableLevels]
        .reverse()
        .find((l) => score >= l.min && !GATED_LEVELS.includes(l.level)) ?? scoreableLevels[0];
  }

  const next = LEVELS.find((l) => l.min > claimed.min) ?? null;
  const span = next ? next.min - claimed.min : 1;
  const progressPct = next
    ? Math.min(100, Math.round(((score - claimed.min) / span) * 100))
    : 100;

  return {
    level: claimed.level,
    title: claimed.title,
    score,
    progressPct,
    nextLevelAt: next?.min ?? claimed.min,
    nextLevelTitle: next?.title ?? null,
    nextActions: suggestNextActions(inputs, { decaying, gatedAt, gateReason }),
    gatedAt,
    gateReason,
    decaying,
    unlocks: next ? [{ level: next.level, label: UNLOCKS[next.level] }] : [],
  };
}

function suggestNextActions(
  i: StandingInputs,
  ctx: { decaying: boolean; gatedAt: StandingLevel | null; gateReason: string | null },
): StandingNextAction[] {
  const actions: StandingNextAction[] = [];

  // Highest priority: clear a gate the user has already earned past.
  if (ctx.gatedAt) {
    actions.push({
      id: "finish-verification",
      label: ctx.gateReason ?? "Finish verification",
      points: 25,
      deeplink: "/profile?focus=verification",
    });
  }

  // Decay nudge — get back in the saddle.
  if (ctx.decaying) {
    actions.push({
      id: "stop-decay",
      label: "Add a recent credit to hold your standing",
      points: 10,
      deeplink: "/credits",
    });
  }

  if (i.verifiedCredits < 3) {
    actions.push({
      id: "add-credits",
      label: `Add ${3 - i.verifiedCredits} more verified credit${3 - i.verifiedCredits === 1 ? "" : "s"}`,
      points: 12,
      deeplink: "/credits",
    });
  } else if ((i.recentCredits90d ?? 0) === 0) {
    actions.push({
      id: "add-recent-credit",
      label: "Add a credit from the last 90 days",
      points: 6,
      deeplink: "/credits",
    });
  }

  if (i.cosignsReceived < 3) {
    actions.push({
      id: "request-cosign",
      label: "Ask a collaborator for a co-sign",
      points: 18,
      deeplink: "/profile?focus=cosigns",
    });
  }

  if (i.profileCompletionPct < 80) {
    actions.push({
      id: "complete-profile",
      label: "Finish your Passport (bio, photo, links)",
      points: Math.max(4, Math.round((80 - i.profileCompletionPct) * 0.3)),
      deeplink: "/profile?focus=complete",
    });
  }

  if ((i.activeProjects90d ?? 0) === 0) {
    actions.push({
      id: "start-studio",
      label: "Start a Studio for your next project",
      points: 6,
      deeplink: "/desk",
    });
  }

  return actions.slice(0, 3);
}
