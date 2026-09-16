// At T-30, if RSVPs < 5, switch session to GROUP MODE (open Zoom-style room)
// instead of canceling. Notify all RSVPs.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = "https://www.thrivein.io";
const MIN_FOR_PAIRS = 5;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const stats = { checked: 0, fellback: 0, notified: 0, errors: 0 };

  const now = new Date();
  const lo = new Date(now.getTime() + 25 * 60_000).toISOString();
  const hi = new Date(now.getTime() + 35 * 60_000).toISOString();

  const { data: sessions, error } = await admin
    .from("speed_sessions")
    .select("id, title, starts_at, fallback_mode, host_user_id")
    .eq("status", "scheduled")
    .eq("fallback_mode", "pair")
    .is("canceled_reason", null)
    .gte("starts_at", lo)
    .lte("starts_at", hi);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  for (const s of sessions ?? []) {
    stats.checked++;
    try {
      const { count } = await admin
        .from("speed_session_rsvps")
        .select("user_id", { count: "exact", head: true })
        .eq("session_id", s.id);
      if ((count ?? 0) >= MIN_FOR_PAIRS) continue;

      await admin
        .from("speed_sessions")
        .update({ fallback_mode: "group" })
        .eq("id", s.id);
      stats.fellback++;

      const { data: rsvps } = await admin
        .from("speed_session_rsvps").select("user_id").eq("session_id", s.id);
      const link = `${APP_URL}/circle/speed/${s.id}`;
      const rows = (rsvps ?? []).map((r: { user_id: string }) => ({
        user_id: r.user_id,
        type: "speed_session_updated",
        title: "Tonight runs as an open group call",
        message: `"${s.title}" has fewer than 5 RSVPs, so instead of speed pairs we'll all hop into one room together. Same time, same link — you'll still meet everyone.`,
        link, action_url: link, action_text: "Open session",
        priority: "high", category: "session",
      }));
      if (rows.length > 0) {
        const { error: nErr } = await admin.from("notifications").insert(rows);
        if (nErr) { stats.errors++; console.error("[fallback] notify", nErr); }
        else stats.notified += rows.length;
      }
    } catch (e) {
      stats.errors++;
      console.error("[fallback] session", s.id, e);
    }
  }

  return new Response(JSON.stringify({ ok: true, ...stats }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
