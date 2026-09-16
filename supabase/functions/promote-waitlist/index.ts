import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (s: string, d?: any) =>
  console.log(`[promote-waitlist] ${s}${d ? " " + JSON.stringify(d) : ""}`);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    const anon = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const { eventId, count = 1, hours = 24 } = await req.json();
    if (!eventId) throw new Error("eventId required");

    const auth = req.headers.get("Authorization");
    if (!auth) throw new Error("Not authenticated");
    const { data: { user } } = await anon.auth.getUser(auth.replace("Bearer ", ""));
    if (!user) throw new Error("Not authenticated");

    const { data: event } = await admin
      .from("creative_jams")
      .select("created_by, title")
      .eq("id", eventId)
      .single();
    if (!event || event.created_by !== user.id) throw new Error("Not host");

    const { data: candidates } = await admin
      .from("event_waitlist")
      .select("id, user_id, position, tier_id")
      .eq("event_id", eventId)
      .eq("status", "waiting")
      .order("position", { ascending: true })
      .limit(count);

    const expiresAt = new Date(Date.now() + hours * 3600 * 1000).toISOString();
    const offered: string[] = [];

    for (const c of candidates || []) {
      await admin
        .from("event_waitlist")
        .update({ status: "offered", offered_at: new Date().toISOString(), expires_at: expiresAt })
        .eq("id", c.id);
      offered.push(c.user_id);

      // Notify
      await admin.from("notifications").insert({
        user_id: c.user_id,
        type: "waitlist_offer",
        title: "A spot opened up!",
        message: `You've been offered a spot for "${event.title}". Claim it before it expires.`,
        link: `/event/${eventId}?from=waitlist`,
      }).catch(() => {});
    }

    log("promoted", { offered: offered.length });

    return new Response(
      JSON.stringify({ promoted: offered.length, userIds: offered }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
