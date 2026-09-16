// Admin guard for sensitive edge functions.
// Allows the request if EITHER:
//   1) Header `x-cron-secret` matches Deno env CRON_SECRET (server-to-server / pg_cron)
//   2) The bearer JWT belongs to a user with `admin` role in public.user_roles
//
// Usage:
//   import { requireAdminOrCron } from "../_shared/admin-guard.ts";
//   const guard = await requireAdminOrCron(req);
//   if (!guard.ok) return guard.response;
//
// Returns a Response with proper CORS + JSON when the caller is unauthorized.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export type AdminGuardResult =
  | { ok: true; userId: string | null; viaCron: boolean }
  | { ok: false; response: Response };

function deny(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function requireAdminOrCron(req: Request): Promise<AdminGuardResult> {
  // 1) Cron / server-to-server path
  const cronSecret = Deno.env.get("CRON_SECRET");
  const headerSecret = req.headers.get("x-cron-secret");
  if (cronSecret && headerSecret && headerSecret === cronSecret) {
    return { ok: true, userId: null, viaCron: true };
  }

  // 2) Admin-user path
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { ok: false, response: deny(401, "Unauthorized") };
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
  if (claimsErr || !claimsData?.claims?.sub) {
    return { ok: false, response: deny(401, "Unauthorized") };
  }
  const userId = claimsData.claims.sub as string;

  // Use service role to check role (bypasses RLS for the lookup)
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { data: roleRow } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

  if (!roleRow) {
    return { ok: false, response: deny(403, "Admin role required") };
  }

  return { ok: true, userId, viaCron: false };
}

export const adminGuardCorsHeaders = corsHeaders;
