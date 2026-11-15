// Kreto models and effort levels as the person sees them: names, one-line descriptions, availability. Labels only.
// The model behind each profile is chosen on the server (supabase/functions/_shared/kretoProfiles.ts) and never sent to
// the browser; the server answers with the profile id that ran. A test keeps the ids, the paid flags and availability
// here in step with the server's.

import { PREMIUM_ENFORCED } from "@/lib/premiumSwitch";

export const KRETO_PROFILE_IDS = ["signal", "pulse", "vision", "oracle", "forge", "echo", "atlas", "ledger", "studio", "scout"] as const;
export type KretoProfileId = (typeof KRETO_PROFILE_IDS)[number];
export type KretoChoiceProfile = KretoProfileId | "auto";
export type KretoEffort = 1 | 2 | 3 | 4;

export interface KretoChoice {
  profile: KretoChoiceProfile;
  effort: KretoEffort;
}

export interface KretoModelOption {
  id: KretoChoiceProfile;
  name: string;
  description: string;
  /** On paid plans once Premium is enforced. */
  paid: boolean;
  /** False while the server has this profile switched off. */
  available: boolean;
  unavailableReason?: string;
}

export const KRETO_MODELS: readonly KretoModelOption[] = [
  { id: "auto", name: "Auto", description: "I pick the right one, never a more expensive one than your effort allows.", paid: false, available: true },
  { id: "signal", name: "Kreto Signal", description: "Quick answers and one-line edits.", paid: false, available: true },
  { id: "pulse", name: "Kreto Pulse", description: "Everyday production help: tasks, drafts, summaries.", paid: false, available: true },
  { id: "vision", name: "Kreto Vision", description: "Plans and strategy that take several steps.", paid: true, available: true },
  { id: "oracle", name: "Kreto Oracle", description: "Long research and high-stakes decisions. Uses more of your allowance.", paid: true, available: false, unavailableReason: "Not switched on yet" },
  { id: "forge", name: "Kreto Forge", description: "Decks, rate cards and structured documents.", paid: true, available: true },
  { id: "echo", name: "Kreto Echo", description: "Short spoken replies for voice.", paid: false, available: true },
  { id: "atlas", name: "Kreto Atlas", description: "Keeps your Kretopia data apart from what would need the web.", paid: false, available: true },
  { id: "ledger", name: "Kreto Ledger", description: "Invoices, quotes and money summaries. Nothing is sent without you.", paid: false, available: true },
  { id: "studio", name: "Kreto Studio", description: "Works inside one project.", paid: false, available: true },
  { id: "scout", name: "Kreto Scout", description: "Finds opportunities and prepares applications.", paid: false, available: true },
];

export const KRETO_EFFORTS: readonly { level: KretoEffort; label: string; description: string }[] = [
  { level: 1, label: "Quick", description: "Fast answer, lightest on your allowance." },
  { level: 2, label: "Balanced", description: "Normal production work." },
  { level: 3, label: "Deep", description: "Planning and analysis across steps." },
  { level: 4, label: "Maximum", description: "The most thorough pass. Uses the most allowance." },
];

export const DEFAULT_KRETO_CHOICE: KretoChoice = { profile: "auto", effort: 2 };

/** Whether to show the "paid plans" tag at all: not while Premium is off, when every account can use every profile. */
export const SHOW_PAID_TAGS = PREMIUM_ENFORCED;

const isProfile = (v: unknown): v is KretoChoiceProfile =>
  v === "auto" || (typeof v === "string" && (KRETO_PROFILE_IDS as readonly string[]).includes(v));
const isEffort = (v: unknown): v is KretoEffort => v === 1 || v === 2 || v === 3 || v === 4;

export const kretoModelName = (id: string | null | undefined): string =>
  KRETO_MODELS.find((m) => m.id === id)?.name ?? "Kreto";
export const kretoEffortLabel = (level: number | null | undefined): string =>
  KRETO_EFFORTS.find((e) => e.level === level)?.label ?? "Balanced";

const STORAGE_KEY = "kreto:choice:v1";

/** The last choice on this device (a convenience, not a setting): falls back to Auto + Balanced. */
export function readKretoChoice(): KretoChoice {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<KretoChoice> | null;
    const profile = isProfile(raw?.profile) && KRETO_MODELS.find((m) => m.id === raw?.profile)?.available ? raw!.profile! : DEFAULT_KRETO_CHOICE.profile;
    const effort = isEffort(raw?.effort) ? raw!.effort! : DEFAULT_KRETO_CHOICE.effort;
    return { profile, effort };
  } catch {
    return DEFAULT_KRETO_CHOICE;
  }
}

export function writeKretoChoice(choice: KretoChoice): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(choice));
  } catch {
    /* private window or blocked storage: the choice simply lasts for this page */
  }
}

/** Prior messages the server sends at each effort (mirrors the server; Balanced and up keep 40). */
const HISTORY_MESSAGES: Record<KretoEffort, number> = { 1: 16, 2: 40, 3: 40, 4: 40 };
/** Output ceiling at each effort, on the everyday tier. */
const OUTPUT_TOKENS: Record<KretoEffort, number> = { 1: 300, 2: 400, 3: 1200, 4: 2000 };
/** Kreto's instructions plus your facts, roughly. */
const SYSTEM_TOKENS = 1500;

/**
 * A rough preview of the share of today's tokens the next message will take, for the composer line. It counts the way the
 * server reserves (instructions and history are counted twice there), from what this page can see. The server's own
 * estimate decides whether to ask; this only sets expectations. Null when there is nothing to measure against.
 */
export function previewShare(args: { draft: string; history: { content: string }[]; effort: KretoEffort; tokensLeft: number | null | undefined }): number | null {
  if (args.tokensLeft === null || args.tokensLeft === undefined) return null;
  if (args.tokensLeft <= 0) return 1;
  const recent = args.history.slice(-HISTORY_MESSAGES[args.effort]);
  const historyTokens = recent.reduce((t, m) => t + Math.ceil((m.content ?? "").length / 4), 0);
  const tokens = 2 * SYSTEM_TOKENS + 2 * historyTokens + Math.ceil(args.draft.length / 4) + OUTPUT_TOKENS[args.effort];
  return Math.min(1, tokens / args.tokensLeft);
}

/** "about 6%", never 0% for a real request. */
export const sharePctLabel = (share: number): string => `${Math.min(100, Math.max(1, Math.round(share * 100)))}%`;
