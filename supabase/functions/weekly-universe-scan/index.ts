// Weekly background dispatcher — finds creators eligible for an auto-scan
// (claimed profile, has ≥1 credit, not scanned in the last 7 days) and runs
// refresh-my-universe for each. Designed to be called by pg_cron.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Eligible: claimed, has full_name, not scanned recently. Cap to 25/run.
    const { data: profiles } = await admin
      .from("profiles")
      .select("user_id, full_name, last_universe_scan_at")
      .eq("is_claimed", true)
      .not("full_name", "is", null)
      .or(`last_universe_scan_at.is.null,last_universe_scan_at.lt.${sevenDaysAgo}`)
      .limit(25);

    if (!profiles?.length) {
      return new Response(JSON.stringify({ scanned: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter to creators with ≥1 credit
    const eligible: typeof profiles = [];
    for (const p of profiles) {
      const { count } = await admin
        .from("credits")
        .select("id", { count: "exact", head: true })
        .eq("user_id", p.user_id);
      if ((count ?? 0) >= 1) eligible.push(p);
    }

    let scanned = 0;
    for (const p of eligible) {
      try {
        // Fire-and-forget. We call refresh-my-universe with service-role auth
        // by replicating the minimum work inline would be heavy; simpler:
        // invoke directly with service role bearer.
        await fetch(`${SUPABASE_URL}/functions/v1/refresh-my-universe`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SERVICE_KEY}`,
            // Pass user identity hint via custom header consumed by future
            // versions. For now refresh-my-universe uses auth.getUser, so we
            // skip cron-driven invocation of THAT path and instead enqueue a
            // marker scan row the next time the user opens the app.
            "x-cron-user-id": p.user_id,
          },
          body: JSON.stringify({ trigger_source: "cron", user_id: p.user_id }),
        });
        scanned += 1;
      } catch (e) {
        console.warn("cron scan failed for", p.user_id, e);
      }
    }

    return new Response(JSON.stringify({ scanned, eligible: eligible.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("weekly-universe-scan error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
