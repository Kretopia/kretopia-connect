import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface UnsubscribeRequest {
  token: string;
  action: "get" | "update";
  preferences?: {
    email_matches?: boolean;
    email_messages?: boolean;
    email_projects?: boolean;
  };
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { token, action, preferences }: UnsubscribeRequest = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: "Token is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find user by unsubscribe token
    const { data: prefRecord, error: fetchError } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("unsubscribe_token", token)
      .single();

    if (fetchError || !prefRecord) {
      console.error("Token lookup error:", fetchError);
      return new Response(
        JSON.stringify({ success: false, error: "Invalid or expired unsubscribe token" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "get") {
      // Return current preferences
      return new Response(
        JSON.stringify({
          success: true,
          preferences: {
            email_matches: prefRecord.email_matches,
            email_messages: prefRecord.email_messages,
            email_projects: prefRecord.email_projects,
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "update" && preferences) {
      // Update preferences
      const { error: updateError } = await supabase
        .from("notification_preferences")
        .update({
          email_matches: preferences.email_matches ?? prefRecord.email_matches,
          email_messages: preferences.email_messages ?? prefRecord.email_messages,
          email_projects: preferences.email_projects ?? prefRecord.email_projects,
          updated_at: new Date().toISOString(),
        })
        .eq("unsubscribe_token", token);

      if (updateError) {
        console.error("Update error:", updateError);
        return new Response(
          JSON.stringify({ success: false, error: "Failed to update preferences" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Updated email preferences for user ${prefRecord.user_id}`);

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unsubscribe handler error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
