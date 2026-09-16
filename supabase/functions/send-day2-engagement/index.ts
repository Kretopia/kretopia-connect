// Day-2 engagement edge function — runs daily via cron.
// Sends a personalized "your first days on Kretopia" email to users
// who completed onboarding 2-3 days ago and haven't been emailed yet.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();

    // Eligible: onboarded, created 2-4 days ago, not yet sent day-2 email
    const { data: candidates, error: fetchError } = await supabase
      .from("profiles")
      .select("user_id, full_name, role")
      .eq("onboarding_completed", true)
      .is("day2_engagement_sent_at", null)
      .gte("created_at", fourDaysAgo)
      .lte("created_at", twoDaysAgo)
      .limit(50);

    if (fetchError) throw fetchError;

    console.log(`[day2-engagement] Found ${candidates?.length ?? 0} candidates`);

    let sent = 0;
    let skipped = 0;
    let errors = 0;

    for (const p of candidates ?? []) {
      try {
        // Resolve email
        const { data: userData } = await supabase.auth.admin.getUserById(p.user_id);
        const email = userData?.user?.email;
        if (!email) { skipped++; continue; }

        // Personalization data
        const role = (p.role || "").trim();
        let gigCount = 0;
        if (role) {
          const { count } = await supabase
            .from("opportunities")
            .select("id", { count: "exact", head: true })
            .eq("status", "active")
            .or(`title.ilike.%${role}%,description.ilike.%${role}%`);
          gigCount = count ?? 0;
        }

        // Profile views (last 7 days) — best-effort, table may be sparse
        let profileViews = 0;
        try {
          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
          const { count } = await supabase
            .from("analytics_events")
            .select("id", { count: "exact", head: true })
            .eq("event_name", "profile_viewed")
            .eq("event_properties->>profile_id", p.user_id)
            .gte("created_at", sevenDaysAgo);
          profileViews = count ?? 0;
        } catch { /* analytics optional */ }

        const firstName = (p.full_name || "").split(" ")[0] || "there";

        const { error: emailErr } = await supabase.functions.invoke(
          "send-transactional-email",
          {
            body: {
              templateName: "day2-engagement",
              recipientEmail: email,
              recipientUserId: p.user_id,
              idempotencyKey: `day2-engagement-${p.user_id}`,
              templateData: { name: firstName, gigCount, profileViews, role },
            },
          }
        );

        if (emailErr) {
          console.error(`[day2-engagement] send failed for ${email}:`, emailErr);
          errors++;
          continue;
        }

        await supabase
          .from("profiles")
          .update({ day2_engagement_sent_at: new Date().toISOString() })
          .eq("user_id", p.user_id);

        sent++;
        console.log(`[day2-engagement] Sent to ${email} (gigs: ${gigCount}, views: ${profileViews})`);
      } catch (e) {
        console.error(`[day2-engagement] error for ${p.user_id}:`, e);
        errors++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent, skipped, errors, candidates: candidates?.length ?? 0 }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("[day2-engagement] fatal:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
