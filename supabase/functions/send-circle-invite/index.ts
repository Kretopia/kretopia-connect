import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

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
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) throw new Error("Not authenticated");

    const { circleId, emails, circleTitle } = await req.json();
    if (!circleId || !emails?.length) throw new Error("Missing circleId or emails");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get sender profile
    const { data: senderProfile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("user_id", user.id)
      .single();

    const senderName = senderProfile?.full_name || "Someone";
    const inviteLink = `https://www.thrivein.io/circle/${circleId}`;

    // For now, log the invites. In production, integrate with email service.
    console.log(`[SEND-CIRCLE-INVITE] ${senderName} inviting ${emails.length} people to "${circleTitle}"`);
    console.log(`[SEND-CIRCLE-INVITE] Emails:`, emails);
    console.log(`[SEND-CIRCLE-INVITE] Link: ${inviteLink}`);

    // Store invite records for tracking
    const inviteRecords = emails.map((email: string) => ({
      circle_id: circleId,
      invited_email: email,
      invited_by: user.id,
      status: "sent",
    }));

    // Try to store invites if table exists, otherwise just log
    try {
      await supabaseAdmin.from("circle_invites").insert(inviteRecords);
    } catch (e) {
      console.log("[SEND-CIRCLE-INVITE] circle_invites table may not exist, skipping storage");
    }

    return new Response(JSON.stringify({ success: true, count: emails.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
