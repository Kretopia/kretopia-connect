// Scout's engine: public job feeds that need no API key, plus the scoring and
// filtering every source goes through.
//
// Why this exists: scout-gigs used to refuse to run at all ("Scout not
// configured", HTTP 500) when the Firecrawl or AI key was missing, and its AI
// step returned nothing when the gateway had no credit. Scout is now built so
// that no key is *required*:
//
//   feeds (no key, free)  ->  scored here, deterministic
//   Firecrawl (key)       ->  more boards, optional
//   AI (key + credit)     ->  better extraction of Firecrawl pages, optional
//
// Pure functions only (no Deno globals, no remote imports) so the unit tests can
// import this file directly.
//
// Terms of the feeds, honoured by construction: every candidate keeps its
// original URL as the apply link, names its source ("Remote OK", "Jobicy",
// "We Work Remotely", "Arbeitnow") and the app shows "Verify on <source>".
// Remotive is deliberately NOT used: its terms forbid showing its jobs behind a
// sign-up wall.

export type ScoutSource = "web" | "linkedin" | "instagram" | "ats" | "gigboard";

export interface ScoutProfile {
  role: string | null;
  sub_roles: string[] | null;
  skills: string[] | null;
  location: string | null;
  bio: string | null;
}

export interface ScoutPrefsLite {
  extra_keywords: string[] | null;
  exclude_keywords: string[] | null;
  remote_only: boolean;
  min_fit_score: number;
  job_types: string[] | null;
  employment_types: string[] | null;
  locations: string[] | null;
  travel_ok: boolean;
}

export interface ScoutCandidate {
  source: ScoutSource;
  source_name: string;
  source_url: string;
  apply_url: string;
  title: string;
  company: string | null;
  location: string | null;
  remote: boolean;
  description: string | null;
  compensation: string | null;
  /** ISO timestamp the board says the job was posted, or null when unknown. */
  posted_at: string | null;
  tags: string[];
  /** Page image when the source had one (Firecrawl); feeds carry none. */
  image_url?: string | null;
}

export interface ScoredCandidate extends ScoutCandidate {
  fit_score: number;
  fit_reason: string;
}

// ── text helpers ────────────────────────────────────────────────────────────

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "'", lsquo: "'",
  rdquo: '"', ldquo: '"', ndash: "-", mdash: "-", hellip: "...", bull: "-", middot: "·",
};

export function decodeEntities(input: string): string {
  return input.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, body: string) => {
    if (body[0] === "#") {
      const code = body[1].toLowerCase() === "x" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? match;
  });
}

