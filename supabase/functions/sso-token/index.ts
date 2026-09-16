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

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "method_not_allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json();
    const { grant_type, code, client_id, client_secret, redirect_uri } = body;

    // Validate grant type
    if (grant_type !== "authorization_code") {
      return new Response(
        JSON.stringify({ error: "unsupported_grant_type", message: "Only 'authorization_code' is supported" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!code || !client_id || !client_secret || !redirect_uri) {
      return new Response(
        JSON.stringify({ error: "invalid_request", message: "code, client_id, client_secret, and redirect_uri are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify client credentials via the server-side hash comparison RPC --
    // this function never sees or compares the stored secret directly, and
    // transparently accepts a still-in-grace-window previous secret after
    // a rotation (see rotate_oauth_app_secret / verify_oauth_app_secret,
    // 20260910150000_oauth_client_secret_rotation.sql).
    const { data: verified, error: verifyError } = await supabaseAdmin
      .rpc("verify_oauth_app_secret", { _client_id: client_id, _secret: client_secret })
      .single();

    if (verifyError || !verified?.app_id) {
      return new Response(
        JSON.stringify({ error: "invalid_client", message: "Invalid client credentials" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const app = { id: verified.app_id, name: verified.app_name };

    // Look up and validate the authorization code
    const { data: authCode, error: codeError } = await supabaseAdmin
      .from("oauth_codes")
      .select("*")
      .eq("code", code)
      .eq("app_id", app.id)
      .single();

    if (codeError || !authCode) {
      return new Response(
        JSON.stringify({ error: "invalid_grant", message: "Invalid or unknown authorization code" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if code was already used
    if (authCode.used) {
      return new Response(
        JSON.stringify({ error: "invalid_grant", message: "Authorization code has already been used" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if code has expired
    if (new Date(authCode.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "invalid_grant", message: "Authorization code has expired" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check redirect_uri matches
    if (authCode.redirect_uri !== redirect_uri) {
      return new Response(
        JSON.stringify({ error: "invalid_grant", message: "redirect_uri does not match" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark code as used
    await supabaseAdmin
      .from("oauth_codes")
      .update({ used: true })
      .eq("id", authCode.id);

    // Generate access token
    const { data: tokenData, error: tokenError } = await supabaseAdmin
      .from("oauth_tokens")
      .insert({
        app_id: app.id,
        user_id: authCode.user_id,
        scopes: authCode.scopes,
      })
      .select("access_token, expires_at, scopes")
      .single();

    if (tokenError) {
      console.error("Error creating token:", tokenError);
      return new Response(
        JSON.stringify({ error: "server_error", message: "Failed to generate access token" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch user profile
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("user_id, full_name, avatar_url, role, bio, professional_skills, location")
      .eq("user_id", authCode.user_id)
      .single();

    console.log(`[SSO] Token issued for user ${authCode.user_id} -> app ${app.name}`);

    return new Response(
      JSON.stringify({
        access_token: tokenData.access_token,
        token_type: "Bearer",
        expires_in: 2592000, // 30 days in seconds
        expires_at: tokenData.expires_at,
        scope: tokenData.scopes.join(" "),
        user: profile
          ? {
              id: profile.user_id,
              name: profile.full_name,
              avatar_url: profile.avatar_url,
              role: profile.role,
              bio: profile.bio,
              skills: profile.professional_skills,
              location: profile.location,
            }
          : { id: authCode.user_id },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[SSO Token] Error:", error);
    return new Response(
      JSON.stringify({ error: "server_error", message: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
