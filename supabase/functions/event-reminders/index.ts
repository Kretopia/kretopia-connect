// Cron-driven event reminder + post-event rewards dispatcher.
// Runs every 15 minutes. Idempotent via event_reminders_sent.
//
// For each upcoming event, sends:
//   - reminder_24h (email + in-app push) 24h before start_time
//   - reminder_1h  (in-app push only)     1h before start_time
//
// For each just-ended event (>= 2h after end_time), runs once:
//   - Awards an "Event Host" ThriveCredit to the host
//   - Awards promoter rewards (1 credit per checked-in referral) to promoters
//   - Sends recap_2h_after in-app notification to attendees with a "connect" deep link

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireAdminOrCron, adminGuardCorsHeaders } from "../_shared/admin-guard.ts";

const corsHeaders = adminGuardCorsHeaders;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface Event {
  id: string;
  title: string;
  start_time: string;
  end_time: string | null;
  venue_name: string | null;
  venue_address: string | null;
  created_by: string;
  category: string;
}

const APP_URL = "https://www.thrivein.io";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const guard = await requireAdminOrCron(req);
  if (!guard.ok) return guard.response;

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const stats = { events_24h: 0, events_1h: 0, events_recap: 0, sends: 0, credits_awarded: 0, errors: 0 };
  const now = new Date();

  // ---------- 24h reminder window: 23h45m to 24h15m from now ----------
  const win24Lo = new Date(now.getTime() + (24 * 60 - 15) * 60 * 1000).toISOString();
  const win24Hi = new Date(now.getTime() + (24 * 60 + 15) * 60 * 1000).toISOString();

  const { data: events24 } = await admin
    .from("creative_jams")
    .select("id, title, start_time, end_time, venue_name, venue_address, created_by, category")
    .eq("status", "upcoming")
    .gte("start_time", win24Lo)
    .lte("start_time", win24Hi);

  for (const ev of (events24 || []) as Event[]) {
    stats.events_24h++;
    await sendReminder(admin, ev, "reminder_24h", stats);
  }

  // ---------- 1h reminder window: 45min to 75min from now ----------
  const win1Lo = new Date(now.getTime() + 45 * 60 * 1000).toISOString();
  const win1Hi = new Date(now.getTime() + 75 * 60 * 1000).toISOString();

  const { data: events1 } = await admin
    .from("creative_jams")
    .select("id, title, start_time, end_time, venue_name, venue_address, created_by, category")
    .eq("status", "upcoming")
    .gte("start_time", win1Lo)
    .lte("start_time", win1Hi);

  for (const ev of (events1 || []) as Event[]) {
    stats.events_1h++;
    await sendReminder(admin, ev, "reminder_1h", stats);
  }

  // ---------- Recap + credits: events that ended 1h45m to 2h15m ago ----------
  const recapHi = new Date(now.getTime() - 105 * 60 * 1000).toISOString();
  const recapLo = new Date(now.getTime() - 135 * 60 * 1000).toISOString();

  const { data: eventsRecap } = await admin
    .from("creative_jams")
    .select("id, title, start_time, end_time, venue_name, venue_address, created_by, category")
    .lte("end_time", recapHi)
    .gte("end_time", recapLo);

  for (const ev of (eventsRecap || []) as Event[]) {
    stats.events_recap++;
    await runPostEvent(admin, ev, stats);
  }

  // ---------- 48h reconnect nudge: events that ended 47h45m to 48h15m ago ----------
  const r48Hi = new Date(now.getTime() - (48 * 60 - 15) * 60 * 1000).toISOString();
  const r48Lo = new Date(now.getTime() - (48 * 60 + 15) * 60 * 1000).toISOString();

  const { data: events48 } = await admin
    .from("creative_jams")
    .select("id, title, start_time, end_time, venue_name, venue_address, created_by, category")
    .lte("end_time", r48Hi)
    .gte("end_time", r48Lo);

  for (const ev of (events48 || []) as Event[]) {
    await sendReconnectNudge(admin, ev, stats);
  }

  return new Response(JSON.stringify({ ok: true, stats }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

async function sendReminder(
  admin: ReturnType<typeof createClient>,
  ev: Event,
  type: "reminder_24h" | "reminder_1h",
  stats: { sends: number; errors: number }
) {
  // Get RSVP'd guests
  const { data: participants } = await admin
    .from("jam_participants")
    .select("user_id, check_in_token")
    .eq("jam_id", ev.id)
    .eq("status", "going");

  if (!participants || participants.length === 0) return;

  // Find which guests have NOT been sent this reminder
  const { data: alreadySent } = await admin
    .from("event_reminders_sent")
    .select("user_id, channel")
    .eq("event_id", ev.id)
    .eq("reminder_type", type);

  const sentEmail = new Set((alreadySent || []).filter((r: any) => r.channel === "email").map((r: any) => r.user_id));
  const sentPush = new Set((alreadySent || []).filter((r: any) => r.channel === "in_app").map((r: any) => r.user_id));

  const typedParticipants = participants as { user_id: string; check_in_token: string | null }[];

  // Batch the name lookup -- one query for every participant instead of one
  // per participant. (auth.admin.getUserById below has no bulk equivalent in
  // the standard admin API, so that part of the original N+1 stays
  // per-participant -- but it, and the email/notification sends, now run
  // concurrently in bounded batches instead of one participant's full
  // round-trip finishing before the next starts, so wall-clock time no
  // longer stacks linearly with participant count.)
  const { data: profiles } = await admin
    .from("profiles")
    .select("user_id, full_name, first_name")
    .in("user_id", typedParticipants.map((p) => p.user_id));
  const profileMap = new Map((profiles || []).map((pr: any) => [pr.user_id, pr]));

  const startDate = new Date(ev.start_time);

  const sendOne = async (p: { user_id: string; check_in_token: string | null }) => {
    const profile = profileMap.get(p.user_id) || { full_name: null, first_name: null };
    let guestEmail: string | null = null;
    try {
      const { data: u } = await admin.auth.admin.getUserById(p.user_id);
      guestEmail = u?.user?.email ?? null;
    } catch (e) { console.error("[event-reminders] getUserById", p.user_id, e); }

    // --- Email (only on 24h reminder) ---
    if (type === "reminder_24h" && guestEmail && !sentEmail.has(p.user_id)) {
      try {
        await admin.functions.invoke("send-transactional-email", {
          body: {
            templateName: "event-reminder",
            recipientEmail: guestEmail,
            idempotencyKey: `event-${ev.id}-${p.user_id}-${type}`,
            templateData: {
              attendeeName: profile.first_name || profile.full_name || "there",
              eventTitle: ev.title,
              eventDate: startDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }),
              eventTime: startDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
              eventVenue: ev.venue_name || "TBA",
              eventAddress: ev.venue_address || "",
              checkInToken: p.check_in_token,
              eventUrl: `${APP_URL}/event/${ev.id}`,
            },
          },
        });
        await admin.from("event_reminders_sent").insert({
          event_id: ev.id, user_id: p.user_id, reminder_type: type, channel: "email",
        });
        stats.sends++;
      } catch (e) {
        console.error("email reminder failed", ev.id, p.user_id, e);
        stats.errors++;
      }
    }

    // --- In-app notification (push) for both 24h and 1h ---
    if (!sentPush.has(p.user_id)) {
      const title = type === "reminder_24h"
        ? `Tomorrow: ${ev.title}`
        : `Heading out? ${ev.title} starts soon`;
      const body = type === "reminder_24h"
        ? `${ev.venue_name ? `at ${ev.venue_name} · ` : ""}${startDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}. Show your pass at the door.`
        : `Show your pass at the door. Tap to view directions.`;

      try {
        await admin.from("notifications").insert({
          user_id: p.user_id,
          type: "event_reminder",
          title,
          body,
          action_url: `/event/${ev.id}`,
          metadata: { event_id: ev.id, reminder_type: type },
        });
        await admin.from("event_reminders_sent").insert({
          event_id: ev.id, user_id: p.user_id, reminder_type: type, channel: "in_app",
        });
        stats.sends++;
      } catch (e) {
        console.error("notification failed", ev.id, p.user_id, e);
        stats.errors++;
      }
    }
  };

  // Bounded concurrency -- full parallelism for a typical event (well under
  // 25 attendees), capped so an unusually large event can't fire hundreds of
  // simultaneous admin-API/email calls at once.
  const CONCURRENCY = 25;
  for (let i = 0; i < typedParticipants.length; i += CONCURRENCY) {
    await Promise.all(typedParticipants.slice(i, i + CONCURRENCY).map(sendOne));
  }
}

