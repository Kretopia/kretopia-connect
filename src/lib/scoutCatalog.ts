// The catalog behind Scout's "All sources" tab: every opportunity Kretopia can show, from every source, in one normalised shape that
// is classified (family, level, working mode, language) and can be searched, filtered and counted. Pure: the screen reads, this decides.
//
// Two kinds of rows go in: gigs a curator approved after they were found outside Kretopia (the public view, one per source), and the
// open gigs posted on Kretopia itself. Nothing is invented: a pay line only exists when the record states one, a date only when the
// source gave it, and every external row keeps the link to its own page.

import { categoryOf, classifyOpportunity, cleanTitle, type CategoryGroup, type CategoryId, type Language, type Level, type WorkMode } from "./opportunityTaxonomy";
import { hasRealCompensation } from "./scoutPay";
import type { ScoutedGig } from "@/components/scout/scout.types";
import { sourceDisplayName, sourceLinkHref, sourceLinkRel } from "../../supabase/functions/_shared/discovery/labels";

export type PayPeriod = "hour" | "day" | "week" | "month" | "year";
export interface Budget {
  min: number | null;
  max: number | null;
  currency: string;
  period: PayPeriod;
}

/** A row of the public external-listings view, the columns Scout reads. */
export interface ExternalRow {
  id: string;
  title: string;
  original_publisher: string | null;
  location: string | null;
  remote_scope: string | null;
  source_published_at: string | null;
  deadline_at: string | null;
  apply_url: string | null;
  excerpt: string | null;
  last_checked_at: string | null;
  source_provider: string | null;
  claimed: boolean;
  budget: Budget | null;
}

/** An open gig posted on Kretopia. */
export interface KretopiaRow {
  id: string;
  title: string;
  type: string | null;
  description: string | null;
  compensation: string | null;
  location: string | null;
  created_at: string | null;
  image_url?: string | null;
}

/** The same job as another posting of the same company and title, for another place. */
export interface OtherPlace {
  id: string;
  place: string | null;
  openUrl: string | null;
  detailTo: string;
}

export interface CatalogItem {
  /** Unique across both origins. */
  id: string;
  origin: "external" | "kretopia";
  sourceId: string;
  sourceName: string;
  title: string;
  image?: string | null;
  company: string | null;
  /** For the card: a long list of places is cut to the first two and a count. */
  location: string | null;
  /** Every place as the source wrote it (all of this job's places when it is posted for several), for the tooltip and the search. */
  locationFull: string | null;
  /** The same job posted for other places: this card stands for all of them. */
  more: OtherPlace[];
  workMode: WorkMode;
  level: Level | null;
  category: CategoryId;
  /** Other families the title names just as plainly. */
  alsoIn: CategoryId[];
  group: CategoryGroup;
  language: Language;
  pay: string | null;
  /** When the source says the job went up; null when it did not say. */
  postedAt: string | null;
  /** When Kretopia last looked at it, for external rows. */
  seenAt: string | null;
  /** Newest first: the posting date, else the last look. */
  sortAt: number;
  excerpt: string | null;
  claimed: boolean;
  /** Kretopia's own page for it. */
  detailTo: string;
  /** The publisher's own page (external rows). */
  openUrl: string | null;
  openRel: string;
}

export const KRETOPIA_SOURCE = "kretopia";

// ── Pay ───────────────────────────────────────────────────────────────────────────────────────────────────

const PERIOD_SHORT: Record<PayPeriod, string> = { hour: "hr", day: "day", week: "wk", month: "mo", year: "yr" };

/**
 * 128000 -> "128K", 27500 -> "27.5K", 2500000 -> "2.5M". Done by hand: Intl's compact notation prints "$128.0K" on some engines and
 * "$128K" on others (the fraction digits of a currency leak into it), and a pay line must read the same everywhere.
 */
export function compactAmount(n: number): string {
  const unit = (v: number, u: string) => `${Number(v.toFixed(1))}${u}`;
  const abs = Math.abs(n);
  if (abs >= 1e9) return unit(n / 1e9, "B");
  if (abs >= 1e6) return unit(n / 1e6, "M");
  if (abs >= 1e3) return unit(n / 1e3, "K");
  return String(Number(n.toFixed(2)));
}

