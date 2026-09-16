import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DAILY_API = "https://api.daily.co/v1";

/**
 * Speed Session matcher — invoked by the client (host) or by cron during
 * a live session. For each active session:
 *   1. Read joined RSVPs not currently in an unfinished pairing.
 *   2. Pair them avoiding past matches in this session.
 *   3. Create a Daily room per pair, insert speed_session_pairings.
 *   4. Push a `pair_ready` broadcast to both users via Realtime channel.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const DAILY_API_KEY = Deno.env.get("DAILY_API_KEY");
    if (!DAILY_API_KEY) throw new Error("DAILY_API_KEY not configured");
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { session_id } = await req.json().catch(() => ({}));
    if (!session_id) throw new Error("session_id required");

    // Was fully unauthenticated -- no getUser/getClaims anywhere in this
    // file -- despite the doc comment's own claim of "invoked by the
    // client (host)". Any caller who learns a live session_id (every
    // participant does, it's in the route) could force early-close of
    // in-progress pairings and mint new Daily rooms on repeat, griefing
    // someone else's live session and burning DAILY_API_KEY quota with
    // no relationship to that session required at all. All 5 real
    // frontend call sites (SpeedSession.tsx) are either host/admin-gated
    // (`canControl`) or fire right after the caller upserts their own
    // speed_session_rsvps row for this exact session -- so requiring
    // "authenticated, and either the host or a real RSVP'd participant"
    // covers every legitimate caller.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const authedClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claimsData, error: claimsErr } = await authedClient.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    const callerId = claimsData?.claims?.sub as string | undefined;
    if (claimsErr || !callerId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: session } = await admin
      .from("speed_sessions")
      .select("id, mode, slot_seconds, status, host_user_id")
      .eq("id", session_id)
      .maybeSingle();
    if (!session || session.status !== "live") {
      return new Response(JSON.stringify({ ok: false, reason: "session-not-live" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    if (session.host_user_id !== callerId) {
      const [{ data: rsvp }, { data: isAdmin }] = await Promise.all([
        admin.from("speed_session_rsvps").select("user_id").eq("session_id", session_id).eq("user_id", callerId).maybeSingle(),
        admin.rpc("has_role", { _user_id: callerId, _role: "admin" }),
      ]);
      if (!rsvp && !isAdmin) {
        return new Response(JSON.stringify({ error: "Not part of this session" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Close any pairings older than slot_seconds
    const cutoff = new Date(Date.now() - session.slot_seconds * 1000).toISOString();
    await admin
      .from("speed_session_pairings")
      .update({ ended_at: new Date().toISOString() })
      .eq("session_id", session_id)
      .is("ended_at", null)
      .lt("started_at", cutoff);

    // Get joined participants
    const { data: rsvps } = await admin
      .from("speed_session_rsvps")
      .select("user_id, status")
      .eq("session_id", session_id)
      .eq("status", "joined");
    const joinedIds = (rsvps ?? []).map((r) => r.user_id);
    if (joinedIds.length < 2) {
      return new Response(JSON.stringify({ ok: true, paired: 0, reason: "not-enough-joined" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    // Active pairings (still in progress) — those users are busy
    const { data: activePairs } = await admin
      .from("speed_session_pairings")
      .select("user_a, user_b")
      .eq("session_id", session_id)
      .is("ended_at", null);
    const busy = new Set<string>();
    (activePairs ?? []).forEach((p) => { busy.add(p.user_a); busy.add(p.user_b); });

    // History of who paired with whom (avoid repeats)
    const { data: pastPairs } = await admin
      .from("speed_session_pairings")
      .select("user_a, user_b")
      .eq("session_id", session_id);
    const pastSet = new Set<string>();
    (pastPairs ?? []).forEach((p) => {
      pastSet.add(`${p.user_a}|${p.user_b}`);
      pastSet.add(`${p.user_b}|${p.user_a}`);
    });

    // Blocked pairs — never re-pair someone who blocked or was blocked
    const { data: blocks } = await admin
      .from("user_blocks")
      .select("blocker_id, blocked_user_id")
      .or(
        joinedIds.map((id) => `blocker_id.eq.${id}`).join(",") || "blocker_id.eq.00000000-0000-0000-0000-000000000000",
      );
    const blockSet = new Set<string>();
    (blocks ?? []).forEach((b) => {
      blockSet.add(`${b.blocker_id}|${b.blocked_user_id}`);
      blockSet.add(`${b.blocked_user_id}|${b.blocker_id}`);
    });

    // Current round number
    const { data: roundRow } = await admin
      .from("speed_session_pairings")
      .select("round")
      .eq("session_id", session_id)
      .order("round", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextRound = (roundRow?.round ?? 0) + 1;

    // Greedy pair available users
    const available = joinedIds.filter((id) => !busy.has(id));
    // Shuffle deterministically per call
    for (let i = available.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [available[i], available[j]] = [available[j], available[i]];
    }

    const pairsToCreate: Array<[string, string]> = [];
    const used = new Set<string>();
    for (let i = 0; i < available.length; i++) {
      const a = available[i];
      if (used.has(a)) continue;
      let matched = false;
      for (let j = i + 1; j < available.length; j++) {
        const b = available[j];
        if (used.has(b)) continue;
        if (blockSet.has(`${a}|${b}`)) continue;
        if (pastSet.has(`${a}|${b}`)) continue;
        pairsToCreate.push([a, b]); used.add(a); used.add(b); matched = true; break;
      }
      // If no fresh partner, allow repeat (better than skipping) — but still respect blocks
      if (!matched) {
        for (let j = i + 1; j < available.length; j++) {
          const b = available[j];
          if (used.has(b)) continue;
          if (blockSet.has(`${a}|${b}`)) continue;
          pairsToCreate.push([a, b]); used.add(a); used.add(b); break;
        }
      }
    }

    let createdCount = 0;
    for (const [userA, userB] of pairsToCreate) {
      const roomName = `sp-${crypto.randomUUID().replace(/-/g, "").slice(0, 28)}`;
      const exp = Math.floor(Date.now() / 1000) + Math.max(session.slot_seconds + 60, 600);
      const createRes = await fetch(`${DAILY_API}/rooms`, {
        method: "POST",
        headers: { Authorization: `Bearer ${DAILY_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: roomName,
          privacy: "private",
          properties: {
            exp, max_participants: 2,
            enable_prejoin_ui: false,
            start_video_off: session.mode === "audio",
          },
        }),
      });
      if (!createRes.ok) {
        console.error("[matcher] daily create failed", await createRes.text());
        continue;
      }
      const room = await createRes.json();

      await admin.from("speed_session_pairings").insert({
        session_id, round: nextRound, user_a: userA, user_b: userB,
        room_url: room.url, room_name: roomName,
      });
      createdCount++;
    }

    return new Response(JSON.stringify({ ok: true, paired: createdCount, round: nextRound }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
    });
  } catch (e) {
    console.error("[speed-session-matcher]", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
