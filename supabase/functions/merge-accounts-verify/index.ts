import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Verifies both OTPs and, if successful, executes the merge.
 * Body: { request_id, source_otp, target_otp }
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    });
    const { data: u } = await userClient.auth.getUser();
    const userId = u?.user?.id;
    if (!userId) return json({ error: "Unauthorized" }, 401);

    const { request_id, source_otp, target_otp } = await req.json();
    if (!request_id || !source_otp || !target_otp) return json({ error: "Missing fields" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: row, error: rowErr } = await admin
      .from("account_merge_requests")
      .select("*")
      .eq("id", request_id)
      .maybeSingle();
    if (rowErr || !row) return json({ error: "Request not found" }, 404);
    if (row.initiator_user_id !== userId) return json({ error: "Forbidden" }, 403);
    if (row.status !== "pending") return json({ error: `Request is ${row.status}` }, 400);
    if (new Date(row.expires_at).getTime() < Date.now()) {
      await admin.from("account_merge_requests").update({ status: "expired" }).eq("id", request_id);
      return json({ error: "Codes expired — please restart" }, 410);
    }
    if (row.attempts >= 5) return json({ error: "Too many attempts" }, 429);

    const [srcOk, tgtOk] = await Promise.all([
      verifyHash(source_otp, row.source_otp_hash),
      verifyHash(target_otp, row.target_otp_hash),
    ]);

    if (!srcOk || !tgtOk) {
      await admin
        .from("account_merge_requests")
        .update({ attempts: row.attempts + 1 })
        .eq("id", request_id);
      return json({ error: "Codes don't match. Please try again." }, 400);
    }

    // Run the merge
    const { data: merged, error: mergeErr } = await admin.rpc("merge_user_data", {
      p_source_user_id: row.source_user_id,
      p_target_user_id: row.target_user_id,
    });
    if (mergeErr) {
      await admin
        .from("account_merge_requests")
        .update({ status: "failed", error: mergeErr.message })
        .eq("id", request_id);
      throw mergeErr;
    }

    // Delete the source auth user (cascades nothing — profile already tombstoned)
    const { error: delErr } = await admin.auth.admin.deleteUser(row.source_user_id);
    if (delErr) console.warn("[merge] auth user delete warning:", delErr.message);

    // Best-effort delete tombstoned source profile row
    await admin.from("profiles").delete().eq("user_id", row.source_user_id);

    await admin
      .from("account_merge_requests")
      .update({
        status: "completed",
        source_verified_at: new Date().toISOString(),
        target_verified_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      })
      .eq("id", request_id);

    return json({ success: true, moved: merged });
  } catch (e) {
    console.error("[merge-accounts-verify]", e);
    return json({ error: e instanceof Error ? e.message : "error" }, 500);
  }
});

async function verifyHash(input: string, expected: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  const hex = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  // constant-time-ish compare
  if (hex.length !== expected.length) return false;
  let r = 0;
  for (let i = 0; i < hex.length; i++) r |= hex.charCodeAt(i) ^ expected.charCodeAt(i);
  return r === 0;
}

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
