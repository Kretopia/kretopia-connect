// Generic per-user daily rate limit for AI-calling edge functions.
//
// thrive-ai-chat and Studio AI Create already have their own proven,
// tier-aware gates (consume_copilot_message / consume_studio_ai_generation)
// — this is NOT a replacement for those. It exists for the much larger set
// of AI functions (generate-*, draft-*, gen-*, spark-ideas,
// ai-autofill-profile, etc.) that today have auth but no per-user call
// limit at all, so a single compromised or malicious account can drive
// unbounded AI-provider cost.
//
// Backed by the DB (public.ai_feature_usage / consume_ai_feature_call,
// 20260910160000_ai_feature_rate_limit_infra.sql) rather than in-memory —
// edge functions run as multiple, frequently-recycled isolates, so an
// in-memory counter (see _shared/rate-limiter.ts) does not actually bound
// anything across concurrent invocations in production.
//
// Every call site wired up in this pass uses DEFAULT_DAILY_CAP = -1
// (unlimited / count-only) — real per-feature caps are a product/cost
// decision (TODO product decision), not made here. Flipping a feature to
// an actual cap later is a one-line change at the call site, no schema or
// redeploy-shape change.
//
// Usage:
//   const gate = await checkAiFeatureRateLimit(admin, userId, "generate-content");
//   if (!gate.allowed) return gate.response;

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// TODO product decision: real values per feature/tier. -1 = unlimited
// (count-only) so wiring this in changes no current behavior.
export const DEFAULT_DAILY_CAP = -1;

export type AiRateLimitResult = { allowed: true; used: number; cap: number } | { allowed: false; response: Response };

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function checkAiFeatureRateLimit(
  admin: SupabaseClient,
  userId: string,
  featureKey: string,
  dailyCap: number = DEFAULT_DAILY_CAP,
): Promise<AiRateLimitResult> {
  const { data, error } = await admin.rpc("consume_ai_feature_call", {
    _user_id: userId,
    _feature_key: featureKey,
    _daily_cap: dailyCap,
  });

  if (error) {
    console.error(`consume_ai_feature_call failed for ${featureKey}`, error);
    // Fail closed — a broken gate should not become unlimited free usage.
    return {
      allowed: false,
      response: json({ error: "Could not verify usage limit. Try again shortly." }, 500),
    };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.allowed) {
    const used = row?.used ?? 0;
    const cap = row?.cap ?? dailyCap;
    return {
      allowed: false,
      response: json(
        {
          error: `Daily limit reached for this feature (${used}/${cap}). Come back tomorrow.`,
          code: "AI_FEATURE_DAILY_LIMIT",
          used,
          cap,
        },
        429,
      ),
    };
  }

  return { allowed: true, used: row.used, cap: row.cap };
}

// ---------------------------------------------------------------------
// Reservation gate (ai_credit_ledger / ai_credit_envelope,
// 0003_ai_credit_ledger_gate.sql). Every model call on the gated surfaces
// (Kreto chat, Kreto autocomplete, Match generation, Scout scan,
// attachment parse) must pass through gateAiCall BEFORE the call and then
// exactly one of commitAiCredit (success) / releaseAiCredit (failure or
// abort). The envelope is checked first, then the personal allowance, so
// the global daily budget can never be exceeded under concurrency.
// ---------------------------------------------------------------------

export type AiCreditFeature =
  | "kreto_message"
  | "kreto_tokens"
  | "kreto_autocomplete"
  | "match_generation"
  | "scout_scan"
  | "attachment_parse";

export type AiGateDenialReason = "allowance" | "budget";

export type AiGateResult =
  | { allowed: true; used: number; cap: number }
  | { allowed: false; reason: AiGateDenialReason; used: number; cap: number; response: Response };

/**
 * One gate for every model call. Reserves `units` of `feature` for the user
 * (and `estCredits` against the global daily envelope) atomically. On denial
 * the response is ready to return: 429 with a reason code that distinguishes
 * a personal allowance from the global budget.
 */
export async function gateAiCall(
  admin: SupabaseClient,
  userId: string,
  feature: AiCreditFeature,
  units: number = 1,
  estCredits?: number,
): Promise<AiGateResult> {
  const { data, error } = await admin.rpc("try_reserve_ai_credit", {
    _user_id: userId,
    _feature: feature,
    _units: units,
    _est_credits: estCredits ?? null,
  });

  if (error) {
    console.error(`try_reserve_ai_credit failed for ${feature}`, error);
    // Fail closed — a broken gate must not become unlimited free usage.
    return {
      allowed: false,
      reason: "budget",
      used: 0,
      cap: 0,
      response: json({ error: "Could not verify usage limit. Try again shortly." }, 500),
    };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.allowed) {
    const reason: AiGateDenialReason = row?.reason === "budget" ? "budget" : "allowance";
    const used = row?.used ?? 0;
    const cap = row?.cap ?? 0;
    console.warn(`ai credit denied: feature=${feature} reason=${reason} used=${used} cap=${cap}`);
    return {
      allowed: false,
      reason,
      used,
      cap,
      response: json(
        {
          error:
            reason === "budget"
              ? "Kretopia's AI budget for today is fully used. This is temporary and global — it resets at midnight UTC."
              : `Daily limit reached for this feature (${used}/${cap}). Resets at midnight UTC.`,
          code: reason === "budget" ? "AI_BUDGET_EXHAUSTED" : "AI_ALLOWANCE_EXHAUSTED",
          feature,
          used,
          cap,
        },
        429,
      ),
    };
  }

  return { allowed: true, used: row.used, cap: row.cap };
}

/** Convert a reservation into usage after a successful call. Fire-and-forget
 *  safe: logs and swallows errors so a bookkeeping failure never breaks a reply. */
export async function commitAiCredit(
  admin: SupabaseClient,
  userId: string,
  feature: AiCreditFeature,
  units: number = 1,
  credits?: number,
): Promise<void> {
  const { error } = await admin.rpc("commit_ai_credit", {
    _user_id: userId,
    _feature: feature,
    _units: units,
    _credits: credits ?? null,
  });
  if (error) console.warn(`commit_ai_credit failed for ${feature}`, error);
}

/** Release a reservation when the call fails or is aborted. Same swallow policy. */
export async function releaseAiCredit(
  admin: SupabaseClient,
  userId: string,
  feature: AiCreditFeature,
  units: number = 1,
  estCredits?: number,
): Promise<void> {
  const { error } = await admin.rpc("release_ai_credit", {
    _user_id: userId,
    _feature: feature,
    _units: units,
    _est_credits: estCredits ?? null,
  });
  if (error) console.warn(`release_ai_credit failed for ${feature}`, error);
}
