import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { requireAdminOrCron } from "../_shared/admin-guard.ts";


import { corsFor } from '../_shared/guard.ts';
serve(async (req) => {
  const corsHeaders = corsFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Cron or admin only (x-cron-secret or an admin session). This runs with the
  // service role and sends to real users, so the public anon key must not be
  // enough to trigger it. It used to say "no auth check needed".
  const guard = await requireAdminOrCron(req);
  if (!guard.ok) return guard.response;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Find users who haven't been active in 24h but have unread notifications
    const { data: staleUsers } = await supabase
      .from("notifications")
      .select("user_id, title, type")
      .eq("is_read", false)
      .gte("created_at", oneDayAgo.toISOString())
      .order("created_at", { ascending: false })
      .limit(100);

    if (!staleUsers || staleUsers.length === 0) {
      return new Response(JSON.stringify({ message: "No pending notifications" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group by user
    const byUser = new Map<string, { count: number; latest: string; type: string }>();
    for (const n of staleUsers) {
      if (!byUser.has(n.user_id)) {
        byUser.set(n.user_id, { count: 0, latest: n.title, type: n.type });
      }
      byUser.get(n.user_id)!.count++;
    }

    // Create in-app reminder notifications for users with 3+ unread
    const reminders = [];
    for (const [userId, info] of byUser) {
      if (info.count < 3) continue;

      let message = "";
      if (info.type === "match") message = `You have ${info.count} unread matches waiting! Don't miss your next collaboration.`;
      else if (info.type === "application") message = `${info.count} creators applied to your gig — review them before they move on!`;
      else if (info.type === "message") message = `You have ${info.count} unread messages. Keep the conversation going!`;
      else message = `You have ${info.count} unread notifications. Come back and check what's new!`;

      reminders.push({
        user_id: userId,
        type: "reminder",
        title: "🔔 You have activity waiting!",
        message,
        link: "/notifications",
        action_url: "/notifications",
        action_text: "View All",
      });
    }

    if (reminders.length > 0) {
      await supabase.from("notifications").insert(reminders);
    }

    return new Response(JSON.stringify({ reminders_sent: reminders.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("re-engagement error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
