/**
 * ThriveStatus — Dual-Axis Professional Reputation System
 * 
 * AXIS 1: Career Tier (work-first, hard-gated)
 *   Base: Total Credits (1 credit = 1 distinct professional contribution)
 *   Gates: Endorsements required from Thriver+, Awards/Press required for Celebrity/Icon
 *   → Work volume drives progression. Industry recognition gates the top.
 * 
 * AXIS 2: Network Role (social influence, independent)
 *   Connections, accepted invites, collaborations
 *   → A Professional can be a Spark or Power Circle.
 * 
 * Combined display: "Professional · Connector"
 */

export type StatusTier = "hobbyist" | "freelancer" | "thriver" | "professional" | "celebrity" | "icon";

export type NetworkRole = "spark" | "connector" | "builder" | "curator" | "influencer" | "power_circle";

export interface StatusMetrics {
  verifiedCredits: number;
  totalCredits: number;
  completedProjects: number;
  connections: number;
  acceptedInvites: number;
  collaborations: number;
  averageRating: number;
  reviewCount: number;
  endorsementCount: number;
  awardCount: number;
  pressCount: number;
}

export interface StatusResult {
  tier: StatusTier;
  label: string;
  combinedLabel: string;
  socialProofLabel: string | null;
  color: string;
  ringClass: string;
  gradient: string;
  nextTier?: StatusTier;
  perks: string[];
  tierIndex: number;
  metrics: StatusMetrics;
  progress: StatusProgress[];
  networkRole: NetworkRole;
  networkRoleLabel: string;
  careerScore: number;
  networkScore: number;
}

export interface StatusProgress {
  label: string;
  current: number;
  needed: number;
  category: "credits" | "network" | "accelerators";
}

// ─── Tier Order & Index ──────────────────────────────────────────────

const TIER_ORDER: StatusTier[] = ["hobbyist", "freelancer", "thriver", "professional", "celebrity", "icon"];

export function getTierIndex(tier: StatusTier): number {
  return TIER_ORDER.indexOf(tier);
}

// ─── Career Tier: Hard-Gated Thresholds ──────────────────────────────
//
// 1 Credit = 1 distinct professional contribution
// Realistic pacing:
//   - Active creator: ~2-4 credits/month → 24-48/year
//   - Freelancer: ~5 credits (a few months of work)
//   - Thriver: ~20 credits + peer validation (1 year active)
//   - Professional: ~50 credits + solid endorsements (2-3 years)
//   - Celebrity: 80+ credits + industry awards OR press (5+ years, recognized)
//   - Icon: 120+ credits + awards AND press (decade+, industry leader)

interface TierGate {
  credits: number;
  awards: number;
  press: number;
  awardsOrPress?: boolean;
}

const TIER_GATE_MAP: Record<StatusTier, TierGate> = {
  hobbyist:     { credits: 0,   awards: 0, press: 0 },
  freelancer:   { credits: 5,   awards: 0, press: 0 },
  thriver:      { credits: 20,  awards: 0, press: 0 },
  professional: { credits: 50,  awards: 0, press: 0 },
  celebrity:    { credits: 80,  awards: 2, press: 3, awardsOrPress: true },
  icon:         { credits: 120, awards: 3, press: 5 },
};

interface TierMeta {
  label: string;
  socialProofLabel: string | null;
  color: string;
  ringClass: string;
  gradient: string;
  perks: string[];
}

