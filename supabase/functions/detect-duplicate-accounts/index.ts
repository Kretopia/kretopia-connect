import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";


import { corsFor } from '../_shared/guard.ts';
Deno.serve(async (req) => {
  const corsHeaders = corsFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) return json(corsHeaders, { error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await admin.rpc("find_duplicate_account_candidates", {
      p_user_id: userId,
    });
    if (error) throw error;

    // Attach masked email for display
    const ids = (data || []).map((d: any) => d.candidate_user_id);
    const emails: Record<string, string> = {};
    if (ids.length) {
      const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
      list?.users?.forEach((u) => {
        if (u.id && ids.includes(u.id) && u.email) emails[u.id] = maskEmail(u.email);
      });
    }
    const enriched = (data || []).map((d: any) => ({
      ...d,
      masked_email: emails[d.candidate_user_id] || null,
    }));
    return json(corsHeaders, { candidates: enriched });
  } catch (e) {
    console.error("[detect-duplicate-accounts]", e);
    return json(corsHeaders, { error: e instanceof Error ? e.message : "error" }, 500);
  }
});

function maskEmail(e: string) {
  const [local, domain] = e.split("@");
  if (!local || !domain) return e;
  const visible = local.slice(0, 2);
  return `${visible}${"•".repeat(Math.max(1, local.length - 2))}@${domain}`;
}

function json(corsHeaders: Record<string, string>, corsHeaders: Record<string, string>, corsHeaders: Record<string, string>, corsHeaders: Record<string, string>, b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
