// Maps a Daily room name back to the call it belongs to, so a recording can be attached to the right call.
// Shared by daily-recording-webhook and sync-daily-recordings, which used to keep two slightly different
// copies. A lookup that FAILS throws instead of reading as "no such call": a transient database error
// used to make the webhook answer 200 "no matching call" for a recording that was ours, and Daily does
// not retry a 2xx, so that recording was never stored.

import type { RecordingCallContext } from "./recordingRow.ts";

// The query builder is chained dynamically; its real type lives in the Deno-only supabase-js import.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = { from: (table: string) => any };

export async function findCallByRoom(admin: AdminClient, roomName: string): Promise<RecordingCallContext | null> {
  // Stage rooms follow a `<prefix>-<id>` convention:
  //   ss- → sound_stages (spontaneous Clubhouse-style)
  //   sp- → speed_sessions (Hi-Right-Now style rotations)
  //   cs- → curated_stages (scheduled Showcase / Scout)
  // Match by room_name first, then fall back to room_url suffix.
  const stageTables: Array<{ prefix: string; table: string; kind: "sound_stage" | "speed_session" | "curated_stage"; circleCol: boolean }> = [
    { prefix: "ss-", table: "sound_stages", kind: "sound_stage", circleCol: false },
    { prefix: "sp-", table: "speed_sessions", kind: "speed_session", circleCol: true },
    { prefix: "cs-", table: "curated_stages", kind: "curated_stage", circleCol: false },
  ];
  for (const s of stageTables) {
    if (!roomName.startsWith(s.prefix)) continue;
    const cols = s.circleCol
      ? "id, host_user_id, circle_id, room_name, room_url"
      : "id, host_user_id, room_name, room_url";
    const { data: row, error: rowErr } = await admin
      .from(s.table)
      .select(cols)
      .or(`room_name.eq.${roomName},room_url.ilike.%/${roomName}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (rowErr) throw new Error(`call lookup failed: ${rowErr.message}`);
    if (row) {
      return {
        kind: s.kind,
        id: row.id,
        host_id: row.host_user_id,
        circle_id: s.circleCol ? row.circle_id ?? undefined : undefined,
      };
    }
  }

  // Multi-party meetings (the new /meet/:id flow). Match by exact room_name.
  const { data: mtg, error: mtgErr } = await admin
    .from("meetings")
    .select("id, host_id, project_id, circle_id, source, room_name")
    .eq("room_name", roomName)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (mtgErr) throw new Error(`call lookup failed: ${mtgErr.message}`);
  if (mtg) {
    return {
      kind: mtg.source === "event" ? "event" : "meeting",
      id: mtg.id,
      host_id: mtg.host_id,
      project_id: mtg.project_id ?? undefined,
      circle_id: mtg.circle_id ?? undefined,
    };
  }

  // Project rooms are named `td-<projectIdNoDash>`. The video_room_url on the
  // project ends with the room_name, so we can search by URL suffix.
  const { data: pCall, error: pCallErr } = await admin
    .from("project_video_calls")
    .select("id, project_id, started_by, participants, room_url")
    .ilike("room_url", `%/${roomName}`)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (pCallErr) throw new Error(`call lookup failed: ${pCallErr.message}`);
  if (pCall) {
    return {
      kind: "project",
      id: pCall.id,
      host_id: pCall.started_by,
      project_id: pCall.project_id,
      participants: pCall.participants,
    };
  }

  const { data: dCall, error: dCallErr } = await admin
    .from("direct_video_calls")
    .select("id, started_by, invited_user_id, participants, room_name, room_url")
    .or(`room_name.eq.${roomName},room_url.ilike.%/${roomName}`)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (dCallErr) throw new Error(`call lookup failed: ${dCallErr.message}`);
  if (dCall) {
    return {
      kind: "direct",
      id: dCall.id,
      host_id: dCall.started_by,
      participants: dCall.participants,
    };
  }

  const { data: cCall, error: cCallErr } = await admin
    .from("circle_video_calls")
    .select("id, circle_id, started_by, participants, room_name, room_url")
    .or(`room_name.eq.${roomName},room_url.ilike.%/${roomName}`)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (cCallErr) throw new Error(`call lookup failed: ${cCallErr.message}`);
  if (cCall) {
    return {
      kind: "circle",
      id: cCall.id,
      host_id: cCall.started_by,
      circle_id: cCall.circle_id,
      participants: cCall.participants,
    };
  }

  return null;
}
