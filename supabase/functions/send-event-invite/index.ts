// Send event invitation emails to a list of email addresses (CSV or paste).
// Recipients do NOT need to be RSVP'd or even on the platform — this is the
// host's outreach channel for promoting an event to their own contacts.
//
// Bounded: the host must own the event; every address must be a single plain address;
// the note is clipped and stripped of control characters; one account mails at most
// 500 addresses a day and no address receives more than 3 host invitations a day (the
// `email_send_log` registry of _shared/outboundBudget.ts). Counts that cannot be read
// answer 503 and nothing is sent. Before this, any signed-in account could create an
// event and mail 500 strangers a call, with a free-text note, any number of times.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import {
  EVENT_INVITES_PER_ACTOR_PER_DAY,
  EVENT_INVITES_PER_RECIPIENT_PER_DAY,
  EVENT_INVITE_NOTE_MAX,
  EVENT_INVITE_TEMPLATE,
  EVENT_INVITE_WINDOW_MINUTES,
  countActorSends,
  countRecipientSendsBulk,
  planBulkSend,
  recordActorSendBatch,
} from "../_shared/outboundBudget.ts";
import { cleanFreeText, cleanRecipientEmail, singleLine } from "../_shared/outboundText.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PROD_ORIGIN = "https://www.kretopia.com";
const MAX_RECIPIENTS = 500;
// A `ref` is a username for attribution: nothing else belongs in a link we put in a mail.
const REF_RE = /^[A-Za-z0-9_.-]{1,40}$/;

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
      hostProfile?.full_name || hostProfile?.username || "A Kretopia host";
    const suppliedRef = singleLine(refUsername, 40);
    const ref = REF_RE.test(suppliedRef) ? suppliedRef : hostProfile?.username || null;
    const note = cleanFreeText(personalNote, EVENT_INVITE_NOTE_MAX);

    // Normalize / dedupe / validate emails
    let cleaned: string[] = [];
    if (testOnly) {
      cleaned = user.email ? [user.email.toLowerCase()] : [];
    } else {
      const raw = Array.isArray(emails) ? emails : [];
      const seen = new Set<string>();
      for (const e of raw) {
        const v = cleanRecipientEmail(e);
        if (!v || seen.has(v)) continue;
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

    // The budget, read before anything is sent. A test to the host's own address counts against
    // the account's day but is not held back for having been mailed recently.
    const [actorCount, recipientCounts] = await Promise.all([
      countActorSends(admin, user.id, EVENT_INVITE_TEMPLATE, EVENT_INVITE_WINDOW_MINUTES),
      testOnly
        ? Promise.resolve({} as Record<string, number>)
        : countRecipientSendsBulk(admin, cleaned, EVENT_INVITE_TEMPLATE, EVENT_INVITE_WINDOW_MINUTES),
    ]);
    const plan = planBulkSend({
      recipients: cleaned,
      actorCount,
      recipientCounts,
      actorLimit: EVENT_INVITES_PER_ACTOR_PER_DAY,
      recipientLimit: EVENT_INVITES_PER_RECIPIENT_PER_DAY,
    });
    if (!plan.ok) {
      return new Response(JSON.stringify({ error: plan.error }), {
        status: plan.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // The rows are written first: a send that could not be recorded is not made.
    const recorded = await recordActorSendBatch(admin, {
      template: EVENT_INVITE_TEMPLATE,
      actorId: user.id,
      recipientEmails: plan.allowed,
      status: "pending",
    });
    if (!recorded) {
      return new Response(JSON.stringify({ error: "Could not record this send, try again shortly" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const eventUrl = ref
      ? `${PROD_ORIGIN}/event/${eventId}?ref=${encodeURIComponent(ref)}`
      : `${PROD_ORIGIN}/event/${eventId}`;
    const venue = [ev.venue_name, ev.venue_address].filter(Boolean).join(" · ");

    let delivered = 0;
    let failed = 0;
    const errors: { email: string; error: string }[] = [];

    for (const email of plan.allowed) {
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
                personalNote: note || undefined,
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
        // Held back, never sent: mailed too recently by hosts, or past the account's day.
        skipped: plan.recentlyContacted.length + plan.overAllowance.length,
        skipped_recently_contacted: plan.recentlyContacted.length,
        skipped_over_limit: plan.overAllowance.length,
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
