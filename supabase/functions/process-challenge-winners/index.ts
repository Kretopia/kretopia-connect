import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdminOrCron, adminGuardCorsHeaders } from "../_shared/admin-guard.ts";

const corsHeaders = adminGuardCorsHeaders;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const guard = await requireAdminOrCron(req);
  if (!guard.ok) return guard.response;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find challenges past deadline that are still active
    const { data: expiredChallenges, error: findError } = await supabase
      .from("challenges")
      .select("*")
      .eq("status", "active")
      .lt("deadline", new Date().toISOString());

    if (findError) throw findError;

    const results = [];

    for (const challenge of expiredChallenges || []) {
      // Get top entry by votes
      const { data: topEntry } = await supabase
        .from("challenge_entries")
        .select("*")
        .eq("challenge_id", challenge.id)
        .order("vote_count", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (topEntry) {
        // Get winner profile
        const { data: winnerProfile } = await supabase
          .from("profiles")
          .select("full_name, xp")
          .eq("user_id", topEntry.user_id)
          .single();

        // Determine XP reward based on cadence
        const xpRewardMap: Record<string, number> = {
          daily: 100,
          "48hr": 200,
          weekly: 500,
        };
        const xpReward = xpRewardMap[challenge.cadence] || 100;

        // Award XP to winner
        await supabase
          .from("profiles")
          .update({ xp: (winnerProfile?.xp || 0) + xpReward })
          .eq("user_id", topEntry.user_id);

        // Record XP activity
        await supabase.from("xp_activities").insert({
          user_id: topEntry.user_id,
          activity_type: `challenge_win_${challenge.cadence}`,
          xp_earned: xpReward,
          description: `Won "${challenge.title}" challenge!`,
        });

        // Update leaderboard wins
        const { data: existing } = await supabase
          .from("challenge_leaderboard")
          .select("*")
          .eq("user_id", topEntry.user_id)
          .maybeSingle();

        if (existing) {
          await supabase
            .from("challenge_leaderboard")
            .update({
              total_wins: existing.total_wins + 1,
              total_challenge_xp: existing.total_challenge_xp + xpReward,
            })
            .eq("user_id", topEntry.user_id);
        } else {
          await supabase.from("challenge_leaderboard").insert({
            user_id: topEntry.user_id,
            total_wins: 1,
            total_challenge_xp: xpReward,
          });
        }

        // Create notification for winner
        await supabase.rpc("create_notification", {
          p_user_id: topEntry.user_id,
          p_title: "🏆 You Won!",
          p_message: `You won the "${challenge.title}" challenge! +${xpReward} XP`,
          p_type: "reward",
          p_link: "/cre8",
          p_action_url: "/cre8",
          p_action_text: "View Results",
          p_priority: "high",
          p_category: "reward",
        });

        // Auto-post win to Spark feed
        await supabase.from("feed_posts").insert({
          user_id: topEntry.user_id,
          content: `🏆 Won the "${challenge.title}" challenge with "${topEntry.title}"! +${xpReward} XP`,
          post_type: "activity",
          category: "challenge_win",
          auto_activity_message: `🏆 Won the "${challenge.title}" challenge!`,
          source_type: "challenge",
          source_id: challenge.id,
        });

        results.push({
          challenge: challenge.title,
          winner: winnerProfile?.full_name,
          xpAwarded: xpReward,
        });
      }

      // Mark challenge as completed
      await supabase
        .from("challenges")
        .update({ status: "completed" })
        .eq("id", challenge.id);
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
