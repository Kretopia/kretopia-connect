import { supabase } from "@/integrations/supabase/client";
import { escapePostgrestValue } from "@/lib/postgrestFilter";
import { searchScoutPeople } from "@/lib/scoutPeopleSearch";
import { opportunityTiming, snippetAround, whyOpportunity, whyPerson } from "@/lib/searchResultView";

/**
 * The public reads behind every search surface: the hero's dropdown and the Search Page ask the same questions of the same public
 * sources and get the same rows, so a result means the same thing wherever it is shown. Public only, for a visitor and a member
 * alike: the public profile view, the public opportunity columns (the guest contact columns stay locked, see opportunityColumns.ts),
 * public upcoming events and project credits. Nothing here ranks or scores; `why` only names the field that matched the words.
 */

export type PublicResultType = "creator" | "gig" | "event" | "credit";

export interface PublicSearchResult {
  type: PublicResultType;
  id: string;
  title: string;
  subtitle?: string;
  avatar?: string | null;
  /** The miniature: a photo, a poster, a project still. */
  thumbnail?: string | null;
  /** One line of evidence. */
  detail?: string | null;
  /** Why the row appears: the field that matched. */
  why?: string | null;
  /** Timing, said honestly (a deadline, a date, the age of a post). */
  timing?: string | null;
  /** The timing says it is over: the row is not presented as open. */
  closed?: boolean;
}

export interface PublicSearchSources {
  people: boolean;
  opportunities: boolean;
  events: boolean;
  work: boolean;
}

export interface PublicSearchLimits {
  people: number;
  opportunities: number;
  events: number;
  work: number;
}

export interface PublicSearchResults {
  people: PublicSearchResult[];
  opportunities: PublicSearchResult[];
  work: PublicSearchResult[];
  events: PublicSearchResult[];
}

interface OpportunityRow { id: string; title: string; type?: string | null; compensation?: string | null; location?: string | null; image_url?: string | null; application_deadline?: string | null; created_at?: string | null; skills?: string[] | null }
interface JamRow { id: string; title: string; start_time?: string | null; venue_name?: string | null; cover_image_url?: string | null }
interface CreditRow { id: string; project_name?: string | null; role?: string | null; year?: number | string | null; project_type?: string | null; thumbnail_url?: string | null }

const rowsOf = <T,>(outcome: PromiseSettledResult<unknown>): T[] | null => {
  if (outcome.status !== "fulfilled") return null;
  if (outcome.value === null) return [];
  const reply = outcome.value as { error: unknown; data: unknown[] | null };
  return reply.error ? null : ((reply.data ?? []) as T[]);
};

/** Where a result opens: its own public page. */
export function resultHref(result: Pick<PublicSearchResult, "type" | "id" | "title">): string {
  switch (result.type) {
    case "creator": return `/profile/${result.id}`;
    case "gig": return `/opportunity/${result.id}`;
    case "event": return `/event/${result.id}`;
    default: return `/production?name=${encodeURIComponent(result.title)}`;
  }
}

/**
 * Asks the public sources the caller wants and returns their rows. It fails only when every source that was asked failed (a
 * partial answer is still an answer); work is a bonus source and its absence is never an error.
 */
