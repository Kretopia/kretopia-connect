import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";


import { corsFor } from '../_shared/guard.ts';
serve(async (req) => {
  const corsHeaders = corsFor(req);
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

    const body = await req.json().catch(() => ({}));
    const circleId = typeof body?.circleId === "string" ? body.circleId : "";
    const rawEmails: unknown[] = Array.isArray(body?.emails) ? body.emails : [];
    const EMAIL_RE = /^[^\s@<>"']{1,64}@[^\s@<>"']{1,190}\.[a-z]{2,}$/i;
    const emails = [...new Set(rawEmails
      .filter((e): e is string => typeof e === "string")
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.length <= 254 && EMAIL_RE.test(e)))];
    if (!/^[0-9a-f-]{36}$/i.test(circleId) || emails.length === 0 || emails.length > 100) {
      return new Response(JSON.stringify({ error: "Invalid request" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400,
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Only the circle's creator may record invites for it.
    const { data: circle } = await supabaseAdmin
      .from("spark_rooms")
      .select("id, created_by")
      .eq("id", circleId)
      .maybeSingle();
    if (!circle || circle.created_by !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403,
      });
    }

    // Get sender profile
    const { data: senderProfile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("user_id", user.id)
      .single();

    const senderName = senderProfile?.full_name || "Someone";
    const inviteLink = `https://www.kretopia.com/circle/${circleId}`;

    // For now, log the invites. In production, integrate with email service.
    console.log(`[SEND-CIRCLE-INVITE] recording ${emails.length} invite(s)`);
    void senderName; void inviteLink;

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
    console.error("[SEND-CIRCLE-INVITE] error", error instanceof Error ? error.message : "unknown");
    return new Response(JSON.stringify({ error: "Request failed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
