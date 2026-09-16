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

  try {
    const url = new URL(req.url);
    const clientId = url.searchParams.get("client_id");
    const redirectUri = url.searchParams.get("redirect_uri");
    const responseType = url.searchParams.get("response_type") || "code";
    const scope = url.searchParams.get("scope") || "profile";
    const state = url.searchParams.get("state") || "";

    // Validate required params
    if (!clientId || !redirectUri) {
      return new Response(
        JSON.stringify({ error: "missing_params", message: "client_id and redirect_uri are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (responseType !== "code") {
      return new Response(
        JSON.stringify({ error: "unsupported_response_type", message: "Only 'code' response type is supported" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create service role client to look up the app
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify the OAuth app exists and is active
    const { data: app, error: appError } = await supabaseAdmin
      .from("oauth_apps")
      .select("id, name, redirect_uris, is_active")
      .eq("client_id", clientId)
      .single();

    if (appError || !app || !app.is_active) {
      return new Response(
        JSON.stringify({ error: "invalid_client", message: "Unknown or inactive client_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify redirect_uri is registered
    if (!app.redirect_uris.includes(redirectUri)) {
      return new Response(
        JSON.stringify({ error: "invalid_redirect_uri", message: "redirect_uri is not registered for this app" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      // Not logged in — return a JSON response telling the client to redirect to ThriveIN login
      const loginUrl = `${Deno.env.get("SUPABASE_URL")?.replace('.supabase.co', '')}/auth?redirect=${encodeURIComponent(req.url)}`;
      return new Response(
        JSON.stringify({
          error: "login_required",
          message: "User must be authenticated. Redirect them to ThriveIN login first.",
          login_url: loginUrl,
          app_name: app.name,
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the user's token
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: authUser }, error: userError } = await supabaseUser.auth.getUser(token);

    if (userError || !authUser) {
      return new Response(
        JSON.stringify({ error: "invalid_token", message: "Invalid or expired authentication token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = authUser.id;
    const scopes = scope.split(",").map((s: string) => s.trim());

    // Generate authorization code
    const { data: codeData, error: codeError } = await supabaseAdmin
      .from("oauth_codes")
      .insert({
        app_id: app.id,
        user_id: userId,
        redirect_uri: redirectUri,
        scopes: scopes,
      })
      .select("code")
      .single();

    if (codeError) {
      console.error("Error creating auth code:", codeError);
      return new Response(
        JSON.stringify({ error: "server_error", message: "Failed to generate authorization code" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Return the redirect URL with the code
    const redirectUrl = new URL(redirectUri);
    redirectUrl.searchParams.set("code", codeData.code);
    if (state) redirectUrl.searchParams.set("state", state);

    console.log(`[SSO] Authorization code generated for user ${userId} -> app ${app.name}`);

    return new Response(
      JSON.stringify({
        redirect_url: redirectUrl.toString(),
        code: codeData.code,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[SSO Authorize] Error:", error);
    return new Response(
      JSON.stringify({ error: "server_error", message: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