/** The currency's own symbol ("$", "€", "CA$"); a code the engine does not know is printed as the code, then a space. */
function currencySymbol(currency: string): string {
  try {
    const part = new Intl.NumberFormat("en", { style: "currency", currency }).formatToParts(1).find((p) => p.type === "currency");
    const symbol = part?.value || currency;
    return /^[A-Za-z]+$/.test(symbol) ? `${symbol} ` : symbol;
  } catch {
    return `${currency} `;
  }
}

const money = (n: number, currency: string): string => `${currencySymbol(currency)}${compactAmount(n)}`;

/** "$128K–$160K / yr": only from numbers a source stated with a currency code and a period; never guessed from text. */
export function payLabel(b: Budget | null | undefined): string | null {
  if (!b || (b.min == null && b.max == null)) return null;
  const lo = b.min != null ? money(b.min, b.currency) : null;
  const hi = b.max != null ? money(b.max, b.currency) : null;
  const range = lo && hi ? (lo === hi ? lo : `${lo}–${hi}`) : lo ? `from ${lo}` : `up to ${hi}`;
  return `${range} / ${PERIOD_SHORT[b.period] ?? b.period}`;
}

// ── Rows to items ─────────────────────────────────────────────────────────────────────────────────────────

/** "Belgium, Denmark, France, Germany, Ireland, UK" is not a place to print: the first two and how many more. A short place is kept as is. */
export function shortLocation(raw: string | null | undefined): string | null {
  const t = raw?.trim();
  if (!t) return null;
  const parts = t.split(/\s*[,;]\s*/).filter(Boolean);
  return parts.length <= 3 ? t : `${parts.slice(0, 2).join(", ")} +${parts.length - 2} more`;
}

const time = (iso: string | null): number | null => {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
};

export function externalToItem(r: ExternalRow): CatalogItem {
  const company = r.original_publisher?.trim() || null;
  const c = classifyOpportunity({ title: r.title, excerpt: r.excerpt, location: r.location, remote_scope: r.remote_scope });
  const provider = r.source_provider ?? "";
  const posted = time(r.source_published_at) != null ? r.source_published_at : null;
  return {
    id: `ext:${r.id}`,
    origin: "external",
    sourceId: provider || "external",
    sourceName: sourceDisplayName(provider || null) ?? "Other source",
    title: cleanTitle(r.title, company),
    company,
    location: shortLocation(r.location),
    locationFull: r.location?.trim() || null,
    more: [],
    workMode: c.workMode,
    level: c.level,
    category: c.category,
    alsoIn: c.alsoIn,
    group: c.group,
    language: c.language,
    pay: payLabel(r.budget),
    postedAt: posted,
    seenAt: r.last_checked_at,
    sortAt: time(posted) ?? time(r.last_checked_at) ?? 0,
    excerpt: r.excerpt?.trim() || null,
    claimed: r.claimed,
    detailTo: `/listing/${r.id}`,
    openUrl: r.apply_url ? sourceLinkHref(provider || null, r.apply_url) ?? null : null,
    openRel: sourceLinkRel(provider || null),
  };
}

export function kretopiaToItem(r: KretopiaRow): CatalogItem {
  const excerpt = r.description?.replace(/\s+/g, " ").trim().slice(0, 280) || null;
  const c = classifyOpportunity({ title: r.title, excerpt, location: r.location });
  const posted = time(r.created_at) != null ? r.created_at : null;
  return {
    id: `kre:${r.id}`,
    image: r.image_url,
    origin: "kretopia",
    sourceId: KRETOPIA_SOURCE,
    sourceName: "Kretopia",
    title: cleanTitle(r.title),
    company: null,
    location: shortLocation(r.location),
    locationFull: r.location?.trim() || null,
    more: [],
    workMode: c.workMode,
    level: c.level,
    category: c.category,
    alsoIn: c.alsoIn,
    group: c.group,
    language: c.language,
    pay: hasRealCompensation(r.compensation) ? r.compensation.trim() : null,
    postedAt: posted,
    seenAt: null,
    sortAt: time(posted) ?? 0,
    excerpt,
    claimed: false,
    detailTo: `/opportunity/${r.id}`,
    openUrl: null,
    openRel: "noopener noreferrer",
  };
}

