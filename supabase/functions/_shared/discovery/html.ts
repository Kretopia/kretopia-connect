// Facts a page states about itself, read WITHOUT executing it. Pure.
//
// The page is untrusted text: it is parsed with string scanning, never rendered or evaluated, and what comes out is only
// raw extraction input for parseExtraction (which validates every field). Only the page's OWN structured data is used:
// schema.org JobPosting / Event in JSON-LD, then Open Graph. Nothing is guessed from body text, so an unknown fact
// stays unknown.

import { sanitizeText } from "./extract.ts";

const LD_BLOCK = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

function* ldObjects(html: string): Generator<Record<string, unknown>> {
  for (const m of html.matchAll(LD_BLOCK)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(m[1].trim());
    } catch {
      continue; // malformed JSON-LD is ignored, never repaired
    }
    const stack: unknown[] = [parsed];
    while (stack.length) {
      const v = stack.pop();
      if (Array.isArray(v)) stack.push(...v);
      else if (v && typeof v === "object") {
        const o = v as Record<string, unknown>;
        if (Array.isArray(o["@graph"])) stack.push(...(o["@graph"] as unknown[]));
        yield o;
      }
    }
  }
}

const typeOf = (o: Record<string, unknown>): string[] => (Array.isArray(o["@type"]) ? (o["@type"] as unknown[]) : [o["@type"]]).filter((t): t is string => typeof t === "string");
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
const nameOf = (v: unknown): string | null => (typeof v === "string" ? str(v) : v && typeof v === "object" ? str((v as Record<string, unknown>).name) : null);

function meta(html: string, key: string): string | null {
  const re = new RegExp(`<meta[^>]+(?:property|name)\\s*=\\s*["']${key}["'][^>]*>`, "i");
  const tag = html.match(re)?.[0];
  if (!tag) return null;
  return tag.match(/content\s*=\s*["']([^"']*)["']/i)?.[1] ?? null;
}

function placeText(v: unknown): string | null {
  const place = Array.isArray(v) ? v[0] : v;
  if (!place || typeof place !== "object") return str(place);
  const addr = (place as Record<string, unknown>).address;
  if (typeof addr === "string") return str(addr);
  if (addr && typeof addr === "object") {
    const a = addr as Record<string, unknown>;
    // Boards that have no real address repeat one word in every field ("Anywhere" x5): say it once.
    const seen = new Set<string>();
    const parts = [str(a.addressLocality), str(a.addressRegion), str(a.addressCountry)].filter((x): x is string => {
      if (!x) return false;
      const key = x.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return parts.join(", ") || null;
  }
  return nameOf(place);
}

const SALARY_PERIOD: Record<string, string> = { HOUR: "hour", DAY: "day", WEEK: "week", MONTH: "month", YEAR: "year" };
const amount = (v: unknown): number | null => (typeof v === "number" ? v : typeof v === "string" && /^\d+(?:\.\d+)?$/.test(v.trim()) ? Number(v) : null);

/**
 * schema.org baseSalary (MonetaryAmount) as raw budget input. Only what the page states: a range or a single amount, its
 * currency and its period. Whatever is missing or unreadable is passed on as null and parseExtraction refuses it with a
 * reason, so a stated salary is either read or reported as "left unknown", never dropped silently and never guessed.
 */
function salaryOf(v: unknown): PageBudget | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v !== "object") {
    // A bare number or text ("competitive") has no currency: pass it on so it is reported, not dropped.
    const n = amount(v);
    return { min: n, max: n, currency: "", period: null };
  }
  const m = v as Record<string, unknown>;
  const val = m.value && typeof m.value === "object" ? (m.value as Record<string, unknown>) : null;
  const single = amount(val ? val.value : m.value);
  const min = amount(val?.minValue) ?? single;
  const max = amount(val?.maxValue) ?? single;
  const unit = typeof val?.unitText === "string" ? val.unitText.trim().toUpperCase() : "";
  return { min, max, currency: typeof m.currency === "string" ? m.currency : "", period: SALARY_PERIOD[unit] ?? null };
}

