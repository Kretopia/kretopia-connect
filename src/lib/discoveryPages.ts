/** Read deterministic pages instead of repeatedly seeing only the first API page.
 * A bounded walk protects the client; failures never masquerade as an empty pool.
 */
export async function readDiscoveryPages<T>(
  read: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  options: { pageSize?: number; maxPages?: number; enough?: (rows: T[]) => boolean } = {},
): Promise<{ data: T[]; error: unknown }> {
  const { pageSize = 500, maxPages = 20, enough } = options;
  const rows: T[] = [];
  for (let page = 0; page < maxPages; page++) {
    const result = await read(page * pageSize, (page + 1) * pageSize - 1);
    if (result.error) return { data: [], error: result.error };
    const batch = result.data ?? [];
    rows.push(...batch);
    if (batch.length < pageSize || enough?.(rows)) break;
  }
  return { data: rows, error: null };
}