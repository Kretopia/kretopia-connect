// Strict validation of an extracted external listing draft. Pure.
//
// The extractor can be a feed parser, a person typing into the review form, or a model reading pasted text. Whatever
// it is, its output is UNTRUSTED data: this function is the only way it becomes a draft. It keeps only the fields it
// knows, validates every one, and sets what it cannot validate to null. It never invents a value:
//   * an unknown field stays unknown (null), it is not defaulted to something plausible;
//   * the source publication date is NEVER the crawl time: it is the date the source states, or null;
//   * a budget needs an ISO currency code, a bare "$" or "competitive" is not a budget;
//   * keys that are not in the schema (a model's attempt to add "tool", "permissions", "role") are dropped.
// A draft without a usable title is rejected outright; any other bad field makes the draft partial, with the reason.

import { decodeEntities } from "../scoutSources.ts";
import { canonicalizeUrl } from "./canonical.ts";
import type { ListingKind } from "./sources.ts";

export const EXCERPT_MAX = 600;
export const TITLE_MAX = 200;

export type RemoteScope = "remote" | "hybrid" | "onsite";

export interface Budget {
  min: number | null;
  max: number | null;
  currency: string;
  period: "hour" | "day" | "week" | "month" | "year" | "project" | null;
}

export interface ExternalDraft {
  kind: ListingKind;
  title: string;
  original_publisher: string | null;
  location: string | null;
  remote_scope: RemoteScope | null;
  source_published_at: string | null;
  deadline_at: string | null;
  deadline_tz: string | null;
  budget: Budget | null;
  apply_url: string | null;
  /** A short permitted excerpt, plain text. Never the full description. */
  excerpt: string | null;
  starts_at: string | null; // events
  ends_at: string | null; // events
  roles: string[]; // talent
  /** The injection screen found instruction-like text in the source: a person must look before anything is published. */
  flagged_instructions: boolean;
}

export interface ExtractionIssue {
  field: string;
  code: string;
  message: string;
}

export interface ExtractionResult {
  ok: boolean;
  draft: ExternalDraft | null;
  issues: ExtractionIssue[];
  /** True when the draft is usable but some fields were rejected and left unknown. */
  partial: boolean;
}

// ── text ──────────────────────────────────────────────────────────────────────────────────────────

const INJECTION = [
  /ignore (all |any )?(the )?(previous|prior|above) (instructions|prompts?|rules)/i,
  /disregard (all |any )?(the )?(previous|prior|above)/i,
  /(system|developer) (prompt|message|instruction)/i,
  /you are (now )?(a|an|the) (assistant|ai|model|agent|admin)/i,
  /reveal (your|the) (prompt|instructions|secrets?|api key)/i,
  /\b(call|invoke|run|use) (the )?(tool|function|command)\b/i,
  /\bapi[_ -]?key\b|\bservice[_ -]?role\b|\bbearer\s+[a-z0-9._-]{12,}/i,
];

/** Instruction-like text in untrusted content. A flag for the human reviewer, never a filter that makes content safe. */
export function looksLikeInstructions(text: string): boolean {
  return INJECTION.some((re) => re.test(text));
}

/** Contact details found in source text. They are removed, not stored: a public page never carries a person's email or phone. */
export function redactPersonalData(text: string): string {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[contact removed]")
    .replace(/(?:\+|00)?\d[\d\s().-]{7,}\d/g, (m) => (/^\d{4}-\d{2}-\d{2}/.test(m.trim()) || m.replace(/\D/g, "").length < 9 ? m : "[contact removed]"));
}

/** Plain text from untrusted markup: no tags, no scripts, no control or zero-width characters, collapsed whitespace. */
export function sanitizeText(input: unknown, max: number): string | null {
  if (typeof input !== "string") return null;
  let s = input
    .replace(/<(script|style|iframe|object|embed)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/?[a-z][^>]*>/gi, " ");
  s = decodeEntities(s);
  s = s.replace(/<\/?[a-z][^>]*>/gi, " "); // entities can decode into markup: strip again
  // eslint-disable-next-line no-control-regex, no-irregular-whitespace
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁠﻿]/g, "");
  s = redactPersonalData(s.replace(/\s+/g, " ").trim());
  if (!s) return null;
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

// ── dates and money ─────────────────────────────────────────────────────────────────────────────────

const ISO = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

/** An ISO 8601 date or datetime, or null. Relative text ("2 days ago") and impossible dates are not dates. */
export function parseIsoDate(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const s = input.trim();
  if (!ISO.test(s)) return null;
  const d = new Date(s.length === 10 ? `${s}T00:00:00Z` : s.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return null;
  const year = d.getUTCFullYear();
  if (year < 2000 || year > 2100) return null;
  return d.toISOString();
}

function validTimeZone(tz: unknown): string | null {
  if (typeof tz !== "string" || !/^[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+){0,2}$|^UTC$/.test(tz)) return null;
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return tz;
  } catch {
    return null;
  }
}

const PERIODS = new Set(["hour", "day", "week", "month", "year", "project"]);

function parseBudget(input: unknown, issues: ExtractionIssue[]): Budget | null {
  if (input === null || input === undefined) return null;
  if (typeof input !== "object") {
    issues.push({ field: "budget", code: "not_structured", message: "A budget must be structured (min, max, currency)." });
    return null;
  }
  const b = input as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v < 1e9 ? v : null);
  const min = num(b.min);
  const max = num(b.max);
  const currency = typeof b.currency === "string" ? b.currency.trim().toUpperCase() : "";
  if (min === null && max === null) {
    issues.push({ field: "budget", code: "no_amount", message: "No usable amount." });
    return null;
  }
  if (!/^[A-Z]{3}$/.test(currency)) {
    issues.push({ field: "budget", code: "no_currency", message: "An amount needs an ISO 4217 currency code (not a symbol)." });
    return null;
  }
  if (min !== null && max !== null && max < min) {
    issues.push({ field: "budget", code: "range", message: "Maximum is below the minimum." });
    return null;
  }
  const period = typeof b.period === "string" && PERIODS.has(b.period) ? (b.period as Budget["period"]) : null;
  return { min, max, currency, period };
}