// Consolidated to 3 effective tiers: Verified / Industry / Elite
// hobbyist + freelancer → Verified
// thriver + professional → Industry
// celebrity + icon → Elite
const TIER_META: Record<StatusTier, TierMeta> = {
  hobbyist: {
    label: "Verified",
    socialProofLabel: null,
    color: "text-muted-foreground",
    ringClass: "ring-2 ring-border",
    gradient: "from-muted-foreground/20 to-muted-foreground/5",
    perks: ["Basic profile", "Claim credits", "Join communities"],
  },
  freelancer: {
    label: "Verified",
    socialProofLabel: "Verified Creator",
    color: "text-[hsl(0,0%,70%)]",
    ringClass: "ring-2 ring-[hsl(0,0%,75%)]",
    gradient: "from-[hsl(0,0%,75%)]/25 to-[hsl(0,0%,70%)]/5",
    perks: ["Verified profile", "Connection requests", "Profile dashboard"],
  },
  thriver: {
    label: "Industry",
    socialProofLabel: "Industry Verified",
    color: "text-primary",
    ringClass: "ring-2 ring-primary",
    gradient: "from-primary/25 to-primary/5",
    perks: ["Smart recommendations", "Priority matching", "Advanced analytics"],
  },
  professional: {
    label: "Industry",
    socialProofLabel: "Industry Pro",
    color: "text-accent",
    ringClass: "ring-2 ring-accent",
    gradient: "from-accent/25 to-accent/5",
    perks: ["Advanced analytics", "Priority matching", "Profile-as-website"],
  },
  celebrity: {
    label: "Elite",
    socialProofLabel: "Elite Creator",
    color: "text-foreground",
    ringClass: "ring-2 ring-foreground",
    gradient: "from-foreground/20 to-foreground/5",
    perks: ["Featured placement", "Reduced platform fees", "Bulk messaging"],
  },
  icon: {
    label: "Elite",
    socialProofLabel: "Industry Icon",
    color: "text-primary",
    ringClass: "ring-2 ring-primary shadow-glow",
    gradient: "from-primary/30 via-accent/15 to-primary/5",
    perks: ["VIP access", "Premium exposure", "Revenue share potential", "Full platform access"],
  },
};

// ─── Career Tier Calculation (Hard-Gated) ────────────────────────────

function meetsGate(metrics: StatusMetrics, gate: TierGate): boolean {
  // Endorsements act as accelerators: each counts as +0.5 effective credits
  const effectiveCredits = metrics.totalCredits + (metrics.endorsementCount * 0.5);
  if (effectiveCredits < gate.credits) return false;

  // Awards/press gate
  if (gate.awardsOrPress) {
    // Need awards OR press (not both)
    const hasAwards = metrics.awardCount >= gate.awards;
    const hasPress = metrics.pressCount >= gate.press;
    if (!hasAwards && !hasPress) return false;
  } else {
    if (metrics.awardCount < gate.awards) return false;
    if (metrics.pressCount < gate.press) return false;
  }

  return true;
}

function calculateMatchedTier(metrics: StatusMetrics): StatusTier {
  // Walk from highest to lowest, return first that passes all gates
  for (let i = TIER_ORDER.length - 1; i >= 0; i--) {
    const tier = TIER_ORDER[i];
    if (meetsGate(metrics, TIER_GATE_MAP[tier])) {
      return tier;
    }
  }
  return "hobbyist";
}

/** Career score 0-100 for progress visualization (not used for tier gating) */
function calculateCareerScore(metrics: StatusMetrics): number {
  const creditScore = Math.min(55, (metrics.totalCredits / 120) * 55);
  const endorseBonus = Math.min(15, (metrics.endorsementCount / 15) * 15);
  const awardScore = Math.min(15, (metrics.awardCount / 3) * 15);
  const pressScore = Math.min(15, (metrics.pressCount / 5) * 15);
  return Math.min(100, creditScore + endorseBonus + awardScore + pressScore);
}

// ─── Network Role Calculation (Independent Axis) ─────────────────────

const NETWORK_ROLE_META: Record<NetworkRole, { label: string; minScore: number }> = {
  power_circle: { label: "Power Circle", minScore: 75 },
  influencer: { label: "Influencer", minScore: 55 },
  curator: { label: "Curator", minScore: 38 },
  builder: { label: "Builder", minScore: 22 },
  connector: { label: "Connector", minScore: 8 },
  spark: { label: "Spark", minScore: 0 },
};

function calculateNetworkScore(metrics: StatusMetrics): number {
  return Math.min(100, (
    (metrics.connections / 200) * 35 +
    (metrics.acceptedInvites / 40) * 30 +
    (metrics.collaborations / 25) * 35
  ));
}

