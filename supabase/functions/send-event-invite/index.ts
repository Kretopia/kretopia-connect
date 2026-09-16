// Send event invitation emails to a list of email addresses (CSV or paste).
// Recipients do NOT need to be RSVP'd or even on the platform — this is the
// host's outreach channel for promoting an event to their own contacts.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PROD_ORIGIN = "https://www.kretopia.com";
const MAX_RECIPIENTS = 500;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const formatStart = (iso: string) => {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "unauthenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { eventId, emails, personalNote, refUsername, testOnly = false } =
      (await req.json()) ?? {};

    if (!eventId) {
      return new Response(JSON.stringify({ error: "eventId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Verify host owns the event
    const { data: ev, error: evErr } = await admin
      .from("creative_jams")
      .select(
        "id, title, created_by, start_time, venue_name, venue_address, cover_image_url",
      )
      .eq("id", eventId)
      .maybeSingle();
    if (evErr || !ev) {
      return new Response(JSON.stringify({ error: "event not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (ev.created_by !== user.id) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve host display name
    const { data: hostProfile } = await admin
      .from("profiles")
      .select("full_name, username")
      .eq("user_id", user.id)
      .maybeSingle();
    const hostName =
      hostProfile?.full_name || hostProfile?.username || "A ThriveIN host";
    const ref = refUsername || hostProfile?.username || null;

    // Normalize / dedupe / validate emails
    let cleaned: string[] = [];
    if (testOnly) {
      cleaned = user.email ? [user.email.toLowerCase()] : [];
    } else {
      const raw = Array.isArray(emails) ? emails : [];
      const seen = new Set<string>();
      for (const e of raw) {
        if (typeof e !== "string") continue;
        const v = e.trim().toLowerCase();
        if (!v || !EMAIL_RE.test(v) || seen.has(v)) continue;
        seen.add(v);
        cleaned.push(v);
        if (cleaned.length >= MAX_RECIPIENTS) break;
      }
    }

    if (cleaned.length === 0) {
      return new Response(
        JSON.stringify({ error: "No valid email addresses provided" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const eventUrl = ref
      ? `${PROD_ORIGIN}/event/${eventId}?ref=${encodeURIComponent(ref)}`
      : `${PROD_ORIGIN}/event/${eventId}`;
    const venue = [ev.venue_name, ev.venue_address].filter(Boolean).join(" · ");

    let delivered = 0;
    let failed = 0;
    const errors: { email: string; error: string }[] = [];

    for (const email of cleaned) {
      try {
        const { error } = await admin.functions.invoke(
          "send-transactional-email",
          {
            body: {
              templateName: "event-invite",
              recipientEmail: email,
              idempotencyKey: `invite-${eventId}-${email}`,
              templateData: {
                eventTitle: ev.title,
                eventUrl,
                hostName,
                startTimeFormatted: formatStart(ev.start_time),
                venue: venue || undefined,
                coverImageUrl: ev.cover_image_url || undefined,
                personalNote: personalNote?.trim() || undefined,
              },
            },
          },
        );
        if (error) throw error;
        delivered++;
      } catch (e: any) {
        failed++;
        errors.push({ email, error: String(e?.message || e) });
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        total: cleaned.length,
        delivered,
        failed,
        errors: errors.slice(0, 10),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("[send-event-invite] error", e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
