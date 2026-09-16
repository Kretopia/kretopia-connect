// auto-outreach-watch — runs every 6h via cron.
// For each Pro+ user with Gmail connected: pick top 3 fresh sponsor_leads (fit_score>=70, status='new')
// and call draft-outreach-email for each. Emits a single notification per user.
//
// Auth: x-cron-secret header must equal CRON_SECRET env.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { requireAdminOrCron, adminGuardCorsHeaders } from "../_shared/admin-guard.ts";

const corsHeaders = adminGuardCorsHeaders;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET")!; // used for downstream invoke

const ELIGIBLE_TIERS = ["pro", "creator_plus", "creatorplus", "creator+", "founder", "founding_member"];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const guard = await requireAdminOrCron(req);
    if (!guard.ok) return guard.response;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find candidate users: have Gmail connected AND on Pro+ tier.
    const { data: settings } = await admin
      .from("user_email_settings")
      .select("user_id, is_configured, provider")
      .eq("is_configured", true)
      .eq("provider", "gmail");

    const userIds = (settings || []).map((s: any) => s.user_id);
    if (userIds.length === 0) return json({ ok: true, drafted: 0, reason: "no eligible users" });

    const { data: profiles } = await admin
      .from("profiles")
      .select("user_id, subscription_tier, display_name")
      .in("user_id", userIds);

    const eligibleUsers = (profiles || []).filter((p: any) =>
      ELIGIBLE_TIERS.includes((p.subscription_tier || "").toLowerCase()),
    );

    let totalDrafted = 0;
    const perUserCounts: Record<string, number> = {};

    for (const user of eligibleUsers) {
      // Skip users that already have 3+ drafts pending review
      const { count: pendingCount } = await admin
        .from("outreach_drafts")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.user_id)
        .eq("status", "draft");

      if ((pendingCount ?? 0) >= 3) continue;

      const slots = 3 - (pendingCount ?? 0);

      const { data: leads } = await admin
        .from("sponsor_leads")
        .select("id, brand_name, fit_score")
        .eq("user_id", user.user_id)
        .eq("status", "new")
        .gte("fit_score", 70)
        .order("fit_score", { ascending: false })
        .limit(slots);

      if (!leads || leads.length === 0) continue;

      let drafted = 0;
      for (const lead of leads) {
        try {
          const r = await fetch(`${SUPABASE_URL}/functions/v1/draft-outreach-email`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-cron-secret": CRON_SECRET,
            },
            body: JSON.stringify({ user_id: user.user_id, lead_id: lead.id }),
          });
          if (r.ok) drafted++;
          await new Promise((res) => setTimeout(res, 250)); // small spacing
        } catch (e) {
          console.error("draft fail", user.user_id, lead.id, e);
        }
      }

      if (drafted > 0) {
        perUserCounts[user.user_id] = drafted;
        totalDrafted += drafted;

        // Notification (best effort)
        await admin.from("notifications").insert({
          user_id: user.user_id,
          type: "outreach_drafts_ready",
          category: "agent",
          title: `Kreto drafted ${drafted} sponsor pitch${drafted === 1 ? "" : "es"}`,
          message: "Review and approve to send.",
          action_url: "/intel?tab=outbox",
          action_text: "Review",
        }).catch((e: any) => console.error("notif insert err", e));
      }
    }

    return json({ ok: true, total_drafted: totalDrafted, users: Object.keys(perUserCounts).length });
  } catch (e) {
    console.error("auto-outreach-watch error", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
