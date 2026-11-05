import { supabase } from "@/integrations/supabase/client";
import { escapePostgrestValue } from "@/lib/postgrestFilter";

export const VERIFICATION_SEARCH_PAGE_SIZE = 50;

export async function searchVerificationUsers(query: string, viewerId: string | undefined, offset = 0, signal?: AbortSignal) {
  const term = query.trim().replace(/^@/, "");
  if (!term) return { users: [], hasMore: false };
  const escaped = escapePostgrestValue(`%${term}%`);
  let request = viewerId
    ? supabase.from("profiles")
        .select("user_id, full_name, avatar_url, role, username")
        .or(`full_name.ilike.${escaped},username.ilike.${escaped}`)
        .neq("user_id", viewerId)
    : supabase.from("public_profiles_safe")
        .select("user_id, full_name, avatar_url, role")
        .ilike("full_name", `%${term}%`);
  request = request.order("full_name", { ascending: true }).order("user_id", { ascending: true })
    .range(offset, offset + VERIFICATION_SEARCH_PAGE_SIZE);
  if (signal) request = request.abortSignal(signal);
  const { data, error } = await request;
  if (error) throw error;
  const rows = data || [];
  return {
    users: rows.slice(0, VERIFICATION_SEARCH_PAGE_SIZE),
    hasMore: rows.length > VERIFICATION_SEARCH_PAGE_SIZE,
  };
}