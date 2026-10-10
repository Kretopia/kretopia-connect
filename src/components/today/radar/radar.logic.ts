import { skillNames } from "@/lib/skillNames";
import { formatEventWhen, isLive, type EventRow, type NextEvent } from "@/lib/nextEvent";

/**
 * The Radar's brain, kept pure so it can be tested: who to suggest and why,
 * which events are worth a look, what Kreto can be asked, and how fresh the
 * numbers are. Every sentence comes from a field that exists on a row the
 * viewer may read; nothing is estimated and nothing is invented.
 */

/* ───────────────────────── people to meet ───────────────────────── */

export interface PersonRow {
  user_id: string | null;
  username: string | null;
  full_name: string | null;
  role: string | null;
  avatar_url: string | null;
  cover_image_url: string | null;
  location: string | null;
  verification_tier: string | null;
  professional_skills: unknown;
  created_at?: string | null;
}

export interface Me {
  role: string | null;
  location: string | null;
  skills: string[];
}

export interface PersonToMeet {
  person: PersonRow & { user_id: string };
  /** Why Kreto suggests them, one factual line. */
  reason: string;
  score: number;
  sharedSkills: string[];
  sameCity: boolean;
  isNew: boolean;
}

const NEW_MEMBER_DAYS = 14;

const city = (location: string | null | undefined) => (location ?? "").split(",")[0].trim().toLowerCase();

export const firstName = (fullName: string | null | undefined): string => (fullName ?? "").trim().split(/\s+/)[0] ?? "";

function reasonFor(shared: string[], sameCity: boolean, isNew: boolean, p: PersonRow): string {
  if (shared.length === 1) return `Shares your ${shared[0]} skill`;
  if (shared.length === 2) return `Shares your ${shared[0]} and ${shared[1]} skills`;
  if (shared.length > 2) return `Shares ${shared.length} of your skills`;
  if (sameCity) return `Also in ${(p.location ?? "").split(",")[0].trim()}`;
  if (isNew) return "Joined Kretopia recently";
  return p.role ? `${p.role} on Kretopia` : "Active on Kretopia";
}

/**
 * Rank public Passports for one person. Shared skills weigh most, then the
 * same city, then a complementary role, then newness. The viewer, everyone
 * already connected to them and anyone without an id are left out.
 */