/** HTML (possibly entity-escaped, as Arbeitnow and We Work Remotely send it) to plain text. */
export function htmlToText(input: string | null | undefined): string {
  if (!input) return "";
  let text = decodeEntities(String(input));
  text = text
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\s*(br|\/p|\/div|\/li|\/h[1-6]|\/tr)\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  text = decodeEntities(text);
  return text.replace(/[ \t\f\v ]+/g, " ").replace(/\s*\n\s*/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Word-start match, so "animat" finds "animation"/"animator" but "ux" does not find "luxury". */
export function hasTerm(text: string, term: string): boolean {
  if (!text || !term) return false;
  const t = term.toLowerCase().trim();
  if (!t) return false;
  const re = t.length <= 3 ? new RegExp(`\\b${escapeRegExp(t)}\\b`, "i") : new RegExp(`\\b${escapeRegExp(t)}`, "i");
  return re.test(text);
}

// ── relevance vocabulary ────────────────────────────────────────────────────

/** Work Scout is for. Used when the profile is thin, and as a weak signal otherwise. */
export const CREATIVE_TERMS = [
  "designer", "illustrat", "animat", "motion", "videograph", "video editor", "video producer", "film", "cinemat",
  "photograph", "copywrit", "writer", "content creator", "content designer", "content producer", "producer",
  "music", "audio", "sound", "composer", "artist", "art director", "creative director", "brand designer",
  "graphic", "ux", "ui", "3d", "vfx", "podcast", "social media", "storyboard", "influencer", "colorist",
  "stylist", "casting", "voice", "narrator", "concept art", "typograph", "packaging", "editor",
];

const GENERIC_ROLES = new Set(["creative", "creator", "freelancer", "freelance", "professional", "artist", "other"]);
const STOP_WORDS = new Set([
  "the", "and", "for", "with", "from", "that", "this", "your", "you", "are", "all", "any", "work", "worker",
  "senior", "junior", "lead", "head", "manager", "team", "remote", "full", "time", "part", "contract",
]);

/**
 * A list of words from a database column that is not always a list of strings.
 * profiles.professional_skills is jsonb: 31 profiles hold strings, 53 hold
 * objects ({ skill, category, level }), 51 hold nothing. Strings pass through,
 * objects give their skill/name/label/title/value, everything else is dropped.
 * (Reading `.toLowerCase()` on an object is what made a Scout run fail with
 * "(value ?? '').toLowerCase is not a function" for most profiles with skills.)
 */
const TEXT_KEYS = ["skill", "name", "label", "title", "value"];
export function toTextList(value: unknown): string[] {
  const items = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  const out: string[] = [];
  for (const item of items) {
    if (typeof item === "string") {
      if (item.trim()) out.push(item.trim());
    } else if (item && typeof item === "object") {
      const rec = item as Record<string, unknown>;
      const key = TEXT_KEYS.find((k) => typeof rec[k] === "string" && (rec[k] as string).trim());
      if (key) out.push((rec[key] as string).trim());
    }
  }
  return out;
}

export function profileTerms(profile: ScoutProfile, prefs: ScoutPrefsLite): { strong: string[]; weak: boolean } {
  const out = new Set<string>();
  const add = (value: unknown) => {
    if (typeof value !== "string") return; // never trust a column's shape
    const phrase = value.toLowerCase().replace(/\s+/g, " ").trim();
    if (phrase.length < 2 || phrase.length > 40) return;
    if (GENERIC_ROLES.has(phrase)) return;
    out.add(phrase);
    // also the individual words, so "Motion Designer" matches "Designer, Motion"
    for (const word of phrase.split(/[\s/,&+-]+/)) {
      if (word.length >= 4 && !STOP_WORDS.has(word) && !GENERIC_ROLES.has(word)) out.add(word);
    }
  };
  (prefs.job_types ?? []).forEach(add);
  add(profile.role);
  (profile.sub_roles ?? []).forEach(add);
  (profile.skills ?? []).slice(0, 12).forEach(add);
  (prefs.extra_keywords ?? []).forEach(add);
  const strong = Array.from(out).slice(0, 30);
  return { strong, weak: strong.length < 2 };
}

// ── eligibility (moved from scout-gigs so it is testable) ───────────────────

const RESTRICTIONS: Array<[RegExp, RegExp]> = [
  [/\b(women|female)[- ]only|for women\b|young women|women entrepreneurs?|women in tech|she\/her only/i, /\b(she\/her|woman|female)\b/i],
  [/\b(men|male)[- ]only|for men\b/i, /\b(he\/him|man|male)\b/i],
  [/\bblack[- ](creators?|founders?|artists?|women|men)\b|black-only|for black\b/i, /\bblack\b/i],
  [/\blatin[ax][- ]/i, /\blatin[ax]\b/i],
  [/\bindigenous[- ]/i, /\bindigenous\b/i],
  [/\bstudents? only|current students?\b/i, /\bstudent\b/i],
  [/\balumni only\b/i, /\balumni\b/i],
  [/\bunder[- ]?(18|21|25|30)\b|youth only/i, /\b(youth|under)\b/i],
];

const REGION_RE = /\b(?:based in|residents? of|citizens? of|located in|from)\s+(africa|asia|europe|usa|united states|canada|uk|india|nigeria|kenya|south africa|brazil|mexico)\b/;

/** False when the posting restricts who may apply and the profile does not clearly match. */
export function isEligible(blob: string, profileBlob: string): boolean {
  const text = blob.toLowerCase();
  const prof = profileBlob.toLowerCase();
  for (const [needle, profMatch] of RESTRICTIONS) {
    if (needle.test(text) && !profMatch.test(prof)) return false;
  }
  const region = text.match(REGION_RE);
  if (region && !prof.includes(region[1])) return false;
  return true;
}

export function profileBlob(profile: ScoutProfile): string {
  return `${profile.bio || ""} ${(profile.sub_roles || []).join(" ")} ${profile.role || ""} ${profile.location || ""}`;
}

// ── url / dedupe / freshness ────────────────────────────────────────────────

/** True for listing/search/category pages: anything that is not ONE posting. */
export function isGenericListingUrl(u: string): boolean {
  if (!u) return true;
  try {
    const url = new URL(u);
    const path = url.pathname.replace(/\/+$/, "").toLowerCase();
    if (!path) return true;
    const segs = path.split("/").filter(Boolean);
    const last = segs[segs.length - 1] || "";
    const generic = new Set([
      "jobs", "job", "careers", "career", "search", "browse", "explore", "listings",
      "opportunities", "gigs", "work", "hiring", "tags", "tag", "category", "categories",
      "feed", "home", "casting", "castings", "openings", "positions", "postings", "apply",
    ]);
    if (generic.has(last)) return true;
    if (segs.length < 2 && last.length < 8) return true;
    if (url.search && /[?&](q|query|keyword|search)=/.test(url.search) && segs.length <= 2) return true;
    if (/linkedin\.com$/.test(url.hostname.replace(/^www\./, "")) && !/\/jobs\/view\//.test(path)) return true;
    return false;
  } catch {
    return true;
  }
}

export function dedupeKey(g: { source_url: string; title: string }): string {
  const url = (g.source_url || "").split("?")[0].split("#")[0].toLowerCase();
  const title = (g.title || "").toLowerCase().replace(/\s+/g, " ").trim().slice(0, 80);
  return `${url}::${title}`;
}

export function ageInDays(postedAt: string | null, now: Date): number | null {
  if (!postedAt) return null;
  const t = Date.parse(postedAt);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, (now.getTime() - t) / 86_400_000);
}

export function postedLabel(postedAt: string | null, now: Date): string {
  const d = ageInDays(postedAt, now);
  if (d === null) return "";
  if (d < 1) return "today";
  if (d < 2) return "yesterday";
  return `${Math.floor(d)} days ago`;
}

// ── scoring ─────────────────────────────────────────────────────────────────

const MAX_AGE_DAYS = 14;

const OPEN_LOCATION = /^$|\b(worldwide|anywhere|global|international|distributed|remote)\b/i;

function locationFit(c: ScoutCandidate, profile: ScoutProfile, prefs: ScoutPrefsLite): { ok: boolean; bonus: number; note: string } {
  const wanted = (prefs.locations ?? []).filter(Boolean);
  const own = (profile.location ?? "").trim();
  const places = (wanted.length ? wanted : own ? [own] : []).map((p) => p.toLowerCase());
  const where = (c.location ?? "").toLowerCase();
  // Any part of "Paris, France" counts: a job open to "France" or "Paris" is near.
  const nearby = places.some((p) => p.split(",").some((part) => part.trim().length >= 3 && where.includes(part.trim())));

  if (c.remote) {
    // Remote, but some boards restrict it to a region ("USA", "Germany"): still
    // shown, flagged and scored lower unless the region matches the person.
    const openToAll = OPEN_LOCATION.test(c.location ?? "");
    if (openToAll || !places.length || nearby) return { ok: true, bonus: 6, note: openToAll ? "Remote" : `Remote (${c.location})` };
    return { ok: true, bonus: -12, note: `Remote, open to ${c.location}` };
  }
  if (prefs.remote_only) return { ok: false, bonus: 0, note: "" };

  // A page that does not say where the work is (a Firecrawl result) is not evidence it is elsewhere.
  if (!places.length || !where) return { ok: true, bonus: 0, note: c.location ?? "" };
  if (nearby) return { ok: true, bonus: 8, note: c.location ?? "" };
  // Somewhere else, on site: only when the person said they would travel.
  return { ok: !!prefs.travel_ok, bonus: 0, note: c.location ?? "" };
}

/**
 * Score one candidate against the profile. Returns null when it should not be
 * shown at all (stale, excluded, ineligible, wrong place, not relevant).
 */
export function scoreCandidate(
  c: ScoutCandidate,
  profile: ScoutProfile,
  prefs: ScoutPrefsLite,
  now: Date = new Date(),
): ScoredCandidate | null {
  const age = ageInDays(c.posted_at, now);
  if (age !== null && age > MAX_AGE_DAYS) return null;

  const title = c.title || "";
  const tagText = c.tags.join(" ");
  const body = `${c.description ?? ""} ${c.company ?? ""}`;
  const everything = `${title} ${tagText} ${body}`;

  if ((prefs.exclude_keywords ?? []).some((kw) => kw && everything.toLowerCase().includes(kw.toLowerCase()))) return null;
  if (!isEligible(everything, profileBlob(profile))) return null;

  const loc = locationFit(c, profile, prefs);
  if (!loc.ok) return null;

  const { strong, weak } = profileTerms(profile, prefs);
  const titleHits = strong.filter((t) => hasTerm(title, t));
  const tagHits = strong.filter((t) => !titleHits.includes(t) && hasTerm(tagText, t));
  const bodyHits = strong.filter((t) => !titleHits.includes(t) && !tagHits.includes(t) && hasTerm(body, t));
  // The job's own title has to name a craft; tags and levels ("Director") do not count.
  const lexTitle = CREATIVE_TERMS.find((t) => hasTerm(title, t));

  // Relevance gate: something about the work itself has to line up.
  if (!titleHits.length && !tagHits.length && !(weak && lexTitle)) return null;

  let score = 40;
  score += Math.min(titleHits.length, 2) * 14;
  score += Math.min(tagHits.length, 3) * 5;
  score += Math.min(bodyHits.length, 3) * 3;
  if (!titleHits.length && !tagHits.length) score += 20; // thin profile, matched on the vocabulary of the craft
  else if (lexTitle) score += 3;
  score += loc.bonus;
  if (c.compensation) score += 4;
  if (age !== null) score += age <= 2 ? 8 : age <= 7 ? 5 : 2;
  score = Math.max(0, Math.min(96, Math.round(score)));

  // "motion designer" already says "motion" and "designer": show the longest phrase only.
  const hits = [...titleHits, ...tagHits];
  const matched = hits.filter((t) => !hits.some((o) => o !== t && o.includes(t))).slice(0, 3);
  const bits: string[] = [];
  if (matched.length) bits.push(`Matches your ${matched.map((m) => `“${m}”`).join(", ")}`);
  else if (lexTitle) bits.push(`Fits the kind of work you do (“${lexTitle}”)`);
  if (loc.note) bits.push(loc.note);
  const when = postedLabel(c.posted_at, now);
  if (when) bits.push(`posted ${when}`);
  if (c.compensation) bits.push(c.compensation);

  return { ...c, fit_score: score, fit_reason: `${bits.join(" · ")}.` };
}

// ── feed parsers ────────────────────────────────────────────────────────────

const asArray = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x)) : typeof v === "string" && v ? [v] : []);
const isoOrNull = (v: unknown): string | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  const ms = Number.isFinite(n) && n > 0 ? (n < 1e12 ? n * 1000 : n) : Date.parse(String(v));
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
};
const money = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(Math.round(n)));

