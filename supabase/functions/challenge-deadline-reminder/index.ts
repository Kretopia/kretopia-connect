import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const now = new Date();

    // Find challenges ending in the next 6 hours that are still active
    const sixHoursFromNow = new Date(now.getTime() + 6 * 60 * 60 * 1000);

    const { data: expiringChallenges, error: challengeErr } = await supabase
      .from("challenges")
      .select("id, title, ends_at, cadence")
      .eq("status", "active")
      .gte("ends_at", now.toISOString())
      .lte("ends_at", sixHoursFromNow.toISOString());

    if (challengeErr) throw challengeErr;

    if (!expiringChallenges || expiringChallenges.length === 0) {
      return new Response(
        JSON.stringify({ message: "No challenges expiring soon" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let notificationsSent = 0;

    for (const challenge of expiringChallenges) {
      const hoursLeft = Math.ceil(
        (new Date(challenge.ends_at).getTime() - now.getTime()) /
          (1000 * 60 * 60)
      );

      // Get all users who have entries in this challenge
      const { data: participants } = await supabase
        .from("challenge_entries")
        .select("user_id")
        .eq("challenge_id", challenge.id);

      const participantIds = new Set(
        (participants || []).map((p: any) => p.user_id)
      );

      // Notify participants
      for (const userId of participantIds) {
        await supabase.rpc("create_notification", {
          p_user_id: userId,
          p_title: `⏰ Challenge Ending Soon!`,
          p_message: `"${challenge.title}" ends in ${hoursLeft} hours. Check your entry!`,
          p_type: "challenge",
          p_link: "/cre8",
          p_action_url: "/cre8",
          p_action_text: "View Challenge",
          p_priority: "high",
          p_category: "challenge",
        });
        notificationsSent++;
      }
    }

    return new Response(
      JSON.stringify({
        message: `Sent ${notificationsSent} deadline reminders for ${expiringChallenges.length} challenges`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
