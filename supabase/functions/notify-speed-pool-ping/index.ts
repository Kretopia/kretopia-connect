// Host-only: ping everyone who RSVP'd but hasn't joined the pool yet.
// Body: { session_id: string }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { session_id } = await req.json();
    if (!session_id) {
      return new Response(JSON.stringify({ error: "bad_request" }), { status: 400, headers: cors });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get("Authorization") ?? "";
    const { data: userData } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    const callerId = userData?.user?.id;
    if (!callerId) {
      return new Response(JSON.stringify({ error: "unauth" }), { status: 401, headers: cors });
    }

    const { data: session } = await supabase
      .from("speed_sessions")
      .select("id, title, host_user_id, starts_at")
      .eq("id", session_id)
      .maybeSingle();
    if (!session) {
      return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers: cors });
    }

    const { data: roleRow } = await supabase
      .from("user_roles").select("role").eq("user_id", callerId).eq("role", "admin").maybeSingle();
    if (session.host_user_id !== callerId && !roleRow) {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: cors });
    }

    // RSVP'd but not yet joined (status != 'joined')
    const { data: rsvps } = await supabase
      .from("speed_session_rsvps")
      .select("user_id, status")
      .eq("session_id", session_id);
    const targets = (rsvps ?? [])
      .filter((r) => r.status !== "joined" && r.user_id !== callerId)
      .map((r) => r.user_id);

    if (!targets.length) {
      return new Response(JSON.stringify({ ok: true, notified: 0 }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const rows = targets.map((uid) => ({
      user_id: uid,
      type: "speed_session_ping",
      title: `🔔 ${session.title} is starting`,
      message: "The host is on the stage waiting. Hop in now and we'll match you in seconds.",
      action_url: `/circle/speed/${session_id}`,
      action_text: "Join the room",
      category: "events",
      priority: "high",
    }));
    const { error: insErr } = await supabase.from("notifications").insert(rows);
    if (insErr) throw insErr;

    return new Response(JSON.stringify({ ok: true, notified: rows.length }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), {
      status: 500, headers: cors,
    });
  }
});