function range(min: unknown, max: unknown, currency: string, period: string): string | null {
  const lo = Number(min);
  const hi = Number(max);
  if (!(lo > 0) && !(hi > 0)) return null;
  const symbol = currency === "USD" ? "$" : currency === "EUR" ? "€" : currency === "GBP" ? "£" : `${currency} `;
  if (lo > 0 && hi > 0 && hi !== lo) return `${symbol}${money(lo)}–${symbol}${money(hi)} / ${period}`;
  return `${symbol}${money(hi > 0 ? hi : lo)} / ${period}`;
}

export function parseRemoteOk(json: unknown, name = "Remote OK"): ScoutCandidate[] {
  if (!Array.isArray(json)) return [];
  const out: ScoutCandidate[] = [];
  for (const it of json as Array<Record<string, unknown>>) {
    if (!it || typeof it !== "object" || !it.position || !(it.url || it.apply_url)) continue; // [0] is the legal notice
    const url = String(it.url || it.apply_url);
    out.push({
      source: "gigboard",
      source_name: name,
      source_url: url,
      apply_url: String(it.apply_url || url),
      title: htmlToText(String(it.position)),
      company: it.company ? htmlToText(String(it.company)) : null,
      location: it.location ? htmlToText(String(it.location)) : null,
      remote: true,
      description: clip(htmlToText(String(it.description ?? "")), 900) || null,
      compensation: range(it.salary_min, it.salary_max, "USD", "year"),
      posted_at: isoOrNull(it.date) ?? isoOrNull(it.epoch),
      tags: asArray(it.tags),
    });
  }
  return out;
}