const dupKey = (i: CatalogItem) => `${(i.company ?? "").toLowerCase()}|${i.title.toLowerCase()}|${(i.location ?? "").toLowerCase()}`;
const jobKey = (i: CatalogItem) => `${i.sourceId}|${(i.company ?? "").toLowerCase()}|${i.title.toLowerCase()}`;

/**
 * Both kinds of rows as one list, newest first.
 * - The same job under two sources (same company, title and place) shows once.
 * - The same job posted for several places by one company on one source (nine countries, nine postings) is ONE card: the newest posting
 *   is the card, the others are listed on it with their own links, and every place is searchable.
 */
export function buildCatalog(external: ExternalRow[], kretopia: KretopiaRow[]): CatalogItem[] {
  const all = [...external.map(externalToItem), ...kretopia.map(kretopiaToItem)].sort((a, b) => b.sortAt - a.sortAt || a.title.localeCompare(b.title));
  const seen = new Set<string>();
  const byJob = new Map<string, CatalogItem>();
  const out: CatalogItem[] = [];
  for (const it of all) {
    // A Kretopia gig has no company: it is never merged with an external row.
    if (it.origin !== "external") {
      out.push(it);
      continue;
    }
    const exact = dupKey(it);
    if (seen.has(exact)) continue;
    seen.add(exact);
    const first = byJob.get(jobKey(it));
    if (first && it.company) {
      first.more.push({ id: it.id, place: it.locationFull, openUrl: it.openUrl, detailTo: it.detailTo });
      continue;
    }
    byJob.set(jobKey(it), it);
    out.push(it);
  }
  // A card that stands for several places says so, and can be found by any of them.
  for (const it of out) {
    if (it.more.length === 0) continue;
    const places = [it.locationFull, ...it.more.map((m) => m.place)].filter((p): p is string => !!p);
    const unique = [...new Set(places)];
    it.locationFull = unique.join(", ") || null;
    it.location = shortLocation(it.locationFull);
  }
  return out;
}

/** Include the actual For You records, with their artwork; never invent matching IDs or fit claims. */
export function includeScoutedGigs(items: CatalogItem[], gigs: ScoutedGig[]): CatalogItem[] {
  const merged = [...items];
  for (const gig of gigs) {
    const index = merged.findIndex((item) => item.openUrl?.split("?")[0] === gig.source_url.split("?")[0] || (item.title.toLowerCase() === gig.title.toLowerCase() && item.company?.toLowerCase() === gig.company?.toLowerCase()));
    if (index >= 0) {
      merged[index] = { ...merged[index], image: gig.image_url ?? merged[index].image };
      continue;
    }
    const classified = classifyOpportunity({ title: gig.title, excerpt: gig.description, location: gig.location, remote_scope: gig.remote ? "remote" : null });
    merged.push({
      id: `scout:${gig.id}`, origin: "external", sourceId: gig.source, sourceName: gig.source_name || gig.source,
      title: gig.title, image: gig.image_url, company: gig.company, location: shortLocation(gig.location), locationFull: gig.location,
      more: [], workMode: classified.workMode, level: classified.level, category: classified.category, alsoIn: classified.alsoIn,
      group: classified.group, language: classified.language, pay: hasRealCompensation(gig.compensation) ? gig.compensation : null,
      postedAt: gig.posted_at ?? null, seenAt: null, sortAt: time(gig.posted_at ?? null) ?? time(gig.scouted_at) ?? 0,
      excerpt: gig.description, claimed: false, detailTo: gig.source_url, openUrl: gig.apply_url || gig.source_url, openRel: "noopener noreferrer",
    });
  }
  return merged.sort((a, b) => b.sortAt - a.sortAt);
}

// ── Filters and counts ────────────────────────────────────────────────────────────────────────────────────

export interface CatalogFilters {
  q: string;
  category: CategoryId | "all";
  /** Empty = every source. */
  sources: string[];
  workMode: WorkMode | "all";
  level: Level | "all";
  language: Language | "all";
  /** 0 = any time. */
  days: 0 | 7 | 14 | 30;
  payOnly: boolean;
}

