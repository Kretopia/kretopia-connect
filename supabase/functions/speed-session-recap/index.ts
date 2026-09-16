// Next-morning Speed Session recap.
// Runs hourly. For each session that ended 10–28h ago (no recap_sent_at yet),
// emails every joined RSVP a personalized recap: people they connected with,
// who saved them, and a CTA back to the platform.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = "https://www.thrivein.io";

type Peer = { user_id: string; full_name: string | null; avatar_url: string | null; role: string | null };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const stats = { sessions: 0, emails: 0, errors: 0 };
  const now = new Date();
  const lo = new Date(now.getTime() - 28 * 3_600_000).toISOString();
  const hi = new Date(now.getTime() - 10 * 3_600_000).toISOString();

  const { data: sessions, error } = await admin
    .from("speed_sessions")
    .select("id, title, starts_at")
    .eq("status", "ended")
    .is("recap_sent_at", null)
    .gte("starts_at", lo)
    .lte("starts_at", hi);
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  for (const s of sessions ?? []) {
    stats.sessions++;
    try {
      const { data: pairings } = await admin
        .from("speed_session_pairings")
        .select("user_a, user_b")
        .eq("session_id", s.id);

      // Map: each user → set of peers they met
      const metMap = new Map<string, Set<string>>();
      for (const p of pairings ?? []) {
        if (!metMap.has(p.user_a)) metMap.set(p.user_a, new Set());
        if (!metMap.has(p.user_b)) metMap.set(p.user_b, new Set());
        metMap.get(p.user_a)!.add(p.user_b);
        metMap.get(p.user_b)!.add(p.user_a);
      }

      const allUsers = Array.from(metMap.keys());
      if (allUsers.length === 0) {
        await admin.from("speed_sessions").update({ recap_sent_at: new Date().toISOString() }).eq("id", s.id);
        continue;
      }

      // NOTE: `profiles` has no `email` column — selecting it 500s the job.
      // Resolve names from profiles and emails from auth.users via admin SDK.
      const { data: profs } = await admin
        .from("profiles")
        .select("user_id, full_name, avatar_url, role")
        .in("user_id", allUsers);
      const profMap = new Map<string, any>();
      (profs ?? []).forEach((p) => profMap.set(p.user_id, p));
      for (const uid of allUsers) {
        try {
          const { data: u } = await admin.auth.admin.getUserById(uid);
          const email = u?.user?.email ?? null;
          const existing = profMap.get(uid) ?? { user_id: uid };
          profMap.set(uid, { ...existing, email });
        } catch (e) {
          console.error("[recap] getUserById", uid, e);
        }
      }


      // Pull connections + saves anchored to this session window
      const windowLo = new Date(new Date(s.starts_at).getTime() - 5 * 60_000).toISOString();
      const windowHi = new Date(new Date(s.starts_at).getTime() + 6 * 3_600_000).toISOString();

      const { data: conns } = await admin
        .from("connections")
        .select("user_id, connected_user_id, created_at")
        .eq("context", "speed_session")
        .gte("created_at", windowLo)
        .lte("created_at", windowHi);

      const sentConn = new Map<string, Set<string>>();
      const recvConn = new Map<string, Set<string>>();
      for (const c of conns ?? []) {
        if (!sentConn.has(c.user_id)) sentConn.set(c.user_id, new Set());
        if (!recvConn.has(c.connected_user_id)) recvConn.set(c.connected_user_id, new Set());
        sentConn.get(c.user_id)!.add(c.connected_user_id);
        recvConn.get(c.connected_user_id)!.add(c.user_id);
      }

      const { data: saves } = await admin
        .from("saved_sparks")
        .select("user_id, item_id, created_at")
        .eq("item_type", "creator")
        .gte("created_at", windowLo)
        .lte("created_at", windowHi);

      const savedBy = new Map<string, Set<string>>(); // saver → savees
      const savedMe = new Map<string, Set<string>>(); // savee → savers
      for (const sv of saves ?? []) {
        if (!savedBy.has(sv.user_id)) savedBy.set(sv.user_id, new Set());
        if (!savedMe.has(sv.item_id)) savedMe.set(sv.item_id, new Set());
        savedBy.get(sv.user_id)!.add(sv.item_id);
        savedMe.get(sv.item_id)!.add(sv.user_id);
      }

      for (const uid of allUsers) {
        const me = profMap.get(uid);
        if (!me?.email) continue;
        const metIds = Array.from(metMap.get(uid) ?? []);
        const connected: Peer[] = Array.from(sentConn.get(uid) ?? [])
          .filter((id) => metIds.includes(id))
          .map((id) => profMap.get(id)).filter(Boolean);
        const savedYouIds = Array.from(savedMe.get(uid) ?? []).filter((id) => metIds.includes(id));
        const savedYou: Peer[] = savedYouIds.map((id) => profMap.get(id)).filter(Boolean);
        const met: Peer[] = metIds.map((id) => profMap.get(id)).filter(Boolean);

        try {
          await admin.functions.invoke("send-transactional-email", {
            body: {
              templateName: "speed-session-recap",
              recipientEmail: me.email,
              idempotencyKey: `ss-recap-${s.id}-${uid}`,
              templateData: {
                attendeeName: me.full_name,
                sessionTitle: s.title,
                totalMet: met.length,
                connected: connected.map(toCard),
                savedYou: savedYou.map(toCard),
                met: met.map(toCard),
                browseUrl: `${APP_URL}/circle/speed`,
              },
            },
          });
          stats.emails++;
        } catch (e) {
          stats.errors++;
          console.error("[recap] send", uid, e);
        }
      }

      await admin.from("speed_sessions").update({ recap_sent_at: new Date().toISOString() }).eq("id", s.id);
    } catch (e) {
      stats.errors++;
      console.error("[recap] session", s.id, e);
    }
  }

  return new Response(JSON.stringify({ ok: true, ...stats }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

function toCard(p: any) {
  return {
    name: p?.full_name ?? "A creator",
    role: p?.role ?? null,
    avatar: p?.avatar_url ?? null,
    profileUrl: p?.user_id ? `${APP_URL}/u/${p.user_id}` : null,
  };
}
