// Pure helpers for scout-leads (no imports, so they are unit-testable).

/** Split into at most `parts` chunks of near-equal size, but never into chunks
 *  smaller than `minPerPart` items: a handful of results is one call, not three. */
export function splitEvenly<T>(items: T[], parts: number, minPerPart = 8): T[][] {
  const n = Math.max(1, Math.min(parts, Math.floor(items.length / minPerPart)));
  const size = Math.max(1, Math.ceil(items.length / n));
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Same person/company found in two chunks (or twice on one page): keep the first. */
export function dedupeLeads<T extends { name?: string; company?: string; email?: string }>(leads: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const l of leads) {
    const email = (l.email || "").trim().toLowerCase();
    const name = (l.name || "").trim().toLowerCase();
    const key = email || `${name}|${(l.company || "").trim().toLowerCase()}`;
    if (!key.replace("|", "") || seen.has(key)) continue;
    seen.add(key);
    out.push(l);
  }
  return out;
}