async function runPostEvent(
  admin: ReturnType<typeof createClient>,
  ev: Event,
  stats: { sends: number; errors: number; credits_awarded: number }
) {
  // 1) Auto-issue Event Host ThriveCredit (idempotent on source_id)
  const { data: existingCredit } = await admin
    .from("credits")
    .select("id")
    .eq("user_id", ev.created_by)
    .eq("source", "event_host")
    .eq("source_id", ev.id)
    .maybeSingle();

  if (!existingCredit) {
    const { count: attendeeCount } = await admin
      .from("jam_participants")
      .select("id", { count: "exact", head: true })
      .eq("jam_id", ev.id)
      .eq("status", "going");

    try {
      await admin.from("credits").insert({
        user_id: ev.created_by,
        project_name: ev.title,
        role: "Event Host",
        year: new Date(ev.start_time).getFullYear(),
        platform: "ThriveIN",
        url: `${APP_URL}/event/${ev.id}`,
        verification_status: "verified",
        credit_category: "events",
        project_type: "event",
        start_date: ev.start_time.split("T")[0],
        end_date: (ev.end_time || ev.start_time).split("T")[0],
        location: ev.venue_name,
        source: "event_host",
        source_id: ev.id,
        description: `Hosted ${ev.title}${attendeeCount ? ` for ${attendeeCount} attendees` : ""}.`,
      });
      stats.credits_awarded++;
    } catch (e) {
      console.error("host credit failed", ev.id, e);
      stats.errors++;
    }
  }

  // 2) Promoter rewards: for every checked-in participant referred by another user
  const { data: referredAttendees } = await admin
    .from("jam_participants")
    .select("user_id, referred_by")
    .eq("jam_id", ev.id)
    .not("referred_by", "is", null)
    .not("checked_in_at", "is", null);

  for (const att of (referredAttendees || []) as { user_id: string; referred_by: string }[]) {
    if (!att.referred_by || att.referred_by === ev.created_by) continue;

    // Upsert promoter reward (1 credit per check-in)
    const { data: existing } = await admin
      .from("event_promoter_rewards")
      .select("id, credits_awarded")
      .eq("event_id", ev.id)
      .eq("referred_user_id", att.user_id)
      .maybeSingle();

    if (existing && existing.credits_awarded > 0) continue;

    try {
      await admin.from("event_promoter_rewards").upsert({
        event_id: ev.id,
        promoter_user_id: att.referred_by,
        referred_user_id: att.user_id,
        checked_in: true,
        credits_awarded: 1,
        awarded_at: new Date().toISOString(),
      }, { onConflict: "event_id,referred_user_id" });

      // Notify promoter
      await admin.from("notifications").insert({
        user_id: att.referred_by,
        type: "promoter_reward",
        title: `+1 credit · You brought a guest to ${ev.title}`,
        body: `Thanks for spreading the word. Your guest checked in.`,
        action_url: `/event/${ev.id}`,
        metadata: { event_id: ev.id },
      });
      stats.credits_awarded++;
    } catch (e) {
      console.error("promoter reward failed", ev.id, att.user_id, e);
      stats.errors++;
    }
  }

  // 3) Recap notification to attendees (idempotent via event_reminders_sent)
  const { data: attendees } = await admin
    .from("jam_participants")
    .select("user_id")
    .eq("jam_id", ev.id)
    .eq("status", "going");

  const { data: alreadyRecap } = await admin
    .from("event_reminders_sent")
    .select("user_id")
    .eq("event_id", ev.id)
    .eq("reminder_type", "recap_2h_after");

  const recapped = new Set((alreadyRecap || []).map((r: any) => r.user_id));

  for (const a of (attendees || []) as { user_id: string }[]) {
    if (recapped.has(a.user_id)) continue;
    try {
      await admin.from("notifications").insert({
        user_id: a.user_id,
        type: "event_recap",
        title: `Met someone good at ${ev.title}?`,
        body: `Tap to see who else was there and connect.`,
        action_url: `/event/${ev.id}`,
        metadata: { event_id: ev.id },
      });
      await admin.from("event_reminders_sent").insert({
        event_id: ev.id, user_id: a.user_id, reminder_type: "recap_2h_after", channel: "in_app",
      });
      stats.sends++;
    } catch (e) {
      console.error("recap notify failed", ev.id, a.user_id, e);
      stats.errors++;
    }
  }
}

