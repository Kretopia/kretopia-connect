// Public endpoint — a guest books a slot on a creator's /@handle/book page.
// Validates the slot is inside an active booking window AND not colliding
// with an existing scheduled meeting, then creates a scheduled Daily room.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DAILY_API = "https://api.daily.co/v1";

interface Body {
  handle?: string;
  owner_id?: string;
  start_iso: string; // ISO start time
  duration_minutes?: number;
  guest_name: string;
  guest_email: string;
  brief?: string;
  record_consent?: boolean; // guest agrees to recording + Kreto transcription
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = (await req.json()) as Body;
    const name = (body.guest_name || "").trim().slice(0, 80);
    const email = (body.guest_email || "").trim().slice(0, 200);
    if (!name || !email || !body.start_iso) {
      return json({ error: "Name, email, and slot are required" }, 400);
    }
    const start = new Date(body.start_iso);
    if (isNaN(start.getTime()) || start.getTime() < Date.now() - 60_000) {
      return json({ error: "Pick a future slot" }, 400);
    }
    const dur = Math.min(Math.max(body.duration_minutes ?? 30, 10), 240);
    const end = new Date(start.getTime() + dur * 60_000);

    // Resolve owner
    let ownerId = body.owner_id ?? null;
    if (!ownerId && body.handle) {
      const clean = body.handle.replace(/^@/, "").toLowerCase();
      const { data } = await admin
        .from("public_profiles_safe")
        .select("user_id")
        .ilike("username", clean)
        .maybeSingle();
      ownerId = data?.user_id ?? null;
    }
    if (!ownerId) return json({ error: "Creator not found" }, 404);

    // Owner must have bookings enabled
    const { data: prof } = await admin
      .from("profiles")
      .select("bookings_enabled, full_name")
      .eq("user_id", ownerId)
      .maybeSingle();
    if (!prof?.bookings_enabled) {
      return json({ error: "Bookings are closed for this creator" }, 403);
    }

    // Validate slot lies in an active window for that weekday
    const weekday = start.getUTCDay(); // 0..6 in UTC; client must send slots in UTC
    const startMin = start.getUTCHours() * 60 + start.getUTCMinutes();
    const endMin = startMin + dur;
    const { data: windows } = await admin
      .from("creator_booking_windows")
      .select("start_minute, end_minute, slot_minutes, timezone")
      .eq("user_id", ownerId)
      .eq("weekday", weekday)
      .eq("is_active", true);
    const fits = (windows || []).some(
      (w: any) => startMin >= w.start_minute && endMin <= w.end_minute,
    );
    if (!fits) return json({ error: "Slot is outside availability" }, 409);

    // Collision check vs existing scheduled meetings (±dur window around start)
    const lo = new Date(start.getTime() - dur * 60_000).toISOString();
    const hi = new Date(start.getTime() + dur * 60_000).toISOString();
    const { data: clashes } = await admin
      .from("meetings")
      .select("id, scheduled_for")
      .eq("host_id", ownerId)
      .gte("scheduled_for", lo)
      .lte("scheduled_for", hi);
    if ((clashes || []).length > 0) {
      return json({ error: "Slot just got taken — please pick another" }, 409);
    }

    // Create Daily room
    const DAILY_API_KEY = Deno.env.get("DAILY_API_KEY");
    if (!DAILY_API_KEY) throw new Error("DAILY_API_KEY not configured");
    const exp = Math.floor(end.getTime() / 1000) + 30 * 60;
    const roomName = `book-${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
    const recordConsent = body.record_consent !== false; // default ON
    const roomRes = await fetch(`${DAILY_API}/rooms`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DAILY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: roomName,
        privacy: "private",
        properties: {
          exp,
          max_participants: 6,
          enable_chat: true,
          enable_screenshare: true,
          enable_knocking: true,
          enable_prejoin_ui: false,
          ...(recordConsent
            ? { enable_recording: "cloud", enable_transcription_storage: true }
            : {}),
        },
      }),
    });
    if (!roomRes.ok) throw new Error(`Daily room: ${roomRes.status}`);
    const room = await roomRes.json();

    const title = `${name} ↔ ${prof?.full_name ?? "Creator"} — ${dur}m`;
    const { data: meeting, error: mErr } = await admin
      .from("meetings")
      .insert({
        host_id: ownerId,
        // meetings_source_check only allows: studio | dm | profile | event | adhoc | circle
        source: "profile",

        title,
        room_name: roomName,
        room_url: room.url,
        scheduled_for: start.toISOString(),
        max_participants: 6,
        recording_enabled: recordConsent,
        transcript_enabled: recordConsent,
        knocking_enabled: true,
      })
      .select("id, share_token")
      .single();
    if (mErr) throw mErr;

    const appUrl = Deno.env.get("APP_URL") || "https://www.kretopia.com";
    const shareUrl = `${appUrl}/meet/${meeting.id}?t=${meeting.share_token}`;

    // Notification to host
    try {
      await admin.from("notifications").insert({
        user_id: ownerId,
        type: "new_booking",
        title: `New booking: ${name}`,
        body: `${start.toUTCString().slice(0, 22)} · ${dur}m${body.brief ? ` — ${body.brief.slice(0, 100)}` : ""}`,
        action_url: `/meet/${meeting.id}`,
      });
    } catch { /* ignore */ }

    return json({
      meeting_id: meeting.id,
      share_url: shareUrl,
      start_iso: start.toISOString(),
      duration_minutes: dur,
      host_name: prof?.full_name ?? null,
    });
  } catch (e) {
    console.error("[book-meeting]", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