export async function fetchPublicSearch(q: string, want: PublicSearchSources, limits: PublicSearchLimits): Promise<PublicSearchResults> {
  const nothing = Promise.resolve(null);
  const like = escapePostgrestValue(`%${q}%`);
  // The first opportunities read adds the miniature and the timing; if a deployment lacks one of those columns it repeats with the
  // basics, so a missing thumbnail never costs the answer.
  const readOpportunities = async () => {
    const rich = await supabase.from("opportunities").select("id, title, type, compensation, location, image_url, application_deadline, created_at, skills").eq("status", "active").ilike("title", `%${q}%`).limit(limits.opportunities);
    if (!rich.error) return rich;
    return supabase.from("opportunities").select("id, title, type, compensation, location").eq("status", "active").ilike("title", `%${q}%`).limit(limits.opportunities);
  };
  const [people, gigs, jams, credits] = await Promise.allSettled([
    want.people ? searchScoutPeople(q, 0) : nothing,
    want.opportunities ? readOpportunities() : nothing,
    want.events
      ? supabase
          .from("creative_jams")
          .select("id, title, start_time, venue_name, cover_image_url")
          .eq("is_public", true)
          .gte("start_time", new Date().toISOString())
          .or(`title.ilike.${like},venue_name.ilike.${like}`)
          .order("start_time", { ascending: true })
          .limit(limits.events)
      : nothing,
    want.work ? supabase.from("credits").select("id, project_name, role, year, project_type, thumbnail_url").ilike("project_name", `%${q}%`).limit(limits.work * 3) : nothing,
  ]);

  const gigRows = rowsOf<OpportunityRow>(gigs);
  const jamRows = rowsOf<JamRow>(jams);
  const peopleOk = people.status === "fulfilled";
  const failed = [want.people && !peopleOk, want.opportunities && gigRows === null, want.events && jamRows === null].filter(Boolean).length;
  const asked = [want.people, want.opportunities, want.events].filter(Boolean).length;
  if (asked > 0 && failed === asked) throw people.status === "rejected" ? people.reason : new Error("search failed");

  const peopleRows: PublicSearchResult[] = people.status === "fulfilled" && people.value
    ? people.value.users.slice(0, limits.people).map((p) => {
        const why = whyPerson(q, { name: p.full_name, role: p.role, bio: p.bio, location: p.location });
        const evidence = snippetAround(p.bio, q);
        return {
          type: "creator" as const,
          id: p.user_id,
          title: p.full_name || "Kretopia user",
          subtitle: [p.role, p.location].filter(Boolean).join(" · "),
          avatar: p.avatar_url,
          thumbnail: p.avatar_url,
          why,
          detail: evidence && evidence !== why ? evidence : null,
        };
      })
    : [];
  const opportunities: PublicSearchResult[] = (gigRows ?? []).map((o) => {
    const timing = opportunityTiming(o.application_deadline, o.created_at);
    return {
      type: "gig" as const,
      id: o.id,
      title: o.title,
      subtitle: [o.type, o.compensation, o.location].filter(Boolean).join(" · "),
      thumbnail: o.image_url ?? null,
      why: whyOpportunity(q, { title: o.title, type: o.type, skills: o.skills, location: o.location }),
      timing: timing?.label ?? null,
      closed: timing?.closed ?? false,
    };
  });
  const events: PublicSearchResult[] = (jamRows ?? []).map((j) => ({
    type: "event" as const,
    id: j.id,
    title: j.title,
    subtitle: [j.start_time ? new Date(j.start_time).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : null, j.venue_name].filter(Boolean).join(" · "),
    thumbnail: j.cover_image_url ?? null,
  }));
  // Work: one row per project name (a credit is one person's line on it), with the kind of project and how many credits carry it.
  const projects = new Map<string, { row: CreditRow; count: number }>();
  for (const c of rowsOf<CreditRow>(credits) ?? []) {
    const key = String(c.project_name ?? "").trim().toLowerCase();
    if (!key) continue;
    const seen = projects.get(key);
    if (seen) seen.count += 1;
    else projects.set(key, { row: c, count: 1 });
  }
  const work: PublicSearchResult[] = Array.from(projects.values()).slice(0, limits.work).map(({ row, count }) => ({
    type: "credit" as const,
    id: row.id,
    title: row.project_name ?? "",
    subtitle: [row.project_type, row.year].filter(Boolean).join(" · "),
    thumbnail: row.thumbnail_url ?? null,
    detail: `${count} ${count === 1 ? "credit" : "credits"} on Kretopia`,
  }));

  return { people: peopleRows, opportunities, work, events };
}
