/**
 * Public Web + AI search is hosted on the separate Lovable Cloud backend, never on the legacy
 * production backend. Only the publishable (browser-safe) key is used here; the endpoint enforces
 * its own server-only activation switch and atomic global quota.
 */
const SEARCH_BACKEND_URL = "https://czpucbhnmcudggydwxlg.supabase.co";
const SEARCH_BACKEND_PUBLISHABLE_KEY = "sb_publishable_ssXNn-GlHaO9CYIjNj_URg_jQFG1Vep";

export interface PublicWebSearchResponse {
  available: boolean;
  results?: unknown[];
  aiAvailable?: boolean;
}

export async function invokePublicWebSearch(query: string, signal?: AbortSignal): Promise<PublicWebSearchResponse> {
  const response = await fetch(`${SEARCH_BACKEND_URL}/functions/v1/public-digital-presence`, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", apikey: SEARCH_BACKEND_PUBLISHABLE_KEY },
    body: JSON.stringify({ query }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data || typeof data !== "object") return { available: false, results: [] };
  return data as PublicWebSearchResponse;
}
