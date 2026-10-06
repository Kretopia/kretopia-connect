// Pure helpers for scout-leads and the Leads tab (no imports, so they are
// unit-testable and usable on both sides).

type LeadLike = { name?: unknown; company?: unknown; email?: unknown };

/** Split into at most `parts` chunks of near-equal size, but never into chunks
 *  smaller than `minPerPart` items: a handful of results is one call, not three. */
export function splitEvenly<T>(items: T[], parts: number, minPerPart = 8): T[][] {
  const n = Math.max(1, Math.min(parts, Math.floor(items.length / minPerPart)));
  const size = Math.max(1, Math.ceil(items.length / n));
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();

/**
 * What makes two leads "the same person": the email when there is one,
 * otherwise name + company (case and surrounding spaces ignored).
 * Returns "" when there is nothing to identify the lead by.
 */
export function leadKey(l: LeadLike): string {
  const email = norm(l.email);
  if (email) return `e:${email}`;
  const name = norm(l.name);
  if (!name) return "";
  return `n:${name}|${norm(l.company)}`;
}

/** Every key a lead can be recognised by: its email AND its name + company. */
export function leadKeys(l: LeadLike): string[] {
  const keys: string[] = [];
  const email = norm(l.email);
  if (email) keys.push(`e:${email}`);
  const name = norm(l.name);
  if (name) keys.push(`n:${name}|${norm(l.company)}`);
  return keys;
}

/** Is this lead already known, by email or by name + company? */
export function isKnownLead(l: LeadLike, known: Set<string>): boolean {
  return leadKeys(l).some((k) => known.has(k));
}

/** Remember a lead (all its keys) so later leads can be compared against it. */
export function rememberLead(l: LeadLike, known: Set<string>): void {
  for (const k of leadKeys(l)) known.add(k);
}

/** The set of keys for a list of saved leads. */
export function knownLeadKeys(saved: LeadLike[]): Set<string> {
  const known = new Set<string>();
  for (const l of saved) rememberLead(l, known);
  return known;
}

/** Same person/company found in two chunks (or twice on one page): keep the first. */
export function dedupeLeads<T extends LeadLike>(leads: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const l of leads) {
    const key = leadKey(l);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(l);
  }
  return out;
}

/** Items whose lead is not already saved (`fresh`) vs already saved (`existing`).
 *  Items with no identifying key are treated as fresh: nothing to compare. */
export function splitByExisting<T extends LeadLike>(items: T[], known: Set<string>): { fresh: T[]; existing: T[] } {
  const fresh: T[] = [];
  const existing: T[] = [];
  for (const item of items) (isKnownLead(item, known) ? existing : fresh).push(item);
  return { fresh, existing };
}