export function parseJobicy(json: unknown, name = "Jobicy"): ScoutCandidate[] {
  const jobs = (json as { jobs?: unknown } | null)?.jobs;
  if (!Array.isArray(jobs)) return [];
  const out: ScoutCandidate[] = [];
  for (const it of jobs as Array<Record<string, unknown>>) {
    if (!it?.jobTitle || !it.url) continue;
    const geo = asArray(it.jobGeo).join(", ");
    out.push({
      source: "gigboard",
      source_name: name,
      source_url: String(it.url),
      apply_url: String(it.url),
      title: htmlToText(String(it.jobTitle)),
      company: it.companyName ? htmlToText(String(it.companyName)) : null,
      location: geo || "Remote",
      remote: true,
      description: clip(htmlToText(String(it.jobDescription ?? it.jobExcerpt ?? "")), 900) || null,
      compensation: range(it.annualSalaryMin ?? it.salaryMin, it.annualSalaryMax ?? it.salaryMax, String(it.salaryCurrency || "USD"), "year"),
      posted_at: isoOrNull(it.pubDate),
      // jobLevel ("Director", "Senior") describes seniority, not the craft, so it is not a tag.
      tags: [...asArray(it.jobIndustry), ...asArray(it.jobType)].map((t) => htmlToText(t)),
    });
  }
  return out;
}

