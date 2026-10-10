import { supabase } from "@/integrations/supabase/client";
import type { CreditEvidenceInput } from "@/lib/creditEvidence";
import { pickNextEvent, type EventRow, type NextEvent } from "@/lib/nextEvent";
import { isThinListing } from "@/lib/scoutListing";
import type { NearbyEvent, PersonRow, RadarGig } from "./radar.logic";

/**
 * Every read the Radar makes. All of them are existing tables and views read
 * as the signed-in person (their own RLS applies), all are small and capped,
 * and none runs until the Radar is about to be seen (see useRadar).
 */

/**
 * supabase-js does not throw: a failed read comes back as `{ data: null, error }`.
 * The main read of every fetcher goes through this, so a failure is an error the
 * Radar can say out loud, never an empty list that reads as "nothing here".
 */
function must<T extends { error: unknown }>(res: T): T {
  if (res.error) throw res.error;
  return res;
}

const EVENT_COLUMNS = "id, title, start_time, end_time, venue_name, category, cover_image_url, event_mode, status";
const DAY = 86_400_000;

/* ── my next event: what I host or am going to ── */

export async function fetchNextEvent(userId: string): Promise<NextEvent | null> {
  const nowIso = new Date().toISOString();
  const [hosted, going] = await Promise.all([
    supabase.from("creative_jams").select(EVENT_COLUMNS).eq("created_by", userId).gte("start_time", nowIso).order("start_time", { ascending: true }).limit(5),
    supabase.from("jam_participants").select("jam_id").eq("user_id", userId).eq("status", "going").limit(50),
  ]);

  must(hosted);
  const ids = ((going.data as Array<{ jam_id: string }> | null) ?? []).map((r) => r.jam_id);
  let attending: EventRow[] = [];
  if (ids.length > 0) {
    const { data } = await supabase.from("creative_jams").select(EVENT_COLUMNS).in("id", ids).gte("start_time", nowIso).order("start_time", { ascending: true }).limit(5);
    attending = (data as unknown as EventRow[] | null) ?? [];
  }
  return pickNextEvent((hosted.data as unknown as EventRow[] | null) ?? [], attending);
}

/* ── public events coming up near me ── */

