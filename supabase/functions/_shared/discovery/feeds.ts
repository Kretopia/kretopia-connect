// Approved public feeds as Scout candidates, through the SAME parsers Scout already uses, plus the feeds only discovery reads. Pure.
import { parseArbeitnow, parseJobicy, parseRemoteOk, parseWeWorkRemotely, type ScoutCandidate } from "../scoutSources.ts";

/** A candidate that may also carry what the source states structurally: an expiry date and a pay range. */
export interface FeedCandidate extends ScoutCandidate {
  /** ISO timestamp after which the source no longer lists the job. */
  expires_at?: string | null;
  /** A pay range the source states as numbers with a currency code and a period; never parsed out of free text. */
  budget?: { min: number | null; max: number | null; currency: string; period: "hour" | "day" | "week" | "month" | "year" } | null;
}

export function parseOpportunityFeed(adapterId: string, text: string): FeedCandidate[] {
  try {
    switch (adapterId) {
      case "remoteok": return parseRemoteOk(JSON.parse(text));
      case "jobicy": return parseJobicy(JSON.parse(text));
      case "arbeitnow": return parseArbeitnow(JSON.parse(text));
      case "weworkremotely": return parseWeWorkRemotely(text);
      case "himalayas": return parseHimalayas(JSON.parse(text));
      default: return [];
    }
  } catch {
    return []; // an unreadable feed is a failed run, never a partial success
  }
}

// ── Himalayas ─────────────────────────────────────────────────────────────────────────────────────────
// https://himalayas.app/docs/remote-jobs-api. Its terms (read 2026-10-29): free, no key; credit Himalayas with a visible link; every apply
// action goes to the job's own page on himalayas.app (applicationLink), never the employer's; show the jobs only on sites you operate; remove
// a job once it expires. So: the link is applicationLink, only the short excerpt is kept (never the description), the expiry date is the
// deadline, and the pay range is kept only when the source states it as numbers with a currency code.

const PERIODS: Record<string, "hour" | "day" | "week" | "month" | "year"> = { hourly: "hour", daily: "day", weekly: "week", monthly: "month", annual: "year", yearly: "year" };

const unixToIso = (v: unknown): string | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && /^\d{9,11}$/.test(v) ? Number(v) : null;
  if (n === null || !Number.isFinite(n)) return null;
  const d = new Date(n * 1000);
  return Number.isNaN(d.getTime()) || d.getUTCFullYear() < 2000 || d.getUTCFullYear() > 2100 ? null : d.toISOString();
};

const amount = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 && n < 1e9 ? n : null;
};

export function parseHimalayas(json: unknown): FeedCandidate[] {
  const jobs = (json as { jobs?: unknown } | null)?.jobs;
  if (!Array.isArray(jobs)) return [];
  const out: FeedCandidate[] = [];
  for (const it of jobs as Array<Record<string, unknown>>) {
    const link = typeof it?.applicationLink === "string" ? it.applicationLink : "";
    if (!it?.title || !/^https:\/\/himalayas\.app\//.test(link)) continue; // a job without its own Himalayas page cannot be credited or applied to
    const places = Array.isArray(it.locationRestrictions) ? (it.locationRestrictions as unknown[]).filter((x): x is string => typeof x === "string" && x.trim() !== "") : [];
    const min = amount(it.minSalary);
    const max = amount(it.maxSalary);
    const currency = typeof it.currency === "string" ? it.currency.trim().toUpperCase() : "";
    const period = typeof it.salaryPeriod === "string" ? PERIODS[it.salaryPeriod.toLowerCase()] : undefined;
    out.push({
      source: "gigboard",
      source_name: "Himalayas",
      source_url: link,
      apply_url: link,
      title: String(it.title),
      company: it.companyName ? String(it.companyName) : null,
      // A long list of countries is "many countries", not a location to print; no list at all is unknown, not "worldwide".
      location: places.length === 0 ? null : places.length <= 4 ? places.join(", ") : `${places.length} countries`,
      remote: true,
      description: typeof it.excerpt === "string" && it.excerpt.trim() !== "" ? it.excerpt.slice(0, 900) : null,
      compensation: null,
      posted_at: unixToIso(it.pubDate),
      tags: Array.isArray(it.parentCategories) ? (it.parentCategories as unknown[]).filter((x): x is string => typeof x === "string") : [],
      expires_at: unixToIso(it.expiryDate),
      budget: (min !== null || max !== null) && /^[A-Z]{3}$/.test(currency) && period ? { min, max, currency, period } : null,
    });
  }
  return out;
}
