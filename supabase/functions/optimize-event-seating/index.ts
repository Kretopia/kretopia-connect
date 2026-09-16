import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { event_id, layout_id, table_count, seats_per_table } = await req.json();
    if (!event_id) {
      return new Response(JSON.stringify({ error: "event_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Authorize: event creator OR project host/collaborator
    const { data: jam } = await admin
      .from("creative_jams").select("id, created_by").eq("id", event_id).maybeSingle();
    if (!jam) {
      return new Response(JSON.stringify({ error: "Event not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    let isHost = jam.created_by === user.id;
    if (!isHost) {
      const { data: project } = await admin
        .from("projects").select("id, created_by").eq("event_id", event_id).maybeSingle();
      if (project) {
        isHost = project.created_by === user.id;
        if (!isHost) {
          const { data: c } = await admin.from("project_collaborators")
            .select("id").eq("project_id", project.id).eq("user_id", user.id).eq("status", "accepted").maybeSingle();
          isHost = !!c;
        }
      }
    }
    if (!isHost) {
      return new Response(JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Resolve / auto-create the layout. Hosts in our UI just pick "N tables of M seats" — we
    // materialize that into an event_seating_layouts row so the rest of the platform (per-guest
    // seat lookups, runsheets, check-in) keeps working.
    const desiredTableCount = Math.max(1, Math.min(50, Number(table_count) || 0));
    let resolvedLayoutId: string | null = layout_id || null;

    if (!resolvedLayoutId) {
      // Reuse the most recent layout for this event if it exists; otherwise create one.
      const { data: existing } = await admin.from("event_seating_layouts")
        .select("id, tables").eq("event_id", event_id)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (existing?.id) {
        resolvedLayoutId = existing.id;
        // If caller asked for a different table count, regenerate the table list.
        if (desiredTableCount > 0) {
          const newTables = Array.from({ length: desiredTableCount }, (_, i) => ({
            id: crypto.randomUUID(), name: `Table ${i + 1}`,
          }));
          await admin.from("event_seating_layouts").update({ tables: newTables }).eq("id", existing.id);
        }
      } else {
        const count = desiredTableCount || 8;
        const newTables = Array.from({ length: count }, (_, i) => ({
          id: crypto.randomUUID(), name: `Table ${i + 1}`,
        }));
        const { data: created, error: createErr } = await admin.from("event_seating_layouts")
          .insert({ event_id, name: "Main Layout", tables: newTables, created_by: user.id })
          .select("id").single();
        if (createErr || !created) {
          return new Response(JSON.stringify({ error: `Couldn't create layout: ${createErr?.message || "unknown"}` }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        resolvedLayoutId = created.id;
      }
    }

    // Load layout (table list)
    const { data: layout } = await admin.from("event_seating_layouts")
      .select("tables").eq("id", resolvedLayoutId).maybeSingle();
    const tables: any[] = Array.isArray(layout?.tables) ? layout!.tables : [];
    if (tables.length === 0) {
      return new Response(JSON.stringify({ error: "Add tables to the layout first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const perTable = Math.max(2, Number(seats_per_table) || 8);

    // Load RSVP'd users
    const { data: parts } = await admin.from("jam_participants")
      .select("user_id").eq("jam_id", event_id).in("status", ["going", "confirmed", "checked_in"]);
    const userIds = (parts || []).map((p: any) => p.user_id).filter(Boolean);
    if (userIds.length === 0) {
      return new Response(JSON.stringify({ assignments: [], note: "No RSVP'd guests yet." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Load guest matches (pair scores)
    const { data: matches } = await admin.from("event_guest_matches")
      .select("user_a, user_b, score").eq("event_id", event_id);

    // Build adjacency score map
    const score = new Map<string, number>();
    const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
    (matches || []).forEach((m: any) => score.set(key(m.user_a, m.user_b), Number(m.score) || 0));

    // Greedy seating: seed each table with the highest-scoring unseated pair, then fill with the
    // unseated guest who maximizes total connection score with people already at that table.
    const unseated = new Set(userIds);
    const tableSeats: Record<string, string[]> = {};
    tables.forEach((t: any) => { tableSeats[t.id] = []; });

    // Pre-sort all pairs by score desc
    const pairs: Array<[string, string, number]> = [];
    for (let i = 0; i < userIds.length; i++) {
      for (let j = i + 1; j < userIds.length; j++) {
        pairs.push([userIds[i], userIds[j], score.get(key(userIds[i], userIds[j])) || 0]);
      }
    }
    pairs.sort((a, b) => b[2] - a[2]);

    // Seed tables with top pairs
    for (const t of tables) {
      const tid = t.id;
      const seed = pairs.find(([a, b]) => unseated.has(a) && unseated.has(b));
      if (!seed) break;
      tableSeats[tid].push(seed[0], seed[1]);
      unseated.delete(seed[0]); unseated.delete(seed[1]);
    }

    // Round-robin fill remaining
    while (unseated.size > 0) {
      let placed = false;
      for (const t of tables) {
        if (tableSeats[t.id].length >= perTable) continue;
        if (unseated.size === 0) break;
        // pick guest with highest summed score vs current table occupants (fallback: any)
        let best: string | null = null; let bestScore = -1;
        for (const g of unseated) {
          let s = 0;
          for (const occ of tableSeats[t.id]) s += score.get(key(g, occ)) || 0;
          if (s > bestScore) { bestScore = s; best = g; }
        }
        if (best) {
          tableSeats[t.id].push(best);
          unseated.delete(best);
          placed = true;
        }
      }
      if (!placed) break;
    }

    // Persist: clear + insert assignments
    await admin.from("event_seating_assignments").delete().eq("layout_id", resolvedLayoutId);
    const rows: any[] = [];
    Object.entries(tableSeats).forEach(([tid, occupants]) => {
      occupants.forEach((uid, idx) => {
        rows.push({ event_id, layout_id: resolvedLayoutId, table_id: tid, seat_index: idx, user_id: uid });
      });
    });
    if (rows.length > 0) {
      const { error } = await admin.from("event_seating_assignments").insert(rows);
      if (error) throw error;
    }

    return new Response(JSON.stringify({ ok: true, assigned: rows.length, tables: tables.length, layout_id: resolvedLayoutId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("optimize-event-seating error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
