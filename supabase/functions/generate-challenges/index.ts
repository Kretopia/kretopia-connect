import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Finalize any expired active challenges first
    const { data: expired } = await supabase
      .from("challenges")
      .select("id, title, cadence, xp_reward")
      .eq("status", "active")
      .lt("ends_at", new Date().toISOString());

    if (expired && expired.length > 0) {
      for (const ch of expired) {
        // Get winner
        const { data: topEntry } = await supabase
          .from("challenge_entries")
          .select("id, user_id, title, vote_count, media_url, thumbnail_url")
          .eq("challenge_id", ch.id)
          .eq("status", "active")
          .order("vote_count", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (topEntry) {
          const xpMap: Record<string, number> = { daily: 100, "48hr": 200, weekly: 500 };
          const xp = xpMap[ch.cadence] || ch.xp_reward;

          // Award XP
          const { data: profile } = await supabase
            .from("profiles")
            .select("xp, full_name")
            .eq("user_id", topEntry.user_id)
            .single();

          if (profile) {
            await supabase
              .from("profiles")
              .update({ xp: (profile.xp || 0) + xp })
              .eq("user_id", topEntry.user_id);
          }

          // Record XP activity
          await supabase.from("xp_activities").insert({
            user_id: topEntry.user_id,
            activity_type: `challenge_win_${ch.cadence}`,
            xp_earned: xp,
            description: `Won "${ch.title}" challenge!`,
          });

          // Update leaderboard
          const { data: lb } = await supabase
            .from("challenge_leaderboard")
            .select("*")
            .eq("user_id", topEntry.user_id)
            .maybeSingle();

          if (lb) {
            await supabase
              .from("challenge_leaderboard")
              .update({
                total_wins: (lb.total_wins || 0) + 1,
                total_challenge_xp: (lb.total_challenge_xp || 0) + xp,
              })
              .eq("user_id", topEntry.user_id);
          } else {
            await supabase.from("challenge_leaderboard").insert({
              user_id: topEntry.user_id,
              total_wins: 1,
              total_challenge_xp: xp,
            });
          }

          // Notification
          await supabase.rpc("create_notification", {
            p_user_id: topEntry.user_id,
            p_title: "🏆 You Won!",
            p_message: `You won "${ch.title}"! +${xp} XP`,
            p_type: "reward",
            p_link: "/cre8",
            p_action_url: "/cre8",
            p_action_text: "View Results",
            p_priority: "high",
            p_category: "reward",
          });

          // Auto-post to Spark feed
          await supabase.from("feed_posts").insert({
            user_id: topEntry.user_id,
            content: `🏆 Won the "${ch.title}" challenge! +${xp} XP`,
            post_type: "activity",
            category: "challenge_win",
            auto_activity_message: `🏆 Won the "${ch.title}" challenge in the Cre8 Arena!`,
            source_type: "challenge",
            source_id: ch.id,
            link_url: topEntry.thumbnail_url || topEntry.media_url,
            link_title: topEntry.title,
          });
        }

        // Mark completed
        await supabase.from("challenges").update({ status: "completed" }).eq("id", ch.id);
      }
      console.log(`Finalized ${expired.length} expired challenges`);
    }

    // 2. Check what cadences need new challenges
    const now = new Date();
    const categories = ["music", "visual", "fashion", "film", "photography", "design", "writing"];

    // Count active challenges by cadence
    const { data: activeChallenges } = await supabase
      .from("challenges")
      .select("cadence")
      .eq("status", "active");

    const activeCounts: Record<string, number> = { daily: 0, "48hr": 0, weekly: 0 };
    for (const c of activeChallenges || []) {
      activeCounts[c.cadence] = (activeCounts[c.cadence] || 0) + 1;
    }

    const needed: { cadence: string; count: number; deadline_hours: number }[] = [];

    // Always maintain at least 1 daily, 1 48hr, 1 weekly active
    if (activeCounts.daily < 1) needed.push({ cadence: "daily", count: 1, deadline_hours: 24 });
    if (activeCounts["48hr"] < 1) needed.push({ cadence: "48hr", count: 1, deadline_hours: 48 });
    if (activeCounts.weekly < 1) needed.push({ cadence: "weekly", count: 1, deadline_hours: 168 });

    if (needed.length === 0) {
      return new Response(
        JSON.stringify({ message: "All cadences have active challenges", finalized: expired?.length || 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Generate challenges using AI
    const challengeDescriptions = needed.map((n) => {
      return `1 ${n.cadence} challenge (${n.deadline_hours}h deadline)`;
    });

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "user",
            content: `Generate creative challenges for Kretopia's Cre8 Arena — a competitive creative platform for musicians, designers, filmmakers, photographers, writers, and content creators.

Generate exactly: ${challengeDescriptions.join(", ")}

Requirements:
- Each challenge should have a clear, specific creative brief (not vague)
- Titles should be catchy and under 60 characters
- Flash challenges should be ultra-specific (e.g., "Shoot a portrait using only natural light in 2 hours")
- Daily challenges are quick creative tasks
- 48hr challenges require more effort
- Weekly challenges are substantial projects
- Mix categories across: ${categories.join(", ")}
- Include specific requirements/constraints to make it interesting
- Think GuruShots meets creative hackathon

Return ONLY valid JSON array:
[{
  "title": "Challenge title",
  "description": "2-3 sentence creative brief",
  "category": "one of: ${categories.join(", ")}",
  "cadence": "daily|48hr|weekly",
  "xp_reward": number (daily:100, 48hr:200, weekly:500),
  "deadline_hours": number
}]`,
          },
        ],
      }),
    });

    if (!response.ok) throw new Error(`AI generation failed: ${response.status}`);

    const aiData = await response.json();
    const content = aiData.choices[0].message.content;
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("Failed to parse AI response");

    const challenges = JSON.parse(jsonMatch[0]);

    // Get a system user for created_by (use the first admin or any user)
    const { data: systemUser } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin")
      .limit(1)
      .maybeSingle();

    // Fallback: use any existing user
    let createdBy = systemUser?.user_id;
    if (!createdBy) {
      const { data: anyUser } = await supabase
        .from("profiles")
        .select("user_id")
        .limit(1)
        .single();
      createdBy = anyUser?.user_id;
    }

    if (!createdBy) {
      return new Response(
        JSON.stringify({ error: "No users found to assign as challenge creator" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const inserted = [];
    for (const ch of challenges) {
      const deadlineHours = ch.deadline_hours || (ch.cadence === "daily" ? 24 : ch.cadence === "48hr" ? 48 : 168);
      const endsAt = new Date(now.getTime() + deadlineHours * 60 * 60 * 1000);

      const { data: newChallenge, error } = await supabase
        .from("challenges")
        .insert({
          title: ch.title,
          description: ch.description,
          category: ch.category || "visual",
          cadence: ch.cadence || "daily",
          starts_at: now.toISOString(),
          ends_at: endsAt.toISOString(),
          xp_reward: ch.xp_reward || 100,
          status: "active",
          created_by: createdBy,
        })
        .select()
        .single();

      if (error) {
        console.error("Insert challenge error:", error);
      } else {
        inserted.push(newChallenge);
      }
    }

    console.log(`Generated ${inserted.length} new challenges`);

    return new Response(
      JSON.stringify({
        finalized: expired?.length || 0,
        generated: inserted.length,
        challenges: inserted,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
