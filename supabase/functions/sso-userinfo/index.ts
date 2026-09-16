import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(
      JSON.stringify({ error: "method_not_allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Extract the ThriveIN SSO access token from Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "unauthorized", message: "Bearer token required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = authHeader.replace("Bearer ", "");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Look up the access token
    const { data: tokenRecord, error: tokenError } = await supabaseAdmin
      .from("oauth_tokens")
      .select("user_id, scopes, expires_at, revoked, app_id")
      .eq("access_token", accessToken)
      .single();

    if (tokenError || !tokenRecord) {
      return new Response(
        JSON.stringify({ error: "invalid_token", message: "Token not found or invalid" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (tokenRecord.revoked) {
      return new Response(
        JSON.stringify({ error: "invalid_token", message: "Token has been revoked" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (new Date(tokenRecord.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "invalid_token", message: "Token has expired" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch user profile
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("user_id, full_name, avatar_url, role, bio, professional_skills, location, social_links, portfolio_items, verification_score")
      .eq("user_id", tokenRecord.user_id)
      .single();

    if (!profile) {
      return new Response(
        JSON.stringify({ error: "not_found", message: "User profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build response based on granted scopes
    const scopes = tokenRecord.scopes || ["profile"];
    const response: Record<string, any> = {
      id: profile.user_id,
      name: profile.full_name,
      avatar_url: profile.avatar_url,
      role: profile.role,
    };

    // Extended profile data
    if (scopes.includes("profile")) {
      response.bio = profile.bio;
      response.skills = profile.professional_skills;
      response.location = profile.location;
      response.verification_score = profile.verification_score;
    }

    // Portfolio data
    if (scopes.includes("portfolio")) {
      response.portfolio = profile.portfolio_items;
      response.social_links = profile.social_links;
    }

    console.log(`[SSO] Userinfo served for user ${profile.user_id}`);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[SSO Userinfo] Error:", error);
    return new Response(
      JSON.stringify({ error: "server_error", message: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
