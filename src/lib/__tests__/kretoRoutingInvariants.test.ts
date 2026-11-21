// Every routing decision, exhaustively: each requested model × effort × plan × deepest-tier access × kind of message ×
// page × attachments × voice × open project (~43,000 cases). The promises that make cost predictable hold in all of them:
// no silent upgrade above the effort's ceiling, the deepest tier only for those allowed it, an explicit choice either runs
// as itself or is refused with a usable alternative, caps never above Maximum's, and no provider name in anything said.
import { describe, expect, it } from "vitest";
import {
  KRETO_PROFILES,
  KRETO_PROFILE_IDS,
  TIER_MODEL,
  resolveKretoRoute,
  type KretoEffort,
  type KretoTier,
  type RouteResult,
} from "../../../supabase/functions/_shared/kretoProfiles";

type Refusal = Extract<RouteResult, { ok: false }>;
const RANK: Record<KretoTier, number> = { lite: 0, fast: 1, strong: 2, pro: 3 };
const CEILING: Record<KretoEffort, KretoTier> = { 1: "fast", 2: "strong", 3: "strong", 4: "pro" };
const PROVIDER = /gemini|google|openai|gpt|anthropic|claude|llama|mistral|lovable|\bAI\b/i;

const REQUESTS: Array<string | undefined> = [undefined, "auto", ...KRETO_PROFILE_IDS, "gpt-5"];
const EFFORTS: KretoEffort[] = [1, 2, 3, 4];
const TEXTS = [
  "thanks",
  "Draft a proposal deck for the client",
  "Which invoices are still unpaid?",
  "Find me gigs in Paris",
  "Research sponsors for my event",
  "Plan my album launch step by step with a timeline and the people I need for each stage of the rollout please",
  "x".repeat(2000),
];
const SURFACES = [null, "home", "pay", "desk"];

function* cases() {
  for (const requested of REQUESTS)
    for (const effort of EFFORTS)
      for (const paidPlan of [true, false])
        for (const proTierEnabled of [true, false])
          for (const text of TEXTS)
            for (const surface of SURFACES)
              for (const hasAttachments of [false, true])
                for (const voice of [false, true])
                  for (const projectSelected of [false, true])
                    yield { requested, effort, paidPlan, proTierEnabled, text, surface, hasAttachments, voice, projectSelected };
}

describe("routing invariants, every combination", () => {
  it("holds for all of them", () => {
    let count = 0;
    const failures: string[] = [];
    const fail = (msg: string, input: object) => failures.length < 5 && failures.push(`${msg}: ${JSON.stringify(input).slice(0, 220)}`);

    for (const input of cases()) {
      count++;
      const r = resolveKretoRoute(input);
      const explicit = input.requested !== undefined && (KRETO_PROFILE_IDS as readonly string[]).includes(input.requested);

      if (!r.ok) {
        const refusal = r as Refusal;
        if (!explicit) fail("Auto was refused", input);
        const alt = KRETO_PROFILES[refusal.alternative as keyof typeof KRETO_PROFILES];
        if (!alt) fail("refusal without a real alternative", input);
        else {
          if (alt.paid && !input.paidPlan) fail("alternative not on the plan", input);
          if (!input.proTierEnabled && Object.values(alt.tiers).every((t) => t === "pro")) fail("alternative needs the deepest tier", input);
        }
        if (PROVIDER.test(refusal.message)) fail("refusal names a provider", input);
        continue;
      }

      const { route } = r;
      const spec = KRETO_PROFILES[route.profile];
      if (route.tier === "pro" && !input.proTierEnabled) fail("deepest tier without access", input);
      if (spec.paid && !input.paidPlan) fail("paid profile on a free plan", input);
      if (route.model !== TIER_MODEL[route.tier]) fail("model does not match its tier", input);
      if (route.outputTokens > 2000 || route.historyMessages > 40) fail("caps above Maximum's", input);
      if (route.effort !== input.effort) fail("effort changed", input);
      if (PROVIDER.test(`${route.notice ?? ""} ${route.focus}`)) fail("notice or focus names a provider", input);

      if (explicit) {
        if (route.auto || route.profile !== input.requested) fail("explicit choice not honoured", input);
        const wanted = spec.tiers[input.effort];
        const expected = wanted === "pro" && !input.proTierEnabled ? "strong" : wanted;
        if (route.tier !== expected) fail("explicit choice ran on another tier", input);
      } else {
        if (!route.auto) fail("Auto not marked auto", input);
        if (RANK[route.tier] > RANK[CEILING[input.effort]]) fail("Auto above the effort ceiling", input);
        if (input.effort === 2 && route.profile !== "forge" && route.profile !== "vision" && RANK[route.tier] > RANK.fast) fail("Balanced upgraded an ordinary message", input);
        if (input.effort === 1 && route.outputTokens > 300) fail("Quick above its output cap", input);
      }
    }

    expect(count).toBe(REQUESTS.length * 4 * 2 * 2 * TEXTS.length * SURFACES.length * 8);
    expect(failures).toEqual([]);
  });

  it("the same input always routes the same way (no randomness, no hidden state)", () => {
    const input = { requested: undefined, effort: 2 as KretoEffort, paidPlan: true, proTierEnabled: false, text: "Draft a proposal deck", surface: "home", hasAttachments: false, voice: false, projectSelected: false };
    const first = JSON.stringify(resolveKretoRoute(input));
    for (let i = 0; i < 50; i++) expect(JSON.stringify(resolveKretoRoute(input))).toBe(first);
  });
});