/** The country goes into a PostgREST filter: keep letters, digits and a few separators only. */
const safeCountry = (c: string) => c.replace(/[^\p{L}\p{N} .'-]/gu, "").trim();

export async function fetchNearbyEvents(country: string | null): Promise<{ rows: NearbyEvent[]; weekCount: number }> {
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const in14 = new Date(now + 14 * DAY).toISOString();
  const in7 = new Date(now + 7 * DAY).toISOString();
  const country_ = country ? safeCountry(country) : "";

  // Events tagged to another country are never shown; untagged ones are (community-posted, likely local).
  let list = supabase
    .from("creative_jams")
    .select(`${EVENT_COLUMNS}, country`)
    .eq("is_public", true)
    .gte("start_time", nowIso)
    .lte("start_time", in14)
    .or("status.is.null,status.neq.cancelled")
    .order("start_time", { ascending: true })
    .limit(8);
  let week = supabase
    .from("creative_jams")
    .select("id", { count: "exact", head: true })
    .eq("is_public", true)
    .gte("start_time", nowIso)
    .lte("start_time", in7)
    .or("status.is.null,status.neq.cancelled");
  if (country_) {
    const rule = `country.eq.${country_},country.is.null`;
    list = list.or(rule);
    week = week.or(rule);
  }

  const [rows, count] = await Promise.all([list, week]);
  must(rows);
  return { rows: (rows.data as unknown as NearbyEvent[] | null) ?? [], weekCount: count.count ?? 0 };
}

/* ── gigs Scout found for me ── */

export async function fetchGigs(userId: string): Promise<{ top: RadarGig[]; newCount: number }> {
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const dayAgo = new Date(now - DAY).toISOString();

  const [list, fresh, dismissed] = await Promise.all([
    supabase
      .from("scouted_gigs")
      .select("id, title, company, location, remote, fit_score, source_name, compensation, posted_at, scouted_at, description, apply_url, source_url")
      .eq("target_user_id", userId)
      .gt("expires_at", nowIso)
      .order("fit_score", { ascending: false })
      .order("scouted_at", { ascending: false })
      .limit(12),
    supabase.from("scouted_gigs").select("id", { count: "exact", head: true }).eq("target_user_id", userId).gt("expires_at", nowIso).gte("scouted_at", dayAgo),
    supabase.from("scouted_gig_actions").select("scouted_gig_id").eq("user_id", userId).eq("action", "dismissed"),
  ]);

  must(list);
  const gone = new Set(((dismissed.data as Array<{ scouted_gig_id: string }> | null) ?? []).map((a) => a.scouted_gig_id));
  type Row = RadarGig & { description: string | null; apply_url: string | null; source_url: string | null };
  const top = ((list.data as unknown as Row[] | null) ?? [])
    .filter((g) => !gone.has(g.id) && !isThinListing(g))
    .slice(0, 3)
    .map(
      (g): RadarGig => ({
        id: g.id,
        title: g.title,
        company: g.company,
        location: g.location,
        remote: !!g.remote,
        fit_score: g.fit_score,
        source_name: g.source_name,
        compensation: g.compensation,
        posted_at: g.posted_at,
        scouted_at: g.scouted_at,
      }),
    );
  return { top, newCount: fresh.count ?? 0 };
}

/* ── live Stages right now ── */

export interface LiveStage {
  id: string;
  title: string | null;
  vibe_tag: string | null;
  participant_count: number | null;
  started_at: string | null;
}

export async function fetchLiveStages(): Promise<{ rows: LiveStage[]; count: number }> {
  const { data, count } = must(
    await supabase
      .from("sound_stages")
      .select("id, title, vibe_tag, participant_count, started_at", { count: "exact" })
      .eq("is_live", true)
      .order("started_at", { ascending: false })
      .limit(3),
  );
  return { rows: (data as unknown as LiveStage[] | null) ?? [], count: count ?? (data?.length ?? 0) };
}

/* ── people: public Passports, who I already know, who joined this week ── */

const PEOPLE_COLUMNS = "user_id, username, full_name, role, avatar_url, cover_image_url, location, verification_tier, professional_skills, created_at";

export async function fetchPeople(userId: string): Promise<{ rows: PersonRow[]; knownIds: string[]; newThisWeek: number }> {
  const weekAgo = new Date(Date.now() - 7 * DAY).toISOString();
  const base = () => supabase.from("public_profiles_safe").select(PEOPLE_COLUMNS).not("username", "is", null).not("role", "is", null);

  const [top, newest, known, joined] = await Promise.all([
    base().order("level", { ascending: false, nullsFirst: false }).limit(60),
    base().order("created_at", { ascending: false }).limit(20),
    supabase.from("connections").select("connected_user_id").eq("user_id", userId).limit(1000),
    supabase.from("public_profiles_safe").select("user_id", { count: "exact", head: true }).not("username", "is", null).gte("created_at", weekAgo),
  ]);

  must(top);
  return {
    rows: [...((top.data as unknown as PersonRow[] | null) ?? []), ...((newest.data as unknown as PersonRow[] | null) ?? [])],
    knownIds: ((known.data as Array<{ connected_user_id: string }> | null) ?? []).map((c) => c.connected_user_id),
    newThisWeek: joined.count ?? 0,
  };
}

/** The credit rows the viewer is allowed to see for these people, grouped by person. */
export async function fetchCredits(ids: string[]): Promise<Record<string, CreditEvidenceInput[]>> {
  if (ids.length === 0) return {};
  const { data } = await supabase
    .from("credits")
    .select("user_id, verification_status, verification_url, endorsement_count, verified_by_name, verified_by_user_id")
    .in("user_id", ids);
  const byUser: Record<string, CreditEvidenceInput[]> = {};
  for (const c of (data as Array<CreditEvidenceInput & { user_id: string }> | null) ?? []) {
    (byUser[c.user_id] ||= []).push(c);
  }
  return byUser;
}
