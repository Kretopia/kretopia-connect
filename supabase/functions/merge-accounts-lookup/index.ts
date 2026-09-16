import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/** Looks up a user by email so the manual merge flow can target them. */
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
    const meId = u?.user?.id;
    const meEmail = u?.user?.email?.toLowerCase();
    if (!meId) return json({ error: "Unauthorized" }, 401);

    const { email } = await req.json();
    const target = (email || "").trim().toLowerCase();
    if (!target) return json({ error: "Email required" }, 400);
    if (target === meEmail) return json({ error: "That's your current account" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const found = list?.users?.find((x) => x.email?.toLowerCase() === target);
    if (!found) return json({ candidate: null });

    // Previously returned the target account's real name and avatar to any
    // authenticated caller who guessed their email — an email-to-identity
    // oracle with no relationship check. The actual merge is only ever
    // authorized later via a code sent to both inboxes (merge-accounts-init/
    // verify), so this lookup step doesn't need to reveal who the account
    // belongs to — just that one exists, so the UI can proceed to that
    // verified flow.
    return json({
      candidate: {
        candidate_user_id: found.id,
        full_name: null,
        avatar_url: null,
        masked_email: maskEmail(target),
        match_email_local: false,
        match_phone: false,
        match_name: false,
        overlap_count: 0,
        confidence: 0.5,
      },
    });
  } catch (e) {
    console.error("[merge-accounts-lookup]", e);
    return json({ error: e instanceof Error ? e.message : "error" }, 500);
  }
});

function maskEmail(e: string) {
  const [l, d] = e.split("@");
  return `${l.slice(0, 2)}${"•".repeat(Math.max(1, l.length - 2))}@${d}`;
}

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