export function parseArbeitnow(json: unknown, name = "Arbeitnow"): ScoutCandidate[] {
  const data = (json as { data?: unknown } | null)?.data;
  if (!Array.isArray(data)) return [];
  const out: ScoutCandidate[] = [];
  for (const it of data as Array<Record<string, unknown>>) {
    if (!it?.title || !it.url) continue;
    out.push({
      source: "gigboard",
      source_name: name,
      source_url: String(it.url),
      apply_url: String(it.url),
      title: htmlToText(String(it.title)),
      company: it.company_name ? htmlToText(String(it.company_name)) : null,
      location: it.location ? htmlToText(String(it.location)) : null,
      remote: it.remote === true,
      description: clip(htmlToText(String(it.description ?? "")), 900) || null,
      compensation: null,
      posted_at: isoOrNull(it.created_at),
      tags: [...asArray(it.tags), ...asArray(it.job_types)].map((t) => htmlToText(t)),
    });
  }
  return out;
}

function xmlTag(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i"));
  if (!m) return "";
  return m[1].replace(/^\s*<!\[CDATA\[/, "").replace(/\]\]>\s*$/, "").trim();
}

export function parseWeWorkRemotely(xml: string, name = "We Work Remotely"): ScoutCandidate[] {
  if (typeof xml !== "string" || !xml.includes("<item")) return [];
  const out: ScoutCandidate[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const block = m[1];
    const rawTitle = htmlToText(xmlTag(block, "title"));
    const link = htmlToText(xmlTag(block, "link")) || htmlToText(xmlTag(block, "guid"));
    if (!rawTitle || !/^https?:\/\//.test(link)) continue;
    // "Company: Role"
    const split = rawTitle.indexOf(":");
    const company = split > 0 ? rawTitle.slice(0, split).trim() : null;
    const title = split > 0 ? rawTitle.slice(split + 1).trim() : rawTitle;
    const region = htmlToText(xmlTag(block, "region"));
    out.push({
      source: "gigboard",
      source_name: name,
      source_url: link,
      apply_url: link,
      title,
      company,
      location: region || "Remote",
      remote: true,
      description: clip(htmlToText(xmlTag(block, "description")), 900) || null,
      compensation: null,
      posted_at: isoOrNull(htmlToText(xmlTag(block, "pubDate"))),
      tags: [htmlToText(xmlTag(block, "category")), htmlToText(xmlTag(block, "type")), htmlToText(xmlTag(block, "skills"))].filter(Boolean),
    });
  }
  return out;
}

// ── fetching ────────────────────────────────────────────────────────────────

const FEED_TIMEOUT_MS = 8000;
const FEED_TTL_MS = 20 * 60_000;
const UA = "Mozilla/5.0 (compatible; KretopiaScout/1.0; +https://www.kretopia.com)";

// One warm isolate serves many users; a feed that only changes hourly is
// fetched once per TTL, not once per scan.
const cache = new Map<string, { at: number; value: unknown }>();

/** For tests: a feed fetched by an earlier test must not answer the next one. */
export function clearFeedCache() {
  cache.clear();
}

async function fetchBody(url: string, kind: "json" | "text", fetchImpl: typeof fetch): Promise<unknown> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < FEED_TTL_MS) return hit.value;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FEED_TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, { headers: { "User-Agent": UA, Accept: kind === "json" ? "application/json" : "application/rss+xml, text/xml, */*" }, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const value = kind === "json" ? await res.json() : await res.text();
    cache.set(url, { at: Date.now(), value });
    return value;
  } finally {
    clearTimeout(timer);
  }
}

