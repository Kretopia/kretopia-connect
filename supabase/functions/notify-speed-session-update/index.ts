// Notify all RSVPs about a Speed Session change or cancellation.
// Body: { session_id: string, kind: "updated" | "canceled", changes?: string[], reason?: string }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const { session_id, kind, changes = [], reason } = await req.json();
    if (!session_id || !["updated", "canceled"].includes(kind)) {
      return new Response(JSON.stringify({ error: "bad_request" }), { status: 400, headers: cors });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify caller is host or admin
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabase.auth.getUser(jwt);
    const callerId = userData?.user?.id;
    if (!callerId) return new Response(JSON.stringify({ error: "unauth" }), { status: 401, headers: cors });

    const { data: session } = await supabase
      .from("speed_sessions")
      .select("id, title, host_user_id, starts_at")
      .eq("id", session_id)
      .maybeSingle();
    if (!session) return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers: cors });

    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "admin")
      .maybeSingle();
    const isAdmin = !!roleRow;
    if (session.host_user_id !== callerId && !isAdmin) {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: cors });
    }

    const { data: rsvps } = await supabase
      .from("speed_session_rsvps")
      .select("user_id")
      .eq("session_id", session_id);

    const recipients = (rsvps ?? []).map((r) => r.user_id).filter((id) => id !== session.host_user_id);
    if (recipients.length === 0) {
      return new Response(JSON.stringify({ ok: true, notified: 0 }), { headers: cors });
    }

    const when = new Date(session.starts_at).toLocaleString(undefined, {
      weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    });
    const title = kind === "canceled"
      ? `Speed Session canceled: ${session.title}`
      : `Speed Session updated: ${session.title}`;
    const message = kind === "canceled"
      ? (reason || "The host canceled this session. We'll let you know when the next one is scheduled.")
      : `Heads up — details changed${changes.length ? ` (${changes.join(", ")})` : ""}. New start: ${when}.`;

    const rows = recipients.map((uid) => ({
      user_id: uid,
      type: kind === "canceled" ? "speed_session_canceled" : "speed_session_updated",
      title,
      message,
      action_url: `/circle/speed/${session_id}`,
      action_text: kind === "canceled" ? "See details" : "Review changes",
      category: "events",
      priority: "high",
    }));

    const { error: notifErr } = await supabase.from("notifications").insert(rows);
    if (notifErr) throw notifErr;

    return new Response(JSON.stringify({ ok: true, notified: rows.length }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), {
      status: 500, headers: cors,
    });
  }
});
