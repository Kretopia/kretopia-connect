import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Run every 15 minutes. Sends 24h, 1h, and 15min reminders to RSVP'd users
// for scheduled curated_stages. Idempotent via curated_stage_reminders_sent table.
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const now = Date.now();
    const windows = [
      { kind: "24h", minMin: 23 * 60 + 45, maxMin: 24 * 60 + 15 },
      { kind: "1h", minMin: 45, maxMin: 75 },
      { kind: "15m", minMin: 10, maxMin: 20 },
    ];

    let totalSent = 0;
    for (const w of windows) {
      const fromIso = new Date(now + w.minMin * 60_000).toISOString();
      const toIso = new Date(now + w.maxMin * 60_000).toISOString();

      const { data: stages } = await admin
        .from("curated_stages")
        .select("id, title, starts_at, host_user_id, type")
        .eq("status", "scheduled")
        .gte("starts_at", fromIso)
        .lte("starts_at", toIso);

      if (!stages?.length) continue;

      for (const stage of stages) {
        // Skip if already sent for this window
        const { data: existing } = await admin
          .from("curated_stage_reminders_sent")
          .select("id")
          .eq("stage_id", stage.id)
          .eq("kind", w.kind)
          .maybeSingle();
        if (existing) continue;

        const { data: rsvps } = await admin
          .from("curated_stage_rsvps")
          .select("user_id")
          .eq("stage_id", stage.id)
          .in("status", ["rsvp", "attended"]);

        const recipients = new Set<string>((rsvps ?? []).map((r) => r.user_id));
        recipients.add(stage.host_user_id);

        const friendly =
          w.kind === "24h" ? "in 24 hours" : w.kind === "1h" ? "in 1 hour" : "in 15 minutes";

        const notifs = Array.from(recipients).map((uid) => ({
          user_id: uid,
          type: "stage_reminder",
          title: `"${stage.title}" starts ${friendly}`,
          message:
            stage.type === "scout"
              ? "Scout Stage going live soon — tap to enter the lobby."
              : "Showcase Stage going live soon — tap to enter the lobby.",
          action_url: `/circle/stage/${stage.id}`,
        }));

        if (notifs.length) {
          try { await admin.from("notifications").insert(notifs); } catch (_e) { /* best-effort */ }
          totalSent += notifs.length;
        }

        try {
          await admin.from("curated_stage_reminders_sent")
            .insert({ stage_id: stage.id, kind: w.kind });
        } catch (_e) { /* best-effort */ }
      }

    }

    // No-show auto-cancel: scheduled stages that started 15min+ ago and never went live
    const cutoff = new Date(now - 15 * 60_000).toISOString();
    const { data: stale } = await admin
      .from("curated_stages")
      .select("id, title, host_user_id")
      .eq("status", "scheduled")
      .lt("starts_at", cutoff);
    let cancelled = 0;
    for (const s of stale || []) {
      await admin.from("curated_stages")
        .update({ status: "cancelled", ends_at: new Date().toISOString() })
        .eq("id", s.id);
      cancelled++;

      // Notify host + RSVPs
      const { data: rsvps } = await admin.from("curated_stage_rsvps")
        .select("user_id").eq("stage_id", s.id).in("status", ["rsvp", "waitlist"]);
      const targets = new Set<string>((rsvps || []).map((r: any) => r.user_id));
      targets.add(s.host_user_id);
      const notifs = Array.from(targets).map((uid) => ({
        user_id: uid,
        type: "stage_cancelled",
        title: `"${s.title}" was cancelled`,
        message: uid === s.host_user_id
          ? "You didn't go live in time. Schedule a new stage when ready."
          : "The host didn't show up. Any paid tickets will be refunded.",
        action_url: `/circle/stage/${s.id}`,
      }));
      if (notifs.length) { try { await admin.from("notifications").insert(notifs); } catch (_e) { /* best-effort */ } }

      // Mark paid orders as refunded (refund processing happens out-of-band)
      try {
        await admin.from("curated_stage_orders")
          .update({ status: "refunded" })
          .eq("stage_id", s.id).eq("status", "paid");
      } catch (_e) { /* best-effort */ }

    }

    return new Response(JSON.stringify({ ok: true, sent: totalSent, cancelled }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    console.error("[stage-reminders]", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
