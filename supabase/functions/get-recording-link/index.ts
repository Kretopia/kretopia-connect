// Mint a short-lived Daily access link for a call recording.
// Anyone listed as host or participant on the transcript can fetch it.
// Daily's access links expire in ~120s, so we always fetch fresh.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DAILY_API = "https://api.daily.co/v1";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const DAILY_API_KEY = Deno.env.get("DAILY_API_KEY");
    if (!DAILY_API_KEY) throw new Error("DAILY_API_KEY not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const t = authHeader.replace("Bearer ", "");
    const { data: claims } = await supabase.auth.getClaims(t);
    if (!claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub as string;

    const { transcript_id } = await req.json();
    if (!transcript_id) throw new Error("transcript_id required");

    // Load transcript + authorize.
    const { data: row, error } = await admin
      .from("call_transcripts")
      .select(
        "id, recording_id, created_by, call_kind, call_id, project_id, participants",
      )
      .eq("id", transcript_id)
      .maybeSingle();
    if (error) throw error;
    if (!row) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!row.recording_id) {
      return new Response(JSON.stringify({ error: "No recording for this call" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authorization: creator, listed participant, or (for project calls) any project member.
    let allowed = row.created_by === userId;
    if (!allowed && Array.isArray(row.participants)) {
      allowed = (row.participants as any[]).some(
        (p) => p?.user_id === userId,
      );
    }
    if (!allowed && row.project_id) {
      const { data: member } = await admin
        .from("project_members")
        .select("user_id")
        .eq("project_id", row.project_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (member) allowed = true;
    }
    if (!allowed && row.call_kind === "direct") {
      const { data: dc } = await admin
        .from("direct_video_calls")
        .select("started_by, invited_user_id")
        .eq("id", row.call_id)
        .maybeSingle();
      if (dc && (dc.started_by === userId || dc.invited_user_id === userId)) {
        allowed = true;
      }
    }
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const linkRes = await fetch(
      `${DAILY_API}/recordings/${row.recording_id}/access-link?valid_for_secs=3600`,
      { headers: { Authorization: `Bearer ${DAILY_API_KEY}` } },
    );
    if (!linkRes.ok) {
      const body = await linkRes.text();
      console.error("[get-recording-link] Daily error", linkRes.status, body);
      return new Response(
        JSON.stringify({ error: "Daily access-link failed", status: linkRes.status, details: body }),
        { status: linkRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const { download_link, expires } = await linkRes.json();

    // Cache the freshest URL on the row for convenience (still expires!).
    await admin
      .from("call_transcripts")
      .update({ recording_url: download_link })
      .eq("id", transcript_id);

    return new Response(
      JSON.stringify({ download_link, expires }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[get-recording-link]", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