// ── the draft ─────────────────────────────────────────────────────────────────────────────────────

const KINDS = new Set(["gig", "event", "talent"]);
const SCOPES = new Set(["remote", "hybrid", "onsite"]);

export interface ExtractContext {
  now: Date;
  /** What the caller expects. A mismatch is an issue, not a silent re-label. */
  kind?: ListingKind;
}

export function parseExtraction(raw: unknown, ctx: ExtractContext): ExtractionResult {
  const issues: ExtractionIssue[] = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, draft: null, issues: [{ field: "$", code: "malformed", message: "The extraction is not an object." }], partial: false };
  }
  const r = raw as Record<string, unknown>;

  const kind = typeof r.kind === "string" && KINDS.has(r.kind) ? (r.kind as ListingKind) : ctx.kind ?? null;
  if (!kind) issues.push({ field: "kind", code: "unknown_kind", message: "Not a gig, an event or a talent." });
  if (ctx.kind && kind && kind !== ctx.kind) issues.push({ field: "kind", code: "kind_mismatch", message: `Expected ${ctx.kind}, got ${kind}.` });

  const title = sanitizeText(r.title, TITLE_MAX);
  if (!title || title.length < 3) {
    issues.push({ field: "title", code: "missing_title", message: "A listing needs a title." });
    return { ok: false, draft: null, issues, partial: false };
  }
  if (!kind || (ctx.kind && kind !== ctx.kind)) return { ok: false, draft: null, issues, partial: false };

  const field = (name: string, value: unknown, max: number) => {
    if (value === null || value === undefined || value === "") return null;
    const clean = sanitizeText(value, max);
    if (!clean) issues.push({ field: name, code: "invalid_text", message: "Not usable text." });
    return clean;
  };

  const published = r.source_published_at === null || r.source_published_at === undefined ? null : parseIsoDate(r.source_published_at);
  if (r.source_published_at && !published) issues.push({ field: "source_published_at", code: "invalid_date", message: "Not an ISO date; left unknown (the crawl time is never used)." });
  let sourcePublishedAt = published;
  if (sourcePublishedAt && new Date(sourcePublishedAt).getTime() > ctx.now.getTime() + 86_400_000) {
    issues.push({ field: "source_published_at", code: "future_date", message: "A publication date in the future; left unknown." });
    sourcePublishedAt = null;
  }

  const deadline = r.deadline_at === null || r.deadline_at === undefined ? null : parseIsoDate(r.deadline_at);
  if (r.deadline_at && !deadline) issues.push({ field: "deadline_at", code: "invalid_date", message: "Not an ISO date; left unknown." });
  const tz = r.deadline_tz === null || r.deadline_tz === undefined ? null : validTimeZone(r.deadline_tz);
  if (r.deadline_tz && !tz) issues.push({ field: "deadline_tz", code: "invalid_timezone", message: "Not an IANA time zone; left unknown." });

  const startsAt = r.starts_at ? parseIsoDate(r.starts_at) : null;
  const endsAt = r.ends_at ? parseIsoDate(r.ends_at) : null;
  if (r.starts_at && !startsAt) issues.push({ field: "starts_at", code: "invalid_date", message: "Not an ISO date; left unknown." });
  if (r.ends_at && !endsAt) issues.push({ field: "ends_at", code: "invalid_date", message: "Not an ISO date; left unknown." });

  let applyUrl: string | null = null;
  if (r.apply_url !== null && r.apply_url !== undefined && r.apply_url !== "") {
    applyUrl = canonicalizeUrl(typeof r.apply_url === "string" ? r.apply_url : "");
    if (!applyUrl) issues.push({ field: "apply_url", code: "invalid_url", message: "Not a usable http(s) URL; left unknown." });
  }

  const scope = typeof r.remote_scope === "string" && SCOPES.has(r.remote_scope) ? (r.remote_scope as RemoteScope) : null;
  if (r.remote_scope && !scope) issues.push({ field: "remote_scope", code: "invalid_scope", message: "Not remote, hybrid or onsite; left unknown." });

  const roles = Array.isArray(r.roles)
    ? (r.roles.map((x) => sanitizeText(x, 60)).filter((x): x is string => !!x).slice(0, 8))
    : [];

  const excerpt = field("excerpt", r.excerpt, EXCERPT_MAX);
  const publisher = field("original_publisher", r.original_publisher, 120);
  const location = field("location", r.location, 120);

  const flagged = [title, excerpt, publisher, location].some((t) => !!t && looksLikeInstructions(t));
  if (flagged) issues.push({ field: "$", code: "instruction_like_text", message: "The source contains instruction-like text; a person must review it." });

  const draft: ExternalDraft = {
    kind,
    title,
    original_publisher: publisher,
    location,
    remote_scope: scope,
    source_published_at: sourcePublishedAt,
    deadline_at: deadline,
    deadline_tz: tz,
    budget: parseBudget(r.budget, issues),
    apply_url: applyUrl,
    excerpt,
    starts_at: startsAt,
    ends_at: endsAt,
    roles,
    flagged_instructions: flagged,
  };
  const partial = issues.some((i) => i.code !== "instruction_like_text");
  return { ok: true, draft, issues, partial };
}
