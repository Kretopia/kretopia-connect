// Server-side usage gate for Studio AI Create (image + copy generation).
//
// Mirrors thrive-ai-chat's already-live consume_copilot_message pattern:
// an atomic SECURITY DEFINER RPC checks the caller's daily cap and
// increments it in one statement, so two concurrent generation requests
// can't both slip through under the limit. Free users get FREE_DAILY_CAP
// generations/day (image + copy share one counter); Pro is unlimited.
//
// Usage:
//   const gate = await checkAndConsumeStudioAIGeneration(admin, userId, isPro);
//   if (!gate.allowed) return gate.response;
//   ... call the paid AI gateway ...
//   if (somethingFailed) await refundStudioAIGeneration(admin, userId);

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

export const FREE_DAILY_CAP = 5;

export type StudioAIGateResult =
  | { allowed: true; used: number; cap: number }
  | { allowed: false; response: Response };

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function checkAndConsumeStudioAIGeneration(
  admin: SupabaseClient,
  userId: string,
  isPro: boolean,
): Promise<StudioAIGateResult> {
  const dailyCap = isPro ? -1 : FREE_DAILY_CAP;

  const { data, error } = await admin.rpc("consume_studio_ai_generation", {
    _user_id: userId,
    _daily_cap: dailyCap,
  });

  if (error) {
    console.error("consume_studio_ai_generation failed", error);
    // Fail closed — a broken gate should not become unlimited free generation.
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
          error: `Daily AI generation limit reached (${used}/${cap}). Upgrade to Pro for unlimited, or come back tomorrow.`,
          code: "STUDIO_AI_DAILY_LIMIT",
          used,
          cap,
        },
        429,
      ),
    };
  }

  return { allowed: true, used: row.used, cap: row.cap };
}

export async function refundStudioAIGeneration(admin: SupabaseClient, userId: string): Promise<void> {
  try {
    await admin.rpc("refund_studio_ai_generation", {
      _user_id: userId,
      _usage_date: new Date().toISOString().slice(0, 10),
    });
  } catch (e) {
    // Best-effort — never let a refund failure mask the original error.
    console.warn("refund_studio_ai_generation failed", e);
  }
}
