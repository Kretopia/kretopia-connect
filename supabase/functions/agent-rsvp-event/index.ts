// Thin wrapper around rsvp_to_event RPC for the agent orchestrator.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";


import { corsFor } from '../_shared/guard.ts';
Deno.serve(async (req) => {
  const corsHeaders = corsFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const client = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const body = await req.json().catch(() => ({}));
    const eventId = body?.event_id;
    if (!eventId || typeof eventId !== "string") {
      return new Response(JSON.stringify({ error: "event_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // rsvp_to_event does not look at ticketing, so without this the agent could put someone on
    // the guest list of a paid event for free. The agent RSVPs only to events that need no
    // ticket; a ticketed one is bought on the event page. The lookup uses the service role
    // for two non-sensitive columns so the check does not depend on who can see the event.
    const { data: userData } = await client.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
    if (!userData?.user) {
      return new Response(JSON.stringify({ ok: false, error: "Not authenticated" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { data: event } = await admin
      .from("creative_jams")
      .select("is_ticketed, external_ticket_url")
      .eq("id", eventId)
      .maybeSingle();
    if (event && (event.is_ticketed || String(event.external_ticket_url ?? "").trim())) {
      return new Response(JSON.stringify({
        ok: false,
        code: "TICKET_REQUIRED",
        error: "This event needs a ticket. Open the event page to get one.",
      }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data, error } = await client.rpc("rsvp_to_event", {
      p_event_id: eventId,
      p_referred_by: body?.referred_by ?? null,
      p_referral_channel: body?.referral_channel ?? "agent",
    });
    if (error) throw error;

    // The member gets the same confirmation email as when they RSVP on the event page (src/utils/eventConfirmationEmail.ts): the same
    // template and the same idempotency key, so never two for one event. It is sent as the member; the email function checks the
    // registration and writes the event's details itself. Best effort: a failed email never fails the RSVP.
    if (data === "joined" && userData.user.email) {
      try {
        const [{ data: participant }, { data: profile }] = await Promise.all([
          client.from("jam_participants").select("check_in_token").eq("jam_id", eventId).eq("user_id", userData.user.id).maybeSingle(),
          client.from("profiles").select("full_name").eq("user_id", userData.user.id).maybeSingle(),
        ]);
        await client.functions.invoke("send-transactional-email", {
          body: {
            templateName: "event-registration-confirmation",
            recipientEmail: userData.user.email,
            idempotencyKey: `event-reg-v2-${eventId}-${userData.user.id}`,
            templateData: {
              attendeeName: profile?.full_name || undefined,
              attendeeEmail: userData.user.email,
              eventUrl: `https://www.kretopia.com/event/${eventId}`,
              checkInToken: participant?.check_in_token || undefined,
              isTicketed: false,
              hasAccount: true,
            },
          },
        });
      } catch (emailError) {
        console.error("[agent-rsvp-event] confirmation email failed:", emailError);
      }
    }

    return new Response(JSON.stringify({ ok: true, result: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