export interface FeedReport {
  name: string;
  ok: boolean;
  count: number;
  error?: string;
}

export interface FeedResult {
  candidates: ScoutCandidate[];
  report: FeedReport[];
}

/** Query terms a feed can use to narrow itself (Jobicy takes a tag). */
function feedTags(profile: ScoutProfile, prefs: ScoutPrefsLite): string[] {
  const { strong } = profileTerms(profile, prefs);
  return strong.filter((t) => /^[a-z0-9 -]{3,24}$/.test(t)).slice(0, 2).map((t) => t.replace(/\s+/g, "-"));
}

/**
 * Fetch every public feed in parallel. One feed being down, slow or rate
 * limited costs only its own results; the report says which.
 */
export async function loadPublicFeeds(
  profile: ScoutProfile,
  prefs: ScoutPrefsLite,
  fetchImpl: typeof fetch = fetch,
): Promise<FeedResult> {
  const jobicyBase = "https://jobicy.com/api/v2/remote-jobs?count=50";
  const jobs: Array<{ name: string; run: () => Promise<ScoutCandidate[]> }> = [
    { name: "Remote OK", run: async () => parseRemoteOk(await fetchBody("https://remoteok.com/api", "json", fetchImpl)) },
    { name: "We Work Remotely (design)", run: async () => parseWeWorkRemotely(String(await fetchBody("https://weworkremotely.com/categories/remote-design-jobs.rss", "text", fetchImpl))) },
    { name: "We Work Remotely (marketing)", run: async () => parseWeWorkRemotely(String(await fetchBody("https://weworkremotely.com/categories/remote-sales-and-marketing-jobs.rss", "text", fetchImpl))) },
    { name: "Jobicy (design)", run: async () => parseJobicy(await fetchBody(`${jobicyBase}&industry=design-multimedia`, "json", fetchImpl)) },
    { name: "Jobicy (marketing)", run: async () => parseJobicy(await fetchBody(`${jobicyBase}&industry=marketing`, "json", fetchImpl)) },
    { name: "Arbeitnow", run: async () => parseArbeitnow(await fetchBody("https://www.arbeitnow.com/api/job-board-api", "json", fetchImpl)) },
  ];
  for (const tag of feedTags(profile, prefs)) {
    jobs.push({ name: `Jobicy (${tag})`, run: async () => parseJobicy(await fetchBody(`${jobicyBase}&tag=${encodeURIComponent(tag)}`, "json", fetchImpl)) });
  }

  const settled = await Promise.allSettled(jobs.map((j) => j.run()));
  const candidates: ScoutCandidate[] = [];
  const report: FeedReport[] = [];
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") {
      candidates.push(...r.value);
      report.push({ name: jobs[i].name, ok: true, count: r.value.length });
    } else {
      report.push({ name: jobs[i].name, ok: false, count: 0, error: r.reason instanceof Error ? r.reason.message : String(r.reason) });
    }
  });
  return { candidates, report };
}

