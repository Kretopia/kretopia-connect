// Send event blast to attendees of a creative_jam event.
// Triggered by the host from /meetup/manage. Resolves the segment, enqueues
// one transactional email per recipient via send-transactional-email, and
// updates event_blasts + event_blast_recipients with delivery state.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PROD_ORIGIN = "https://thrivein.io";

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

    const body = await req.json();
    const {
      eventId,
      subject,
      bodyHtml,
      template = "custom",
      segment = "all",
      ctaText,
      ctaUrl,
      testOnly = false,
      userIds: explicitUserIds,
      segmentLabel,
    } = body ?? {};

    if (!eventId || !subject || !bodyHtml) {
      return new Response(
        JSON.stringify({ error: "eventId, subject and bodyHtml required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Verify host owns the event
    const { data: ev, error: evErr } = await admin
      .from("creative_jams")
      .select("id, title, created_by")
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

    // Resolve recipients
    let recipients: { email: string; user_id: string | null; name: string | null }[] = [];

    if (testOnly) {
      recipients = [{ email: user.email!, user_id: user.id, name: null }];
    } else {
      let userIds: string[] = [];
      if (Array.isArray(explicitUserIds) && explicitUserIds.length > 0) {
        userIds = explicitUserIds.filter((x: any) => typeof x === "string");
      } else {
        // Pull RSVPs from jam_participants joined with profiles
        const { data: parts } = await admin
          .from("jam_participants")
          .select("user_id, status")
          .eq("jam_id", eventId);

        userIds = (parts ?? [])
          .filter((p: any) => {
            if (segment === "all" || segment === "rsvp") return true;
            return p.status === segment;
          })
          .map((p: any) => p.user_id);
      }

      if (userIds.length === 0 && segment !== "paid") {
        return new Response(
          JSON.stringify({ error: "No recipients in this segment" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Get emails
      const { data: profs } = await admin
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);

      // auth emails
      const { data: authUsers } = await admin.auth.admin.listUsers({ perPage: 1000 });
      const emailMap = new Map<string, string>();
      (authUsers?.users ?? []).forEach((u: any) => {
        if (u.id && u.email) emailMap.set(u.id, u.email);
      });

      recipients = (profs ?? [])
        .map((p: any) => ({
          user_id: p.user_id,
          name: p.full_name,
          email: emailMap.get(p.user_id) || "",
        }))
        .filter((r) => !!r.email);
    }

    if (recipients.length === 0) {
      return new Response(
        JSON.stringify({ error: "No recipients with valid email" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Create blast record
    const { data: blast, error: blastErr } = await admin
      .from("event_blasts")
      .insert({
        event_id: eventId,
        created_by: user.id,
        template,
        subject,
        body_html: bodyHtml,
        segment: segmentLabel || segment,
        status: "sending",
        recipient_count: recipients.length,
      })
      .select("id")
      .single();
    if (blastErr || !blast) {
      throw new Error(blastErr?.message || "failed to create blast");
    }
    const blastId = blast.id;

    const eventUrl = `${PROD_ORIGIN}/event/${eventId}`;
    let delivered = 0;
    let failed = 0;

    // Insert recipient rows
    const recRows = recipients.map((r) => ({
      blast_id: blastId,
      user_id: r.user_id,
      email: r.email,
      status: "pending",
    }));
    await admin.from("event_blast_recipients").insert(recRows);

    // Fire enqueues sequentially (queue handles backoff)
    for (const r of recipients) {
      try {
        const { error } = await admin.functions.invoke("send-transactional-email", {
          body: {
            templateName: "event-blast",
            recipientEmail: r.email,
            idempotencyKey: `blast-${blastId}-${r.user_id ?? r.email}`,
            templateData: {
              subject,
              bodyHtml,
              eventTitle: ev.title,
              eventUrl,
              ctaText: ctaText || "View Event",
              ctaUrl: ctaUrl || eventUrl,
            },
          },
        });
        if (error) throw error;
        delivered++;
        await admin
          .from("event_blast_recipients")
          .update({ status: "queued", sent_at: new Date().toISOString() })
          .eq("blast_id", blastId)
          .eq("email", r.email);
      } catch (e: any) {
        failed++;
        await admin
          .from("event_blast_recipients")
          .update({ status: "failed", error_message: String(e?.message || e) })
          .eq("blast_id", blastId)
          .eq("email", r.email);
      }
    }

    await admin
      .from("event_blasts")
      .update({
        status: failed === recipients.length ? "failed" : "sent",
        sent_at: new Date().toISOString(),
        delivered_count: delivered,
        failed_count: failed,
      })
      .eq("id", blastId);

    return new Response(
      JSON.stringify({ ok: true, blastId, delivered, failed, total: recipients.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("[send-event-blast] error", e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
