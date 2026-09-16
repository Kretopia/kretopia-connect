// Speed Session reminder dispatcher — fires THREE windows:
//   T-24h (next day),  T-1h,  T-10m.
// Each window is idempotent via speed_sessions.reminders_sent jsonb flags.
// Sends a branded transactional email + in-app notification.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = "https://www.thrivein.io";

type Window = { key: "tomorrow" | "in_one_hour" | "starting_soon"; loMin: number; hiMin: number };
const WINDOWS: Window[] = [
  { key: "tomorrow",       loMin: 23 * 60 + 30, hiMin: 24 * 60 + 30 },
  { key: "in_one_hour",    loMin: 50,           hiMin: 70 },
  { key: "starting_soon",  loMin: 8,            hiMin: 12 },
];

function startsWhenText(starts: Date, key: Window["key"]): string {
  const opts: Intl.DateTimeFormatOptions = { weekday: "long", hour: "numeric", minute: "2-digit", timeZoneName: "short" };
  if (key === "tomorrow") return `Tomorrow at ${starts.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZoneName: "short" })}`;
  if (key === "in_one_hour") return `In 1 hour — ${starts.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  return `Starting in ~10 min`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const stats = { windows: 0, sessions: 0, emails: 0, pushes: 0, errors: 0 };
  const now = Date.now();

  try {
  for (const w of WINDOWS) {
    stats.windows++;
    const lo = new Date(now + w.loMin * 60_000).toISOString();
    const hi = new Date(now + w.hiMin * 60_000).toISOString();

    const { data: sessions, error } = await admin
      .from("speed_sessions")
      .select("id, title, starts_at, slot_seconds, mode, duration_min, theme, fallback_mode, reminders_sent")
      .eq("status", "scheduled")
      .gte("starts_at", lo)
      .lte("starts_at", hi);
    if (error) { stats.errors++; console.error("[reminders] fetch", w.key, error); continue; }

    for (const s of sessions ?? []) {
      const sent = (s.reminders_sent ?? {}) as Record<string, string>;
      if (sent[w.key]) continue;
      stats.sessions++;

      // NOTE: speed_session_rsvps has no FK to profiles, and profiles has no
      // `email` column — so a PostgREST embed here 500s the whole job.
      // Fetch RSVPs, then resolve names from profiles and emails from auth.
      const { data: rsvps, error: rErr } = await admin
        .from("speed_session_rsvps")
        .select("user_id")
        .eq("session_id", s.id);
      if (rErr) { stats.errors++; console.error("[reminders] rsvps", rErr); continue; }

      const userIds = (rsvps ?? []).map((r: any) => r.user_id).filter(Boolean);
      const nameById = new Map<string, string | null>();
      if (userIds.length > 0) {
        const { data: profs } = await admin
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", userIds);
        for (const p of profs ?? []) nameById.set(p.user_id, p.full_name);
      }

      const link = `${APP_URL}/circle/speed/${s.id}`;
      const rsvpCount = rsvps?.length ?? 0;
      const startsAt = new Date(s.starts_at);
      const startsWhen = startsWhenText(startsAt, w.key);
      const isGroupMode = s.fallback_mode === "group";

      // In-app notifications
      const notifRows = (rsvps ?? []).map((r: any) => ({
        user_id: r.user_id,
        type: "speed_session_reminder",
        title: w.key === "starting_soon" ? "Starts in 10 min" :
               w.key === "in_one_hour" ? "Starts in 1 hour" : "Tomorrow's Speed Session",
        message: `"${s.title}" — ${startsWhen}. ${isGroupMode ? "Open group call format tonight." : "Tap to open the room."}`,
        link, action_url: link, action_text: "Open session",
        priority: w.key === "starting_soon" ? "high" : "normal",
        category: "session",
      }));
      if (notifRows.length > 0) {
        const { error: nErr } = await admin.from("notifications").insert(notifRows);
        if (nErr) { stats.errors++; console.error("[reminders] notify", nErr); }
        else stats.pushes += notifRows.length;
      }

      // Branded emails
      for (const r of rsvps ?? []) {
        const uid = (r as any).user_id as string;
        let email: string | null = null;
        try {
          const { data: u } = await admin.auth.admin.getUserById(uid);
          email = u?.user?.email ?? null;
        } catch (e) { console.error("[reminders] getUserById", uid, e); }
        const name = nameById.get(uid) ?? null;
        if (!email) continue;

        try {
          await admin.functions.invoke("send-transactional-email", {
            body: {
              templateName: "speed-session-reminder",
              recipientEmail: email,
              idempotencyKey: `ss-rem-${s.id}-${w.key}-${(r as any).user_id}`,
              templateData: {
                attendeeName: name,
                sessionTitle: s.title,
                startsWhen,
                whenLabel: w.key,
                durationMin: s.duration_min,
                slotMinutes: Math.round((s.slot_seconds ?? 300) / 60),
                mode: s.mode,
                theme: s.theme,
                sessionUrl: link,
                rsvpCount,
                isGroupMode,
              },
            },
          });
          stats.emails++;
        } catch (e) { stats.errors++; console.error("[reminders] email", e); }
      }

      await admin
        .from("speed_sessions")
        .update({
          reminders_sent: { ...sent, [w.key]: new Date().toISOString() },
          // Keep legacy reminder_sent_at populated on starting_soon for back-compat
          reminder_sent_at: w.key === "starting_soon" ? new Date().toISOString() : (s as any).reminder_sent_at,
        })
        .eq("id", s.id);
    }
  }

  } catch (e) {
    console.error("[reminders] fatal", e);
    return new Response(JSON.stringify({ ok: false, error: String(e), ...stats }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, ...stats }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