/** Score, filter, de-duplicate and rank. Best first. */
export function rankCandidates(
  candidates: ScoutCandidate[],
  profile: ScoutProfile,
  prefs: ScoutPrefsLite,
  now: Date = new Date(),
): ScoredCandidate[] {
  const seen = new Set<string>();
  const scored: ScoredCandidate[] = [];
  for (const c of candidates) {
    if (isGenericListingUrl(c.apply_url) && isGenericListingUrl(c.source_url)) continue;
    const key = dedupeKey(c);
    if (seen.has(key)) continue;
    const s = scoreCandidate(c, profile, prefs, now);
    if (!s || s.fit_score < prefs.min_fit_score) continue;
    seen.add(key);
    scored.push(s);
  }
  return scored.sort((a, b) => b.fit_score - a.fit_score || Date.parse(b.posted_at ?? "") - Date.parse(a.posted_at ?? ""));
}

/**
 * Firecrawl page to a candidate without AI. The search already limited results
 * to the past week (tbs=qdr:w), but the page's own date is unknown, so
 * posted_at stays null: nothing here claims "posted today".
 */
const ARTICLE_TITLE = /(^|\s)(top|best)\s+\d+|\bhow to\b|\bguide\b|\btips\b|\bjobs? (in|near|at)\b|\bvacancies\b|\bhiring now\b|\bsalary\b|\bsalaries\b|\bcareers?\s*$/i;

export function firecrawlToCandidate(
  item: { url: string; title?: string; markdown?: string; description?: string; image_url?: string | null },
  source: ScoutSource,
): ScoutCandidate | null {
  if (!item?.url || !item.title) return null;
  // Roundups, guides and category pages are not one posting.
  if (ARTICLE_TITLE.test(item.title)) return null;
  let host = "";
  try {
    host = new URL(item.url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
  const title = htmlToText(item.title).split(/\s[|–—-]\s/)[0].trim();
  if (title.length < 4) return null;
  const description = clip(htmlToText(item.description || item.markdown || "").replace(/!\[[^\]]*\]\([^)]*\)/g, ""), 700);
  return {
    source,
    source_name: host,
    source_url: item.url,
    apply_url: item.url,
    title,
    company: null,
    location: null,
    remote: /\bremote\b/i.test(`${item.title} ${description}`),
    description: description || null,
    compensation: null,
    posted_at: null,
    tags: [],
    image_url: item.image_url ?? null,
  };
}
