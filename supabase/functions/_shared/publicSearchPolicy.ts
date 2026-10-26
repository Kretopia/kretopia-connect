/** Preparation only: no active endpoint or production state. A caller must supply an atomic, durable quota store. */
export interface PublicSearchQuota {
  consume: (key: string, limit: number, windowSeconds: number) => Promise<boolean>;
}
export async function authorizePublicSearch(input: unknown, clientKey: string, quota: PublicSearchQuota) {
  if (!input || typeof input !== 'object') throw new Error('Invalid request');
  const query = (input as Record<string, unknown>).query;
  if (typeof query !== 'string' || query.trim().length < 2 || query.length > 200) throw new Error('Invalid query');
  if (!clientKey || clientKey.length > 200) throw new Error('Missing client identity');
  // Atomic storage is mandatory; never claim an isolate-local Map is a durable limit.
  if (!await quota.consume(clientKey, 10, 60)) throw new Error('Search limit reached');
  // Search provider only: no arbitrary URL fetch, redirects, scraping, or private-page access.
  // A pasted URL remains a search term rather than a server fetch destination.
  return { query: query.trim(), limit: 20, scrape: false as const };
}