function calculateNetworkRole(metrics: StatusMetrics): { role: NetworkRole; label: string; score: number } {
  const score = calculateNetworkScore(metrics);
  const roles: NetworkRole[] = ["power_circle", "influencer", "curator", "builder", "connector", "spark"];
  for (const role of roles) {
    if (score >= NETWORK_ROLE_META[role].minScore) {
      return { role, label: NETWORK_ROLE_META[role].label, score };
    }
  }
  return { role: "spark", label: "Spark", score };
}

// ─── Main Calculate Function ─────────────────────────────────────────

export function calculateStatus(metrics: StatusMetrics): StatusResult {
  const matchedTier = calculateMatchedTier(metrics);
  const careerScore = calculateCareerScore(metrics);
  const { role: networkRole, label: networkRoleLabel, score: networkScore } = calculateNetworkRole(metrics);

  const meta = TIER_META[matchedTier];
  const tierIndex = getTierIndex(matchedTier);
  const nextTierData = tierIndex < TIER_ORDER.length - 1 ? TIER_ORDER[tierIndex + 1] : undefined;

  const combinedLabel = networkRole !== "spark"
    ? `${meta.label} · ${networkRoleLabel}`
    : meta.label;

  // Build progress items toward next career tier
  const progress: StatusProgress[] = [];
  if (nextTierData) {
    const nextGate = TIER_GATE_MAP[nextTierData];

    if (metrics.totalCredits < nextGate.credits) {
      progress.push({
        label: "Credits",
        current: metrics.totalCredits,
        needed: nextGate.credits,
        category: "credits",
      });
    }
    if (nextGate.awards > 0 && metrics.awardCount < nextGate.awards) {
      progress.push({
        label: "Awards",
        current: metrics.awardCount,
        needed: nextGate.awards,
        category: "accelerators",
      });
    }
    if (nextGate.press > 0 && metrics.pressCount < nextGate.press) {
      progress.push({
        label: "Press",
        current: metrics.pressCount,
        needed: nextGate.press,
        category: "accelerators",
      });
    }
  }

  return {
    tier: matchedTier,
    label: meta.label,
    combinedLabel,
    socialProofLabel: meta.socialProofLabel,
    color: meta.color,
    ringClass: meta.ringClass,
    gradient: meta.gradient,
    nextTier: nextTierData,
    perks: meta.perks,
    tierIndex,
    metrics,
    progress: progress.slice(0, 4),
    networkRole,
    networkRoleLabel,
    careerScore,
    networkScore,
  };
}

/**
 * Legacy compatibility: calculate from credits array only.
 */
export function calculateStatusFromCredits(credits: { verification_status?: string | null }[]): StatusResult {
  let verifiedCredits = 0;
  for (const credit of credits) {
    const status = (credit.verification_status || "manual").toLowerCase();
    if (["enterprise", "peer", "verified", "ai", "identity"].includes(status)) {
      verifiedCredits++;
    }
  }

  return calculateStatus({
    verifiedCredits,
    totalCredits: credits.length,
    completedProjects: 0,
    connections: 0,
    acceptedInvites: 0,
    collaborations: 0,
    averageRating: 0,
    reviewCount: 0,
    endorsementCount: 0,
    awardCount: 0,
    pressCount: 0,
  });
}

// ─── Directional Gate Logic ───────────────────────────────────────

export type ConnectionGate = "open" | "request_only" | "blocked";

export function getConnectionGate(senderTier: StatusTier, recipientTier: StatusTier): ConnectionGate {
  const senderIdx = getTierIndex(senderTier);
  const recipientIdx = getTierIndex(recipientTier);
  if (senderIdx >= recipientIdx) return "open";
  return "request_only";
}

export function getGateMessage(senderTier: StatusTier, recipientTier: StatusTier): string | null {
  const gate = getConnectionGate(senderTier, recipientTier);
  if (gate === "open") return null;
  const recipientMeta = TIER_META[recipientTier];
  return `${recipientMeta.label}-tier creators receive connection requests in a filtered inbox. Build your reputation by adding verified credits to unlock direct messaging.`;
}

/**
 * Get all tier definitions for display purposes.
 */
export function getAllTiers() {
  return TIER_ORDER.map((tier, index) => ({
    tier,
    index,
    ...TIER_META[tier],
    gate: TIER_GATE_MAP[tier],
  }));
}
