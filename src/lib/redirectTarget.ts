// Only a base for parsing a relative address: nothing is ever requested from it and nothing of it is kept.
const PARSE_BASE = "https://redirect.invalid";

/**
 * Where a retired address sends the visitor: the destination `to`, carrying the query string and hash the visitor arrived with.
 *
 * A plain <Navigate to="/new" /> drops them, so /scout?tab=all&q=film (how Studio, Kreto and Today open Scout) would have landed on a bare
 * page. A parameter the destination names itself wins over the same one arriving (the destination knows what it needs); the arriving hash is
 * kept only when the destination has none.
 */
export function redirectTarget(to: string, incomingSearch = "", incomingHash = ""): { pathname: string; search: string; hash: string } {
  const target = new URL(to, PARSE_BASE);
  const params = new URLSearchParams(incomingSearch);
  target.searchParams.forEach((value, key) => params.set(key, value));
  const search = params.toString();
  return { pathname: target.pathname, search: search ? `?${search}` : "", hash: target.hash || incomingHash };
}