export interface PageBudget {
  min: number | null;
  max: number | null;
  currency: string;
  period: string | null;
}

export interface PageFacts {
  kind: "gig" | "event" | null;
  title: string | null;
  original_publisher: string | null;
  location: string | null;
  remote_scope: "remote" | null;
  source_published_at: string | null;
  /**
   * When the listing stops being open. For a JobPosting this is the page's own `validThrough` (schema.org: "the date after
   * which the job posting is no longer valid"), which is the posting's expiry and not necessarily an application deadline.
   * The public view hides a listing after it, and the page labels it "Listed until".
   */
  deadline_at: string | null;
  starts_at: string | null;
  ends_at: string | null;
  apply_url: string | null;
  excerpt: string | null;
  budget: PageBudget | null;
  /** Where the facts came from, for provenance. */
  from: "json-ld" | "open-graph" | "none";
}

export function pageFacts(html: string): PageFacts {
  for (const o of ldObjects(html)) {
    const types = typeOf(o);
    if (types.includes("JobPosting")) {
      return {
        kind: "gig",
        title: str(o.title),
        original_publisher: nameOf(o.hiringOrganization),
        location: placeText(o.jobLocation),
        remote_scope: o.jobLocationType === "TELECOMMUTE" ? "remote" : null,
        source_published_at: str(o.datePosted),
        deadline_at: str(o.validThrough),
        starts_at: null,
        ends_at: null,
        apply_url: str(o.url),
        excerpt: sanitizeText(o.description, 600),
        budget: salaryOf(o.baseSalary),
        from: "json-ld",
      };
    }
    if (types.includes("Event")) {
      return {
        kind: "event",
        title: str(o.name),
        original_publisher: nameOf(o.organizer),
        location: placeText(o.location),
        remote_scope: null,
        source_published_at: null,
        deadline_at: null,
        starts_at: str(o.startDate),
        ends_at: str(o.endDate),
        apply_url: str(o.url),
        excerpt: sanitizeText(o.description, 600),
        budget: null,
        from: "json-ld",
      };
    }
  }
  const ogTitle = meta(html, "og:title");
  if (ogTitle) {
    return {
      kind: null, title: sanitizeText(ogTitle, 200), original_publisher: null, location: null, remote_scope: null, source_published_at: null,
      deadline_at: null, starts_at: null, ends_at: null, apply_url: null, excerpt: sanitizeText(meta(html, "og:description"), 600), budget: null, from: "open-graph",
    };
  }
  return { kind: null, title: null, original_publisher: null, location: null, remote_scope: null, source_published_at: null, deadline_at: null, starts_at: null, ends_at: null, apply_url: null, excerpt: null, budget: null, from: "none" };
}

export function factsToRaw(f: PageFacts, pageUrl: string, kind: "gig" | "event" | "talent"): Record<string, unknown> {
  return {
    kind: f.kind ?? kind,
    title: f.title,
    original_publisher: f.original_publisher,
    location: f.location,
    remote_scope: f.remote_scope,
    source_published_at: f.source_published_at,
    deadline_at: f.deadline_at,
    starts_at: f.starts_at,
    ends_at: f.ends_at,
    apply_url: f.apply_url ?? pageUrl, // "Apply at source": the page itself when it names no other destination
    excerpt: f.excerpt,
    budget: f.budget,
  };
}

/** A page corroborates a pasted draft when their titles are alike enough to be the same posting. */
export function corroborates(draftTitle: string, pageTitle: string | null): boolean {
  if (!pageTitle) return false;
  const tok = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9+#]+/g, " ").split(" ").filter((t) => t.length > 2));
  const a = tok(draftTitle);
  const b = tok(pageTitle);
  if (a.size === 0 || b.size === 0) return false;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  return inter / (a.size + b.size - inter) >= 0.6;
}