export const NO_FILTERS: CatalogFilters = { q: "", category: "all", sources: [], workMode: "all", level: "all", language: "all", days: 0, payOnly: false };

export function filtersActive(f: CatalogFilters): boolean {
  return (Object.keys(NO_FILTERS) as (keyof CatalogFilters)[]).some((k) => JSON.stringify(f[k]) !== JSON.stringify(NO_FILTERS[k]));
}

const DAY = 86_400_000;

/** Does this item pass every filter, except the one named (so that filter's own counts can be shown next to it)? */
export function passes(item: CatalogItem, f: CatalogFilters, skip?: keyof CatalogFilters, now = Date.now()): boolean {
  if (skip !== "q" && f.q.trim()) {
    const hay = `${item.title} ${item.company ?? ""} ${item.locationFull ?? ""} ${item.sourceName} ${item.excerpt ?? ""} ${categoryOf(item.category).label}`.toLowerCase();
    if (!f.q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w))) return false;
  }
  if (skip !== "category" && f.category !== "all" && item.category !== f.category && !item.alsoIn.includes(f.category)) return false;
  if (skip !== "sources" && f.sources.length > 0 && !f.sources.includes(item.sourceId)) return false;
  if (skip !== "workMode" && f.workMode !== "all" && item.workMode !== f.workMode) return false;
  if (skip !== "level" && f.level !== "all" && item.level !== f.level) return false;
  if (skip !== "language" && f.language !== "all" && item.language !== f.language) return false;
  if (skip !== "days" && f.days > 0 && (item.sortAt === 0 || now - item.sortAt > f.days * DAY)) return false;
  if (skip !== "payOnly" && f.payOnly && !item.pay) return false;
  return true;
}

export const filterCatalog = (items: CatalogItem[], f: CatalogFilters, now = Date.now()): CatalogItem[] => items.filter((i) => passes(i, f, undefined, now));

export interface Facets {
  /** Items passing every filter. */
  total: number;
  /** Items passing every filter except the family: what "All" is counted as in the family list. */
  anyFamily: number;
  /** Per family, with every other filter applied; a posting also counts under the families it names as a second one. */
  categories: Map<CategoryId, number>;
  sources: Map<string, number>;
  workModes: Map<WorkMode, number>;
  levels: Map<Level, number>;
  languages: Map<Language, number>;
  /** How many of the items that pass the other filters state a pay. */
  paid: number;
}

const bump = <K,>(m: Map<K, number>, k: K) => m.set(k, (m.get(k) ?? 0) + 1);

/** The counts printed next to each filter: each is computed with all the OTHER filters applied, never its own. */
export function facets(items: CatalogItem[], f: CatalogFilters, now = Date.now()): Facets {
  const out: Facets = { total: 0, anyFamily: 0, categories: new Map(), sources: new Map(), workModes: new Map(), levels: new Map(), languages: new Map(), paid: 0 };
  for (const it of items) {
    if (passes(it, f, undefined, now)) out.total += 1;
    if (passes(it, f, "category", now)) {
      out.anyFamily += 1;
      bump(out.categories, it.category);
      for (const c of it.alsoIn) bump(out.categories, c);
    }
    if (passes(it, f, "sources", now)) bump(out.sources, it.sourceId);
    if (passes(it, f, "workMode", now)) bump(out.workModes, it.workMode);
    if (passes(it, f, "level", now) && it.level) bump(out.levels, it.level);
    if (passes(it, f, "language", now)) bump(out.languages, it.language);
    if (passes(it, f, "payOnly", now) && it.pay) out.paid += 1;
  }
  return out;
}

/** The items by their own family, families in the display order (creative first), newest first inside each. */
export function groupByCategory(items: CatalogItem[]): { id: CategoryId; items: CatalogItem[] }[] {
  const by = new Map<CategoryId, CatalogItem[]>();
  for (const it of items) by.set(it.category, [...(by.get(it.category) ?? []), it]);
  return [...by.entries()]
    .sort((a, b) => categoryOf(a[0]).order - categoryOf(b[0]).order)
    .map(([id, list]) => ({ id, items: list.sort((x, y) => y.sortAt - x.sortAt || x.title.localeCompare(y.title)) }));
}
