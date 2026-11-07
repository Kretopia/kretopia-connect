/**
 * Where the generic /search address goes. /search used to be a landing page of its own; Discover replaced it, so an address with no term
 * resolves to Discover, and the results page stays for an address that carries one (a search typed in any bar lands there with ?q=, and
 * Discover has no field to hold a term, so redirecting would silently drop what the person typed).
 *
 * Discover reads two parameters, `tab` and `mode` (see pages/Discover.tsx); those are the compatible ones and are kept. Anything else on a
 * legacy address meant nothing to either page and is dropped.
 */
const DISCOVER_PARAMS = ["tab", "mode"] as const;

/** The Discover address for a /search address, or null when the address carries a term and belongs on the results page. */
export function genericSearchTarget(search: string): string | null {
  const params = new URLSearchParams(search);
  if ((params.get("q") ?? "").trim() !== "") return null;
  const keep = new URLSearchParams();
  for (const key of DISCOVER_PARAMS) {
    const value = params.get(key);
    if (value) keep.set(key, value);
  }
  const query = keep.toString();
  return query ? `/discover?${query}` : "/discover";
}
