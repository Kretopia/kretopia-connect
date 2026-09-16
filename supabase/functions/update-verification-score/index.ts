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
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Require a valid user JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized", success: false }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const authed = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authed.auth.getClaims(token);
    const callerId = claimsData?.claims?.sub as string | undefined;
    if (claimsError || !callerId) {
      return new Response(JSON.stringify({ error: "Unauthorized", success: false }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const requestedId = typeof body?.userId === "string" ? body.userId : undefined;

    // A user may only recalculate their own score
    if (requestedId && requestedId !== callerId) {
      return new Response(JSON.stringify({ error: "Forbidden", success: false }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = callerId;

    console.log(`[UPDATE-SCORE] Calculating verification score for user ${userId}`);

    // Fetch all data needed for score calculation
    const [portfolioResult, creditsResult, awardsResult, pressResult, profileResult] = await Promise.all([
      supabaseClient.from("portfolio_items").select("id", { count: "exact", head: true }).eq("user_id", userId),
      supabaseClient.from("credits").select("id", { count: "exact", head: true }).eq("user_id", userId),
      supabaseClient.from("awards").select("id", { count: "exact", head: true }).eq("user_id", userId),
      supabaseClient.from("press_links").select("id", { count: "exact", head: true }).eq("user_id", userId),
      supabaseClient.from("profiles").select("instagram_url, twitter_url, linkedin_url, spotify_url, behance_url, imdb_url, youtube_url, tiktok_url").eq("user_id", userId).single()
    ]);

    const portfolioCount = portfolioResult.count || 0;
    const creditsCount = creditsResult.count || 0;
    const awardsCount = awardsResult.count || 0;
    const pressCount = pressResult.count || 0;
    
    // Check social links
    const profile = profileResult.data;
    const socialLinksCount = [
      profile?.instagram_url,
      profile?.twitter_url,
      profile?.linkedin_url,
      profile?.spotify_url,
      profile?.behance_url,
      profile?.imdb_url,
      profile?.youtube_url,
      profile?.tiktok_url
    ].filter(Boolean).length;
    
    const socialVerified = socialLinksCount > 0;

    // Calculate score using the same logic as VerificationProgress component
    const portfolioPoints = Math.min(40, 
      portfolioCount >= 10 ? 40 : 
      portfolioCount >= 7 ? 35 : 
      portfolioCount >= 4 ? 28 : 
      portfolioCount >= 2 ? 15 : 0
    );
    
    const creditsPoints = Math.min(25, creditsCount * 3);
    
    const socialPoints = 
      !socialVerified ? 0 :
      (pressCount > 0 || awardsCount > 0) ? 20 :
      portfolioCount >= 3 ? 15 : 8;
    
    const awardsPoints = 
      awardsCount === 0 ? 0 :
      awardsCount >= 2 ? 10 : 7;
    
    const pressPoints = pressCount > 0 ? 5 : 0;
    
    const totalScore = portfolioPoints + creditsPoints + socialPoints + awardsPoints + pressPoints;

    console.log(`[UPDATE-SCORE] Score breakdown for ${userId}:`, {
      portfolioPoints,
      creditsPoints,
      socialPoints,
      awardsPoints,
      pressPoints,
      totalScore
    });

    // Update the verification score in the database
    const { error: updateError } = await supabaseClient
      .from("profiles")
      .update({ verification_score: totalScore })
      .eq("user_id", userId);

    if (updateError) {
      throw updateError;
    }

    console.log(`[UPDATE-SCORE] Successfully updated score to ${totalScore} for user ${userId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        score: totalScore,
        breakdown: {
          portfolioPoints,
          creditsPoints,
          socialPoints,
          awardsPoints,
          pressPoints
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[UPDATE-SCORE] Error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        success: false 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
