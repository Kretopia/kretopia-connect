// Minimal "any real signed-in user" guard for cost-incurring (AI/scrape)
// edge functions that had NO auth check at all -- unlike admin-guard.ts,
// this does not require an admin role or cron secret, just a genuine
// authenticated session, so it never blocks a normal logged-in user.
//
// Usage:
//   import { requireUser } from "../_shared/require-user.ts";
//   const guard = await requireUser(req);
//   if (!guard.ok) return guard.response;
//   // guard.userId is available from here on

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export type RequireUserResult =
  | { ok: true; userId: string }
  | { ok: false; response: Response };

function deny(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function requireUser(req: Request): Promise<RequireUserResult> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { ok: false, response: deny(401, "Unauthorized") };
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { ok: false, response: deny(401, "Unauthorized") };
  }

  return { ok: true, userId: user.id };
}