export function rankPeopleToMeet(
  me: Me,
  rows: PersonRow[],
  exclude: ReadonlySet<string>,
  now: Date = new Date(),
  limit = 10,
): PersonToMeet[] {
  const mine = new Map(me.skills.map((s) => [s.toLowerCase(), s]));
  const myCity = city(me.location);
  const myRole = (me.role ?? "").toLowerCase();
  const seen = new Set<string>();
  const out: PersonToMeet[] = [];

  for (const row of rows) {
    const id = row.user_id;
    if (!id || exclude.has(id) || seen.has(id)) continue;
    seen.add(id);

    const shared: string[] = [];
    for (const s of skillNames(row.professional_skills)) {
      const hit = mine.get(s.toLowerCase());
      if (hit && !shared.includes(hit)) shared.push(hit);
    }
    const sameCity = myCity.length >= 3 && city(row.location) === myCity;
    const created = row.created_at ? Date.parse(row.created_at) : NaN;
    const isNew = Number.isFinite(created) && now.getTime() - created < NEW_MEMBER_DAYS * 86_400_000 && created <= now.getTime();
    const theirRole = (row.role ?? "").toLowerCase();

    let score = Math.min(shared.length, 3) * 3;
    if (sameCity) score += 4;
    if (myRole && theirRole && myRole !== theirRole) score += 1; // someone to work with, not only alongside
    if (row.verification_tier) score += 1;
    if (isNew) score += 2;
    if (row.avatar_url) score += 1;

    out.push({
      person: { ...row, user_id: id },
      reason: reasonFor(shared, sameCity, isNew, row),
      score,
      sharedSkills: shared,
      sameCity,
      isNew,
    });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}

/* ───────────────────────── events ───────────────────────── */

export interface NearbyEvent extends EventRow {
  country?: string | null;
}

/** Public upcoming events worth showing: alive, not the viewer's own next event, soonest first. */
export function pickNearbyEvents(rows: NearbyEvent[], mine: NextEvent | null, now: Date = new Date(), limit = 3): NearbyEvent[] {
  return rows
    .filter((e) => isLive(e) && Date.parse(e.start_time) >= now.getTime() && e.id !== mine?.id)
    .sort((a, b) => Date.parse(a.start_time) - Date.parse(b.start_time))
    .slice(0, limit);
}

/** "in 25 min", "in 3 h", "in 2 days": how far away an event is. */
export function startsIn(startIso: string, now: Date = new Date()): string {
  const ms = Date.parse(startIso) - now.getTime();
  if (!Number.isFinite(ms)) return "";
  if (ms <= 0) return "now";
  const min = Math.round(ms / 60_000);
  if (min < 60) return `in ${Math.max(min, 1)} min`;
  const h = Math.round(ms / 3_600_000);
  if (h < 24) return `in ${h} h`;
  const d = Math.round(ms / 86_400_000);
  return `in ${d} day${d === 1 ? "" : "s"}`;
}

/** The viewer's country from a profile location ("Paris, France" -> "France"), or null when it is only a city. */
export function countryOf(location: string | null | undefined): string | null {
  const parts = (location ?? "").split(",").map((p) => p.trim()).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : null;
}

/* ───────────────────────── freshness ───────────────────────── */

/** "just now", "12 s ago", "3 min ago": how old the numbers on screen are. */
export function ageLabel(updatedAt: number | null | undefined, now: number = Date.now()): string {
  if (!updatedAt) return "";
  const s = Math.max(0, Math.round((now - updatedAt) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s} s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  return `${Math.floor(m / 60)} h ago`;
}

/* ───────────────────────── Kreto proposals ───────────────────────── */

export interface RadarGig {
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  remote: boolean;
  fit_score: number;
  source_name: string | null;
  compensation: string | null;
  posted_at: string | null;
  scouted_at: string;
}

export interface Proposal {
  id: "person" | "event" | "gig" | "open";
  /** What kind of lead it is. */
  kicker: string;
  /** The button text. It promises a draft or a plan for review, nothing done. */
  label: string;
  /** What Kreto is asked. Built from the same facts the screen shows. */
  prompt: string;
}

/** Opens Kreto with a prompt. The prompt asks for a draft or a plan to review: nothing is sent or booked from here. */
export const askKreto = (prompt: string) =>
  window.dispatchEvent(new CustomEvent("thrive-copilot:open", { detail: { prompt } }));

/**
 * Up to three things worth asking Kreto, each tied to something real on the
 * Radar. With nothing on the Radar, one open question. Every prompt asks for
 * a draft or a plan for the person to review; nothing is sent or booked.
 */
export function buildProposals(input: {
  person: PersonToMeet | null;
  event: { title: string; start_time: string } | null;
  gig: RadarGig | null;
  now?: Date;
}): Proposal[] {
  const now = input.now ?? new Date();
  const out: Proposal[] = [];

  if (input.person) {
    const p = input.person.person;
    const name = p.full_name || p.username || "this creator";
    const where = p.location ? `, ${p.location}` : "";
    out.push({
      id: "person",
      kicker: "Meet",
      label: `Draft a hello to ${firstName(name) || name}`,
      prompt: `Draft a short, warm first message from me to ${name} (${p.role ?? "creator"}${where}). Why I want to meet them: ${input.person.reason}. Keep it in my voice and let me review it before anything is sent.`,
    });
  }
  if (input.event) {
    out.push({
      id: "event",
      kicker: "Go",
      label: `Plan ${input.event.title.length > 28 ? `${input.event.title.slice(0, 27)}…` : input.event.title}`,
      prompt: `I'm looking at the event "${input.event.title}" (${formatEventWhen(input.event.start_time, now)}). Who should I try to meet there, and what should I prepare? Give me a short plan to review.`,
    });
  }
  if (input.gig) {
    const g = input.gig;
    out.push({
      id: "gig",
      kicker: "Pitch",
      label: `Pitch “${g.title.length > 24 ? `${g.title.slice(0, 23)}…` : g.title}”`,
      prompt: `Help me draft a pitch for "${g.title}"${g.company ? ` at ${g.company}` : ""} (found via ${g.source_name ?? "Scout"}, ${Math.round(g.fit_score)}% fit with my Passport). Use my Passport and my voice, and let me review it before I send anything.`,
    });
  }
  if (out.length === 0) {
    out.push({
      id: "open",
      kicker: "Ask",
      label: "Ask Kreto what to do next",
      prompt: "Look at my Passport and my week and tell me the one thing worth doing next to meet people or find work. Keep it short.",
    });
  }
  return out;
}
