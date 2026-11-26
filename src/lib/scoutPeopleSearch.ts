import { supabase } from "@/integrations/supabase/client";
import { escapePostgrestValue } from "@/lib/postgrestFilter";

export const SCOUT_PEOPLE_PAGE_SIZE = 50;
export interface ScoutPerson {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
  bio: string | null;
  location: string | null;
}
export const scoutSearchTarget = (query: string) => `/scout?q=${encodeURIComponent(query)}`;

/**
 * The PostgREST `or` expression for a people search: every word of the query must appear in the name, role, bio or location.
 * Empty when there is nothing to search. Shared by the hero preview and the Passport directory, so both mean the same by "matches".
 */
export function peopleFilterExpression(query: string): string {
  const terms = query.trim().split(/\s+/).filter(Boolean).slice(0, 12);
  if (!terms.length) return "";
  const filters = terms.map((term) => {
    const value = escapePostgrestValue(`%${term}%`);
    return `or(full_name.ilike.${value},role.ilike.${value},bio.ilike.${value},location.ilike.${value})`;
  });
  return `and(${filters.join(",")})`;
}

// Public-only, bounded cache: the destination reuses the dropdown's completed read.
const pages = new Map<string, { expires: number; request: Promise<{ users: ScoutPerson[]; hasMore: boolean }> }>();
export function searchScoutPeople(query: string, offset = 0) {
  const key = JSON.stringify([query.trim().toLowerCase(), offset]);
  const cached = pages.get(key);
  if (cached && cached.expires > Date.now()) return cached.request;
  const expression = peopleFilterExpression(query);
  const request = (async () => {
    if (!expression) return { users: [], hasMore: false };
    const { data, error } = await supabase.from("public_profiles_safe")
      .select("user_id, full_name, avatar_url, role, bio, location")
      .or(expression)
      .order("full_name", { ascending: true }).order("user_id", { ascending: true })
      .range(offset, offset + SCOUT_PEOPLE_PAGE_SIZE);
    if (error) { pages.delete(key); throw error; }
    const rows = (data || []) as ScoutPerson[];
    return { users: rows.slice(0, SCOUT_PEOPLE_PAGE_SIZE), hasMore: rows.length > SCOUT_PEOPLE_PAGE_SIZE };
  })();
  if (pages.size >= 30) pages.delete(pages.keys().next().value ?? "");
  pages.set(key, { expires: Date.now() + 30_000, request });
  return request;
}