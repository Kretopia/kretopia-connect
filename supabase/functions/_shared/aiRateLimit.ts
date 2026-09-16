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
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// TODO product decision: real values per feature/tier. -1 = unlimited
// (count-only) so wiring this in changes no current behavior.
export const DEFAULT_DAILY_CAP = -1;

export type AiRateLimitResult =
  | { allowed: true; used: number; cap: number }
  | { allowed: false; response: Response };

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