async function sendReconnectNudge(
  admin: ReturnType<typeof createClient>,
  ev: Event,
  stats: { sends: number; errors: number }
) {
  const { data: attendees } = await admin
    .from("jam_participants")
    .select("user_id")
    .eq("jam_id", ev.id)
    .not("checked_in_at", "is", null);

  const { data: alreadySent } = await admin
    .from("event_reminders_sent")
    .select("user_id")
    .eq("event_id", ev.id)
    .eq("reminder_type", "reconnect_48h");
  const sent = new Set((alreadySent || []).map((r: any) => r.user_id));

  for (const a of (attendees || []) as { user_id: string }[]) {
    if (sent.has(a.user_id)) continue;
    try {
      await admin.from("notifications").insert({
        user_id: a.user_id,
        type: "event_reconnect",
        title: `Met someone at ${ev.title}?`,
        body: `Don't lose the connection — say hi while it's fresh.`,
        action_url: `/event/${ev.id}`,
        metadata: { event_id: ev.id },
      });
      await admin.from("event_reminders_sent").insert({
        event_id: ev.id, user_id: a.user_id, reminder_type: "reconnect_48h", channel: "in_app",
      });
      stats.sends++;
    } catch (e) {
      console.error("reconnect nudge failed", ev.id, a.user_id, e);
      stats.errors++;
    }
  }
}
