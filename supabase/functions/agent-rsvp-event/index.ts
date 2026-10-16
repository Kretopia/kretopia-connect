// Thin wrapper around rsvp_to_event RPC for the agent orchestrator.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
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
    return new Response(JSON.stringify({ ok: true, result: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
