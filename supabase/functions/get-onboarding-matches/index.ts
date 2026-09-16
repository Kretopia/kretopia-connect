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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get new user's profile
    const { data: myProfile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!myProfile) {
      return new Response(
        JSON.stringify({ error: "Profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get 5-10 diverse, active profiles to show
    const { data: potentialMatches } = await supabase
      .from("profiles")
      .select("user_id, full_name, role, avatar_url, bio, professional_skills, passion_skills, location")
      .neq("user_id", user.id)
      .not("avatar_url", "is", null)
      .not("bio", "is", null)
      .order("created_at", { ascending: false })
      .limit(20);

    if (!potentialMatches || potentialMatches.length === 0) {
      return new Response(
        JSON.stringify({ matches: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use AI to score and rank matches with sophisticated analysis
    const mySkills = [
      ...(Array.isArray(myProfile.professional_skills) ? myProfile.professional_skills : Object.keys(myProfile.professional_skills || {})),
      ...(Array.isArray(myProfile.passion_skills) ? myProfile.passion_skills : Object.keys(myProfile.passion_skills || {}))
    ];

    const prompt = `You are an expert matchmaking AI for creative professionals. Analyze collaboration potential with nuanced scoring.

NEW USER PROFILE:
Name: ${myProfile.full_name}
Role: ${myProfile.role}
Bio: ${myProfile.bio || "Not provided"}
Professional Skills: ${mySkills.filter(s => myProfile.professional_skills?.[s] || Array.isArray(myProfile.professional_skills)).join(", ") || "None"}
Passion Skills: ${mySkills.filter(s => myProfile.passion_skills?.[s] || Array.isArray(myProfile.passion_skills)).join(", ") || "None"}
Location: ${myProfile.location || "Not specified"}
Account Type: ${myProfile.account_type || "individual"}

POTENTIAL MATCHES:
${potentialMatches.map((p, i) => {
  const theirProfSkills = Array.isArray(p.professional_skills) ? p.professional_skills : Object.keys(p.professional_skills || {});
  const theirPassionSkills = Array.isArray(p.passion_skills) ? p.passion_skills : Object.keys(p.passion_skills || {});
  return `${i}. ${p.full_name} - ${p.role}
   Bio: ${p.bio || "No bio"}
   Professional: ${theirProfSkills.join(", ") || "None"}
   Passion: ${theirPassionSkills.join(", ") || "None"}
   Location: ${p.location || "Not specified"}`;
}).join("\n\n")}

SCORING CRITERIA (be specific and strategic):
1. **Complementary Skills** (35pts): Do they have skills that naturally work together? (e.g., videographer + editor, writer + illustrator)
2. **Role Synergy** (25pts): Do their roles align for productive collaboration? (e.g., director + cinematographer > director + director)
3. **Shared Interests** (20pts): Do they have overlapping passion skills or interests that could spark creative projects?
4. **Career Alignment** (10pts): Are they at similar career stages or have complementary experience levels?
5. **Geographic Proximity** (10pts): Being in the same location enables in-person collaboration

For each match, provide:
- **score**: 65-95 (be selective - only high-quality matches)
- **reason**: One compelling sentence explaining the main synergy (be specific, mention actual skills/roles)
- **collab_idea**: A concrete, actionable project idea they could start together (be creative and specific)
- **skill_match**: Array of 2-3 specific overlapping or complementary skills
- **match_type**: "complementary" (different but synergistic) or "similar" (shared expertise)

Return ONLY valid JSON array of top 6 matches, sorted by score:
[{"index": 0, "score": 88, "reason": "Your videography pairs perfectly with their editing and sound design expertise", "collab_idea": "Produce a short documentary combining your cinematography with their post-production magic", "skill_match": ["Video Production", "Audio Editing", "Storytelling"], "match_type": "complementary"}]`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { 
            role: "system", 
            content: "You are an expert creative collaboration matchmaker. Analyze profiles deeply to find genuine synergies. Be specific and strategic in your recommendations. Focus on actionable collaboration opportunities." 
          },
          { role: "user", content: prompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      console.error("AI error:", await aiResponse.text());
      // Fallback: return random 6 profiles
      const shuffled = potentialMatches.sort(() => 0.5 - Math.random());
      return new Response(
        JSON.stringify({
          matches: shuffled.slice(0, 6).map(p => ({
            user_id: p.user_id,
            full_name: p.full_name,
            role: p.role,
            avatar_url: p.avatar_url,
            bio: p.bio,
            match_score: 70,
            reason: "Great potential for collaboration",
            collab_idea: "Explore creative projects together"
          }))
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices[0]?.message?.content;
    
    let scores = [];
    try {
      scores = JSON.parse(content);
    } catch {
      console.error("Failed to parse AI response");
      scores = [];
    }

    // Build matched profiles with enhanced AI scores
    const rankedMatches = scores
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 6)
      .map((scoreData: any) => {
        const profile = potentialMatches[scoreData.index];
        return {
          user_id: profile.user_id,
          full_name: profile.full_name,
          role: profile.role,
          avatar_url: profile.avatar_url,
          bio: profile.bio,
          match_score: scoreData.score,
          reason: scoreData.reason,
          collab_idea: scoreData.collab_idea,
          skill_match: scoreData.skill_match || [],
          match_type: scoreData.match_type || "similar"
        };
      });

    return new Response(
      JSON.stringify({ matches: rankedMatches }),
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