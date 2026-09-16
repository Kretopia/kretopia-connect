import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const APP_URL = "https://www.thrivein.io";

function pad(n: number) { return String(n).padStart(2, "0"); }
function toBasicUTC(iso: string) {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}
function googleCal(s: { title: string; starts_at: string; duration_min: number; theme: string | null; id: string }) {
  const end = new Date(new Date(s.starts_at).getTime() + s.duration_min * 60_000).toISOString();
  const u = new URLSearchParams({
    action: "TEMPLATE",
    text: s.title,
    dates: `${toBasicUTC(s.starts_at)}/${toBasicUTC(end)}`,
    details: [s.theme, "Speed networking for creators on ThriveIN.", `${APP_URL}/circle/speed/${s.id}`].filter(Boolean).join("\n\n"),
    location: `${APP_URL}/circle/speed/${s.id}`,
  });
  return `https://calendar.google.com/calendar/render?${u.toString()}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const t = authHeader.replace("Bearer ", "");
    const { data: claims } = await supabase.auth.getClaims(t);
    if (!claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub as string;
    const { session_id, action } = await req.json();
    if (!session_id) throw new Error("session_id required");

    if (action === "cancel") {
      await supabase.from("speed_session_rsvps")
        .delete().eq("session_id", session_id).eq("user_id", userId);
      return new Response(JSON.stringify({ ok: true, status: "canceled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    const { error } = await supabase
      .from("speed_session_rsvps")
      .upsert({ session_id, user_id: userId, status: "rsvp" }, { onConflict: "session_id,user_id" });
    if (error) throw error;

    // Fire-and-forget confirmation email
    try {
      const { data: sess } = await admin
        .from("speed_sessions")
        .select("id, title, starts_at, slot_seconds, mode, duration_min, theme")
        .eq("id", session_id).maybeSingle();
      // NOTE: `profiles` has no `email` column — resolve it from auth.users.
      const { data: prof } = await admin
        .from("profiles").select("full_name").eq("user_id", userId).maybeSingle();
      let rsvpEmail: string | null = null;
      try {
        const { data: u } = await admin.auth.admin.getUserById(userId);
        rsvpEmail = u?.user?.email ?? null;
      } catch (e) { console.error("[rsvp] getUserById", userId, e); }
      if (sess && rsvpEmail) {
        const startsAt = new Date(sess.starts_at);
        const startsWhen = startsAt.toLocaleString("en-US", {
          weekday: "long", month: "short", day: "numeric",
          hour: "numeric", minute: "2-digit", timeZoneName: "short",
        });
        await admin.functions.invoke("send-transactional-email", {
          body: {
            templateName: "speed-session-rsvp-confirmed",
            recipientEmail: rsvpEmail,
            idempotencyKey: `ss-rsvp-${session_id}-${userId}`,
            templateData: {
              attendeeName: prof.full_name,
              sessionTitle: sess.title,
              startsWhen,
              durationMin: sess.duration_min,
              slotMinutes: Math.round((sess.slot_seconds ?? 300) / 60),
              mode: sess.mode,
              theme: sess.theme,
              sessionUrl: `${APP_URL}/circle/speed/${session_id}`,
              googleCalendarUrl: googleCal(sess as any),
            },
          },
        });
      }
    } catch (e) { console.error("[rsvp-speed-session] confirm email", e); }

    return new Response(JSON.stringify({ ok: true, status: "rsvp" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
    });
  } catch (e) {
    console.error("[rsvp-speed-session]", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
