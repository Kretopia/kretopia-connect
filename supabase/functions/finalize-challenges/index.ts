import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdminOrCron, adminGuardCorsHeaders } from "../_shared/admin-guard.ts";

const corsHeaders = adminGuardCorsHeaders;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const guard = await requireAdminOrCron(req);
  if (!guard.ok) return guard.response;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Find challenges past deadline that are still "active"
    const { data: expiredChallenges, error: fetchErr } = await supabase
      .from("challenges")
      .select("id, title, cadence, xp_reward, is_flash")
      .eq("status", "active")
      .lt("deadline", new Date().toISOString());

    if (fetchErr) throw fetchErr;
    if (!expiredChallenges || expiredChallenges.length === 0) {
      return new Response(JSON.stringify({ message: "No challenges to finalize" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = [];

    for (const challenge of expiredChallenges) {
      // Get all entries sorted by votes
      const { data: entries } = await supabase
        .from("challenge_entries")
        .select("id, user_id, title, vote_count, media_url, thumbnail_url")
        .eq("challenge_id", challenge.id)
        .eq("status", "active")
        .order("vote_count", { ascending: false });

      if (!entries || entries.length === 0) {
        // No entries - just mark as completed
        await supabase.from("challenges").update({ status: "completed" }).eq("id", challenge.id);
        continue;
      }

      const totalEntries = entries.length;
      const top10Count = Math.max(1, Math.ceil(totalEntries * 0.1));
      const allStarCount = Math.max(1, Math.ceil(totalEntries * 0.3));

      // XP rewards by cadence
      const cadenceXP: Record<string, number> = {
        daily: 100,
        "48hr": 200,
        weekly: 500,
      };
      const winnerXP = cadenceXP[challenge.cadence] || challenge.xp_reward;

      // Award achievements
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const tiers: { tier: string; xp: number }[] = [];

        // Winner (1st place)
        if (i === 0) {
          tiers.push({ tier: "winner", xp: winnerXP });
        }
        // Top 10%
        if (i < top10Count) {
          tiers.push({ tier: "top_10", xp: 50 });
        }
        // All-Star (top 30%)
        if (i < allStarCount) {
          tiers.push({ tier: "all_star", xp: 75 });
        }

        for (const { tier, xp } of tiers) {
          // Insert achievement
          await supabase.from("challenge_achievements").insert({
            challenge_id: challenge.id,
            user_id: entry.user_id,
            entry_id: entry.id,
            achievement_tier: tier,
            xp_awarded: xp,
          }).maybeSingle(); // ignore duplicates

          // Award XP
          await supabase
            .from("profiles")
            .update({ xp: supabase.rpc ? undefined : undefined })
            .eq("user_id", entry.user_id);

          // Use raw SQL via RPC for atomic XP increment
          // Fallback: read-then-write
          const { data: profile } = await supabase
            .from("profiles")
            .select("xp")
            .eq("user_id", entry.user_id)
            .single();

          if (profile) {
            await supabase
              .from("profiles")
              .update({ xp: (profile.xp || 0) + xp })
              .eq("user_id", entry.user_id);
          }

          // Record XP activity
          await supabase.from("xp_activities").insert({
            user_id: entry.user_id,
            activity_type: `challenge_${tier}`,
            xp_earned: xp,
            description: `${tier === "winner" ? "🏆 Won" : tier === "top_10" ? "🔟 Top 10% in" : "⭐ All-Star in"} "${challenge.title}"`,
          });

          // Update leaderboard stats
          if (tier === "winner") {
            await supabase.rpc("", {}).catch(() => {});
            const { data: lb } = await supabase
              .from("challenge_leaderboard")
              .select("*")
              .eq("user_id", entry.user_id)
              .single();

            if (lb) {
              await supabase
                .from("challenge_leaderboard")
                .update({
                  total_wins: (lb.total_wins || 0) + 1,
                  total_challenge_xp: (lb.total_challenge_xp || 0) + xp,
                })
                .eq("user_id", entry.user_id);
            }
          } else if (tier === "top_10") {
            const { data: lb } = await supabase
              .from("challenge_leaderboard")
              .select("*")
              .eq("user_id", entry.user_id)
              .single();
            if (lb) {
              await supabase
                .from("challenge_leaderboard")
                .update({
                  top_10_finishes: (lb.top_10_finishes || 0) + 1,
                  total_challenge_xp: (lb.total_challenge_xp || 0) + xp,
                })
                .eq("user_id", entry.user_id);
            }
          } else if (tier === "all_star") {
            const { data: lb } = await supabase
              .from("challenge_leaderboard")
              .select("*")
              .eq("user_id", entry.user_id)
              .single();
            if (lb) {
              await supabase
                .from("challenge_leaderboard")
                .update({
                  all_star_finishes: (lb.all_star_finishes || 0) + 1,
                  total_challenge_xp: (lb.total_challenge_xp || 0) + xp,
                })
                .eq("user_id", entry.user_id);
            }
          }
        }

        // Auto-post winner celebration to Spark feed
        if (i === 0) {
          const { data: winnerProfile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("user_id", entry.user_id)
            .single();

          await supabase.from("feed_posts").insert({
            user_id: entry.user_id,
            content: `🏆 Just won the "${challenge.title}" challenge! +${winnerXP} XP`,
            post_type: "activity",
            category: "achievement",
            auto_activity_message: `🏆 Won the "${challenge.title}" challenge in the Cre8 Arena!`,
            source_type: "challenge",
            source_id: challenge.id,
            link_url: entry.thumbnail_url || entry.media_url,
            link_title: entry.title,
          });

          // Send notification
          await supabase.rpc("create_notification", {
            p_user_id: entry.user_id,
            p_title: "🏆 Challenge Won!",
            p_message: `You won "${challenge.title}"! +${winnerXP} XP`,
            p_type: "reward",
            p_link: "/cre8",
            p_action_url: "/cre8",
            p_action_text: "View Results",
            p_priority: "high",
            p_category: "reward",
          });
        }
      }

      // Mark challenge as completed
      await supabase.from("challenges").update({ status: "completed" }).eq("id", challenge.id);

      results.push({
        challengeId: challenge.id,
        title: challenge.title,
        totalEntries,
        winnerId: entries[0]?.user_id,
      });
    }

    return new Response(JSON.stringify({ finalized: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
