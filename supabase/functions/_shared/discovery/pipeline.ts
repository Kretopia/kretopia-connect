// The external discovery pipeline: ingest -> validate -> extract -> deduplicate -> review draft -> publish, the claim
// handoff, and the bounded discovery run. Pure orchestration over injected dependencies (database, bounded fetch, model
// call, clock), so every rule below is tested without Deno, a network or a key.
//
// What this file guarantees, each covered by tests:
//   * only approved sources are fetched, only through the bounded gateway; any other URL is refused (paste the text);
//   * pasted text and screenshots never become public without a corroborating approved source: they stay private drafts;
//   * the model call carries no tools, its output is validated like any other untrusted input, and it only runs when an
//     AI allowance has been RESERVED first; with none, the user fills the draft in by hand;
//   * a claim link only opens a pending claim; ownership needs verified control of the publisher's own domain or an
//     admin decision, and the identity used for any write is the signed-in user's, never one from the request body;
//   * a discovery run reserves its budget BEFORE any external call, takes a per-source lock, never auto-publishes, and a
//     source that keeps failing switches itself off.

import { GEMINI_FLASH } from "../aiModels.ts";
import { FetchPolicyError, safeFetchBounded, type BoundedResult, type FetchPolicy } from "../ssrf.ts";
import { parseOpportunityFeed } from "./feeds.ts";
import { candidateToRaw } from "./candidate.ts";
import { CLAIM_METHODS, claimExpiry, domainChallenge, challengeLine, fileProvesChallenge, looksLikeClaimToken, mintClaimToken, sha256Hex, sourceDomainFor, WELL_KNOWN_PATH } from "./claim.ts";
import { canonicalizeUrl, identityKey, sourceIdentity } from "./canonical.ts";
import { parseExtraction, type ExternalDraft, type ExtractionIssue } from "./extract.ts";
import { corroborates, factsToRaw, pageFacts } from "./html.ts";
import { possibleDuplicates, scoutedOverlap, type ScoutedRow } from "./similarity.ts";
import { adapterById, adapterForUrl, approvedHosts, enableBlocker, type ListingKind } from "./sources.ts";
import { costCents, jobKey } from "./budget.ts";
import { buildExtractionRequest, MAX_SOURCE_CHARS, parseModelJson } from "./untrusted.ts";

// Minimal structural types, so this stays testable.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Rpc = (name: string, args: Record<string, unknown>) => Promise<{ data: any; error: { message: string } | null }>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Table = (name: string) => any;

export interface PipelineDeps {
  rpc: Rpc;
  from: Table;
  fetchBounded?: (url: string, policy: FetchPolicy) => Promise<BoundedResult>;
  /** The AI gateway. Absent, or aiEnabled false: no model is ever called. */
  callModel?: (body: unknown) => Promise<string | null>;
  aiEnabled?: boolean;
  now?: () => Date;
  /** Server-only secret for domain challenges. */
  claimSecret?: string;
  env?: { get(name: string): string | undefined };
}

export interface Outcome<T = Record<string, unknown>> {
  ok: boolean;
  status: number;
  code?: string;
  message?: string;
  data?: T;
}

const fail = (status: number, code: string, message: string): Outcome => ({ ok: false, status, code, message });
const clock = (d: PipelineDeps) => (d.now ? d.now() : new Date());
const fetcher = (d: PipelineDeps) => d.fetchBounded ?? ((u: string, p: FetchPolicy) => safeFetchBounded(u, p));

export const AI_EXTRACTION_CENTS = 2;
export const AI_SOURCE_ID = "manual-ai";
const MAX_IMAGE_BYTES = 4_000_000;

// ── image validation (the screenshot path) ──────────────────────────────────────────────────────────────

/** Decoded size and real type by magic bytes: a renamed file or a huge upload is refused before anything reads it. */
export function validateImage(base64: string): { ok: true; mime: string } | { ok: false; reason: string } {
  if (typeof base64 !== "string" || base64.length === 0) return { ok: false, reason: "empty" };
  const clean = base64.replace(/^data:[^,]*,/, "");
  if (clean.length * 0.75 > MAX_IMAGE_BYTES) return { ok: false, reason: "too_large" };
  let head: Uint8Array;
  try {
    head = Uint8Array.from(atob(clean.slice(0, 24)), (c) => c.charCodeAt(0));
  } catch {
    return { ok: false, reason: "not_base64" };
  }
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return { ok: true, mime: "image/jpeg" };
  if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) return { ok: true, mime: "image/png" };
  if (head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46 && head[8] === 0x57 && head[9] === 0x45) return { ok: true, mime: "image/webp" };
  return { ok: false, reason: "not_an_image" };
}

// ── ingest ───────────────────────────────────────────────────────────────────────────────────────────────

export type IngestInput =
  | { type: "url"; url: string }
  | { type: "text"; text: string; source_url?: string; fields?: Record<string, unknown> }
  | { type: "screenshot"; image_base64: string; source_url?: string; fields?: Record<string, unknown> };

interface Fetched {
  canonical: string;
  adapterId: string;
  raw: Record<string, unknown>;
  pageTitle: string | null;
  factsFrom: string;
  retrievedAt: string;
}

async function fetchApproved(d: PipelineDeps, url: string, kind: ListingKind): Promise<Fetched | Outcome> {
  const canonical = canonicalizeUrl(url);
  if (!canonical) return fail(400, "bad_url", "That is not a usable web address.");
  const adapter = adapterForUrl(canonical);
  if (!adapter) return fail(422, "unsupported_source", "Only approved sources can be fetched. Paste the text instead and it stays a private draft.");
  let res: BoundedResult;
  try {
    res = await fetcher(d)(canonical, { allowedHosts: adapter.hosts, allowedMime: ["text/html", "application/xhtml+xml"], maxBytes: 1_000_000, maxRedirects: 2, timeoutMs: 8000 });
  } catch (e) {
    const code = e instanceof FetchPolicyError ? e.code : "network";
    return fail(422, `fetch_${code}`, "That page could not be fetched safely.");
  }
  if (res.status < 200 || res.status >= 300) return fail(422, "fetch_status", "The source did not return the page.");
  const finalUrl = canonicalizeUrl(res.finalUrl) ?? canonical;
  const facts = pageFacts(res.text);
  return { canonical: finalUrl, adapterId: adapter.id, raw: factsToRaw(facts, finalUrl, kind), pageTitle: facts.title, factsFrom: facts.from, retrievedAt: clock(d).toISOString() };
}

const isOutcome = (x: Fetched | Outcome): x is Outcome => (x as Outcome).ok === false;

async function modelExtract(d: PipelineDeps, actor: string, text: string, kind: ListingKind): Promise<Record<string, unknown> | Outcome> {
  if (!d.aiEnabled || !d.callModel) return fail(422, "ai_extraction_unavailable", "Automatic reading is not enabled. Fill in the title and details yourself.");
  const key = jobKey(`${AI_SOURCE_ID}:${actor}`, clock(d), crypto.randomUUID());
  // The allowance is RESERVED before the paid call; with none left, nothing is called.
  const reserved = await d.rpc("reserve_discovery_spend", { p_job_key: key, p_source: AI_SOURCE_ID, p_user: actor, p_cents: AI_EXTRACTION_CENTS, p_ttl_minutes: 15 });
  if (reserved.error || !reserved.data?.ok) return fail(429, "ai_budget_unavailable", "The automatic reading allowance is used up for now. Fill in the details yourself.");
  let answer: string | null = null;
  try {
    answer = await d.callModel(buildExtractionRequest(text, GEMINI_FLASH, kind));
  } catch {
    answer = null;
  }
  await d.rpc("settle_discovery_spend", { p_job_key: key, p_actual_cents: answer === null ? 0 : AI_EXTRACTION_CENTS });
  const parsed = parseModelJson(answer);
  if (!parsed) return fail(422, "extraction_unreadable", "The reading did not produce a usable listing. Fill in the details yourself.");
  return parsed as Record<string, unknown>;
}

const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/**
 * Rows of members' Scouted lists that may be the same posting: the same provider id inside the address, or the same title.
 * Only the candidates are read (never the whole table); scoutedOverlap decides. A failed lookup is no reason to refuse an
 * import, the advice is simply absent.
 */
async function scoutedRows(d: PipelineDeps, title: string, sourceId: string | null, now: Date): Promise<ScoutedRow[]> {
  const cols = "target_user_id, title, company, location, source_url, apply_url";
  const open = now.toISOString();
  try {
    const lookups = [d.from("scouted_gigs").select(cols).ilike("title", likeEscape(title)).gt("expires_at", open).limit(200)];
    if (sourceId && /^[a-z0-9_-]{4,80}$/i.test(sourceId)) lookups.push(d.from("scouted_gigs").select(cols).ilike("source_url", `%${sourceId}%`).gt("expires_at", open).limit(200));
    const found = await Promise.all(lookups);
    return found.flatMap((r) => (Array.isArray(r?.data) ? (r.data as ScoutedRow[]) : []));
  } catch {
    return [];
  }
}

export async function ingest(d: PipelineDeps, actor: string, input: IngestInput, kind: ListingKind = "gig"): Promise<Outcome> {
  if (!actor) return fail(401, "sign_in_required", "Sign in to import.");
  const now = clock(d);
  let raw: Record<string, unknown>;
  let sourceType: "url" | "text" | "screenshot";
  let canonical: string | null = null;
  let adapterId: string | null = null;
  let factsFrom: string | null = null;
  let retrievedAt = now.toISOString();
  let corroboration: "corroborated" | "not_corroborated" | "no_source" = "no_source";

  if (input.type === "url") {
    const got = await fetchApproved(d, input.url, kind);
    if (isOutcome(got)) return got;
    if (!got.raw.title) return fail(422, "no_structured_facts", "The page states no structured listing data. Paste the text instead.");
    raw = got.raw;
    sourceType = "url";
    canonical = got.canonical;
    adapterId = got.adapterId;
    factsFrom = got.factsFrom;
    retrievedAt = got.retrievedAt;
    corroboration = "corroborated";
  } else {
    sourceType = input.type;
    let text: string;
    if (input.type === "screenshot") {
      const img = validateImage(input.image_base64);
      if (!img.ok) return fail(400, "bad_image", "That file is not a usable image.");
      text = "";
    } else {
      if (typeof input.text !== "string" || input.text.trim().length < 20) return fail(400, "text_too_short", "Paste the listing text.");
      if (input.text.length > MAX_SOURCE_CHARS * 4) return fail(413, "text_too_long", "That text is too long.");
      text = input.text;
    }
    if (input.fields && typeof input.fields === "object") {
      raw = { ...input.fields };
    } else if (input.type === "screenshot") {
      return fail(422, "ai_extraction_unavailable", "Screenshots are read only when automatic reading is enabled. Fill in the title and details yourself.");
    } else {
      const read = await modelExtract(d, actor, text, kind);
      if ("ok" in read && (read as Outcome).ok === false) return read as Outcome;
      raw = read as Record<string, unknown>;
    }
    // A pasted listing can name where it came from. That claim is checked, not believed.
    if (input.source_url) {
      const got = await fetchApproved(d, input.source_url, kind);
      if (!isOutcome(got) && typeof raw.title === "string" && corroborates(raw.title, got.pageTitle)) {
        canonical = got.canonical;
        adapterId = got.adapterId;
        factsFrom = got.factsFrom;
        retrievedAt = got.retrievedAt;
        corroboration = "corroborated";
        raw = { ...raw, apply_url: raw.apply_url ?? got.canonical };
      } else {
        corroboration = "not_corroborated";
      }
    }
  }

  const parsed = parseExtraction(raw, { now, kind });
  if (!parsed.ok || !parsed.draft) return { ok: false, status: 422, code: "extraction_rejected", message: "The listing could not be read: it needs at least a title.", data: { issues: parsed.issues } };
  const draft = parsed.draft;

  const key = canonical ? identityKey(canonical) : null;
  const identity = canonical ? sourceIdentity(canonical) : null;

  const known = await d.from("external_listings").select("id, title, original_publisher, location").in("status", ["draft", "in_review", "published", "claimed"]).order("created_at", { ascending: false }).limit(300);
  const scouted = scoutedOverlap(draft, canonical, await scoutedRows(d, draft.title, identity?.sourceId ?? null, now));
  const duplicates = [...possibleDuplicates(draft, (known?.data ?? []) as { id: string; title: string; original_publisher: string | null; location: string | null }[]), ...(scouted ? [scouted] : [])];

  const row = {
    kind: draft.kind, source_type: sourceType, source_provider: identity?.provider ?? null, source_id: identity?.sourceId ?? null,
    source_url: canonical, canonical_url: canonical, identity_key: key,
    original_publisher: draft.original_publisher, title: draft.title, location: draft.location, remote_scope: draft.remote_scope,
    source_published_at: draft.source_published_at, deadline_at: draft.deadline_at, deadline_tz: draft.deadline_tz, budget: draft.budget,
    apply_url: draft.apply_url, excerpt: draft.excerpt, starts_at: draft.starts_at, ends_at: draft.ends_at, roles: draft.roles,
    flagged_instructions: draft.flagged_instructions, possible_duplicates: duplicates, extraction_issues: parsed.issues,
    provenance: { adapter: adapterId, facts_from: factsFrom, corroboration, input: input.type }, retrieved_at: retrievedAt,
  };
  const res = await d.rpc("import_external_listing", { p_actor: actor, p_row: row });
  if (res.error) return fail(500, "import_failed", "The listing could not be saved.");
  const r = res.data as { created: boolean; listing_id: string | null; reason?: string };
  return {
    ok: true,
    status: r.created ? 201 : 200,
    data: { created: r.created, listing_id: r.listing_id, already_known: !r.created, partial: parsed.partial, issues: parsed.issues as ExtractionIssue[], possible_duplicates: duplicates, corroboration, draft: draft as ExternalDraft },
  };
}

// ── review and claim link (curators) ──────────────────────────────────────────────────────────────────────

export async function reviewListing(d: PipelineDeps, actor: string, listingId: string, action: string, note?: string): Promise<Outcome> {
  if (!["send_to_review", "approve", "reject", "remove", "expire"].includes(action)) return fail(400, "unknown_action", "Unknown action.");
  const res = await d.rpc("review_external_listing", { p_listing: listingId, p_actor: actor, p_action: action, p_note: note ?? null });
  if (res.error) return fail(500, "review_failed", "The review could not be saved.");
  return res.data?.ok ? { ok: true, status: 200 } : fail(res.data?.reason === "forbidden" ? 403 : 409, String(res.data?.reason ?? "refused"), "Not allowed.");
}

/** The link is returned ONCE to the curator to copy. Nothing is sent, and the token is not stored, only its hash. */
export async function createClaimLink(d: PipelineDeps, actor: string, listingId: string, origin: string): Promise<Outcome<{ link: string; expires_at: string }>> {
  const { token, tokenHash } = await mintClaimToken();
  const expires = claimExpiry(clock(d));
  const res = await d.rpc("register_claim_token", { p_listing: listingId, p_actor: actor, p_token_hash: tokenHash, p_expires_at: expires.toISOString() });
  if (res.error) return fail(500, "link_failed", "The link could not be created.") as Outcome<{ link: string; expires_at: string }>;
  if (!res.data?.ok) return fail(res.data?.reason === "forbidden" ? 403 : 409, String(res.data?.reason ?? "refused"), "A claim link cannot be created for this listing.") as Outcome<{ link: string; expires_at: string }>;
  return { ok: true, status: 201, data: { link: `${origin.replace(/\/$/, "")}/claim-listing/${listingId}/${token}`, expires_at: expires.toISOString() } };
}

// ── claiming (the signed-in claimant) ─────────────────────────────────────────────────────────────────────

export async function redeemClaim(d: PipelineDeps, userId: string | null, listingId: string, token: unknown): Promise<Outcome> {
  if (!userId) return fail(401, "sign_in_required", "Sign in to continue.");
  if (!looksLikeClaimToken(token)) return fail(400, "invalid_link", "This link is not valid.");
  const res = await d.rpc("redeem_claim_token", { p_token_hash: await sha256Hex(token), p_listing: listingId, p_user: userId });
  if (res.error) return fail(500, "redeem_failed", "The link could not be used.");
  // Redeeming opens a PENDING claim. It is not ownership, and the answer says so.
  return res.data?.ok
    ? { ok: true, status: 200, data: { claim_id: res.data.claim_id, verified: false, next: "verify" } }
    : fail(res.data?.reason === "sign_in_required" ? 401 : 410, "invalid_or_used", "This link is invalid, expired or already used.");
}

async function loadClaim(d: PipelineDeps, userId: string, claimId: string) {
  const claim = (await d.from("external_listing_claims").select("id, listing_id, claimant_user_id, status").eq("id", claimId).maybeSingle())?.data;
  if (!claim || claim.claimant_user_id !== userId) return null; // someone else's claim is indistinguishable from a missing one
  const listing = (await d.from("external_listings").select("id, status, apply_url, source_url").eq("id", claim.listing_id).maybeSingle())?.data;
  return listing ? { claim, listing } : null;
}

export async function startVerification(d: PipelineDeps, userId: string, claimId: string): Promise<Outcome> {
  const loaded = await loadClaim(d, userId, claimId);
  if (!loaded || loaded.claim.status !== "pending") return fail(404, "not_found", "No open claim.");
  const domain = sourceDomainFor(loaded.listing);
  const options: Record<string, unknown>[] = [];
  if (domain && d.claimSecret) {
    const challenge = await domainChallenge(d.claimSecret, loaded.listing.id, userId, domain);
    options.push({ method: "source_domain", domain, file_url: `https://${domain}${WELL_KNOWN_PATH}`, line: challengeLine(challenge) });
  }
  options.push({ method: "admin_review" });
  return { ok: true, status: 200, data: { options, methods: CLAIM_METHODS } };
}

export async function verifyDomain(d: PipelineDeps, userId: string, claimId: string): Promise<Outcome> {
  const loaded = await loadClaim(d, userId, claimId);
  if (!loaded || loaded.claim.status !== "pending") return fail(404, "not_found", "No open claim.");
  const domain = sourceDomainFor(loaded.listing); // from the LISTING, never from the request
  if (!domain || !d.claimSecret) return fail(422, "domain_not_available", "This listing has no domain of its own to verify. Ask for an admin review.");
  const challenge = await domainChallenge(d.claimSecret, loaded.listing.id, userId, domain);
  let body: string;
  try {
    body = (await fetcher(d)(`https://${domain}${WELL_KNOWN_PATH}`, { allowedHosts: [domain], allowedMime: ["text/plain"], maxBytes: 4096, maxRedirects: 1, timeoutMs: 6000 })).text;
  } catch {
    return fail(422, "proof_not_found", "The proof file could not be read yet.");
  }
  if (!fileProvesChallenge(body, challenge)) return fail(422, "proof_mismatch", "The proof file does not contain the expected line.");
  const res = await d.rpc("verify_external_claim", { p_claim: claimId, p_claimant: userId, p_method: "source_domain", p_domain: domain, p_decided_by: userId });
  if (res.error || !res.data?.ok) return fail(409, String(res.data?.reason ?? "refused"), "This listing cannot be claimed right now.");
  return { ok: true, status: 200, data: { verified: true, listing_id: res.data.listing_id } };
}

export async function requestAdminReview(d: PipelineDeps, userId: string, claimId: string): Promise<Outcome> {
  const loaded = await loadClaim(d, userId, claimId);
  if (!loaded || loaded.claim.status !== "pending") return fail(404, "not_found", "No open claim.");
  await d.rpc("external_log", { p_listing: loaded.listing.id, p_actor: userId, p_event: "admin_review_requested", p_detail: { claim_id: claimId } });
  return { ok: true, status: 202, data: { verified: false, next: "wait_for_review" } };
}

export type ClaimStanding = "none" | "pending" | "rejected" | "verified";
// "disputed" only ever follows a VERIFIED claim (a report on a claimed listing), so it is never an open request.
const OPEN_STANDINGS: ClaimStanding[] = ["pending", "rejected"];

/**
 * What the signed-in user is to ONE listing, so the screen a claimant saw survives a reload, a bookmark or another device (the
 * link is spent and gone from the address bar once used, and a curator's approval happens later, elsewhere): its manager (with the
 * three fields they may edit), someone whose claim is open (their own claim id comes back so the verification choices can be shown
 * again) or was turned down, or nothing. It answers only about the caller (the id is the session's, never the body's), never returns
 * another person's claim or owner, and says "not found" for a listing the caller has no part in unless it is public.
 */
export async function claimStatus(d: PipelineDeps, userId: string, listingId: string): Promise<Outcome> {
  const listing = (await d.from("external_listings").select("id, status, visibility, owner_user_id, title, original_publisher, deadline_at, description_full").eq("id", listingId).maybeSingle())?.data;
  if (!listing) return fail(404, "not_found", "No such listing.");
  const mine = ((await d.from("external_listing_claims").select("id, status").eq("listing_id", listingId).eq("claimant_user_id", userId))?.data ?? []) as { id: string; status: string }[];
  const owner = listing.status === "claimed" && listing.owner_user_id === userId;
  // a verified claim on a listing that is no longer claimed (removed, expired) is not a standing: there is nothing to manage
  const claim: ClaimStanding = owner ? "verified" : OPEN_STANDINGS.find((s) => mine.some((c) => c.status === s)) ?? "none";
  if (!owner && claim === "none" && listing.visibility !== "public") return fail(404, "not_found", "No such listing.");
  return {
    ok: true,
    status: 200,
    data: {
      owner,
      claim,
      ...(claim === "pending" ? { claim_id: mine.find((c) => c.status === "pending")?.id } : {}),
      ...(owner ? { listing: { title: listing.title, original_publisher: listing.original_publisher ?? null, deadline_at: listing.deadline_at ?? null, description_full: listing.description_full ?? null } } : {}),
    },
  };
}

export async function decideClaim(d: PipelineDeps, admin: string, claimId: string, decision: "approve" | "reject"): Promise<Outcome> {
  if (decision === "reject") {
    const r = await d.rpc("reject_external_claim", { p_claim: claimId, p_admin: admin });
    return r.data?.ok ? { ok: true, status: 200 } : fail(r.data?.reason === "forbidden" ? 403 : 409, String(r.data?.reason ?? "refused"), "Not allowed.");
  }
  const claim = (await d.from("external_listing_claims").select("id, claimant_user_id").eq("id", claimId).maybeSingle())?.data;
  if (!claim) return fail(404, "not_found", "No such claim.");
  const r = await d.rpc("verify_external_claim", { p_claim: claimId, p_claimant: claim.claimant_user_id, p_method: "admin_review", p_domain: null, p_decided_by: admin });
  return r.data?.ok ? { ok: true, status: 200 } : fail(r.data?.reason === "forbidden" ? 403 : 409, String(r.data?.reason ?? "refused"), "Not allowed.");
}

/** Hosted applications: admin only, and only for a listing with a VERIFIED owner (the database refuses otherwise). */
export async function setApplications(d: PipelineDeps, admin: string, listingId: string, enabled: boolean): Promise<Outcome> {
  const res = await d.rpc("set_external_applications", { p_listing: listingId, p_admin: admin, p_enabled: enabled });
  return res.data?.ok ? { ok: true, status: 200 } : fail(res.data?.reason === "forbidden" ? 403 : 409, String(res.data?.reason ?? "refused"), "Applications cannot be enabled for this listing.");
}

const OWNER_FIELDS = new Set(["description_full", "deadline_at", "budget"]);

/** The owner is the SIGNED-IN user: an owner id in the body is ignored, and only these three fields can change. */
export async function ownerUpdate(d: PipelineDeps, userId: string, listingId: string, edits: Record<string, unknown>): Promise<Outcome> {
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(edits ?? {})) if (OWNER_FIELDS.has(k)) clean[k] = v;
  if (Object.keys(clean).length === 0) return fail(400, "nothing_to_update", "Nothing to update.");
  const res = await d.rpc("owner_update_external_listing", { p_listing: listingId, p_owner: userId, p_edits: clean });
  return res.data?.ok ? { ok: true, status: 200 } : fail(403, "forbidden", "You can only manage a listing you have verified ownership of.");
}

export async function disputeListing(d: PipelineDeps, userId: string, listingId: string, reason: string): Promise<Outcome> {
  const res = await d.rpc("dispute_external_listing", { p_listing: listingId, p_reporter: userId, p_reason: String(reason ?? "").slice(0, 1000) });
  return res.data?.ok ? { ok: true, status: 202 } : fail(404, "not_found", "No such listing.");
}

// ── the bounded discovery run (disabled by default) ───────────────────────────────────────────────────────

export interface RunReport {
  source: string;
  status: "skipped" | "ran" | "failed";
  reason?: string;
  fetched?: number;
  imported?: number;
  alreadyKnown?: number;
  rejected?: number;
  /** Postings a curator already rejected or removed: the run does not bring them back. */
  skippedDecided?: number;
  settledCents?: number;
}

export const MAX_CANDIDATES_PER_RUN = 100;
export const FEED_DRAFTS_LIMIT = 100;

/**
 * Drafts the scheduled run imported. Nobody owns them (created_by is null), so they appear in no person's own list and in
 * no review queue: this is how a curator reads them. Private and unpublished; `total` can exceed what is returned.
 */
export async function listFeedDrafts(d: PipelineDeps, fields: string): Promise<{ listings: unknown[]; total: number }> {
  const res = await d.from("external_listings").select(fields, { count: "exact" }).eq("status", "draft").is("created_by", null).order("created_at", { ascending: false }).limit(FEED_DRAFTS_LIMIT);
  const listings = Array.isArray(res?.data) ? res.data : [];
  return { listings, total: typeof res?.count === "number" ? res.count : listings.length };
}

export async function runDiscovery(d: PipelineDeps, opts: { slot?: string } = {}): Promise<{ ran: RunReport[]; skipped?: string }> {
  const now = clock(d);
  const settings = (await d.from("discovery_settings").select("enabled").maybeSingle())?.data;
  if (!settings?.enabled) return { ran: [], skipped: "kill_switch_off" };

  const rows = ((await d.from("discovery_sources").select("id, enabled, max_fetches_per_run, cost_per_call_cents").eq("enabled", true))?.data ?? []) as { id: string; max_fetches_per_run: number; cost_per_call_cents: number | null }[];
  const reports: RunReport[] = [];
  for (const row of rows) {
    const adapter = adapterById(row.id);
    if (!adapter) { reports.push({ source: row.id, status: "skipped", reason: "not_an_approved_adapter" }); continue; }
    const blocker = d.env ? enableBlocker(adapter, d.env) : adapter.costPerCallCents === null ? "cost per call is unknown" : null;
    if (blocker) { reports.push({ source: row.id, status: "skipped", reason: blocker }); continue; }

    const lock = await d.rpc("acquire_discovery_run", { p_source: row.id, p_ttl_minutes: 15 });
    if (!lock.data) { reports.push({ source: row.id, status: "skipped", reason: "already_running" }); continue; }

    const urls = adapter.feedUrls.slice(0, Math.max(row.max_fetches_per_run, 0));
    // The CONFIGURED price wins over the registry's (the registry only says whether a price can exist at all).
    const unit = { costPerCallCents: row.cost_per_call_cents ?? adapter.costPerCallCents };
    const cents = costCents(unit, urls.length) ?? 0;
    const key = jobKey(row.id, now, opts.slot ?? "run");
    // Reserve BEFORE any external call. Refused: nothing is fetched.
    const reserved = await d.rpc("reserve_discovery_spend", { p_job_key: key, p_source: row.id, p_user: null, p_cents: cents, p_ttl_minutes: 30 });
    if (reserved.error || !reserved.data?.ok) {
      await d.rpc("release_discovery_run", { p_source: row.id });
      reports.push({ source: row.id, status: "skipped", reason: String(reserved.data?.reason ?? "budget_unavailable") });
      continue;
    }

    const report: RunReport = { source: row.id, status: "ran", fetched: 0, imported: 0, alreadyKnown: 0, rejected: 0 };
    let calls = 0;
    try {
      const raws: Record<string, unknown>[] = [];
      for (const url of urls) {
        calls += 1;
        const res = await fetcher(d)(url, { allowedHosts: adapter.hosts, allowedMime: ["application/json", "application/rss+xml", "application/xml", "text/xml", "text/plain", "text/html"], maxBytes: 3_000_000, maxRedirects: 2, timeoutMs: 10_000 });
        if (res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res.status}`);
        const candidates = parseOpportunityFeed(adapter.id, res.text).slice(0, MAX_CANDIDATES_PER_RUN);
        report.fetched = (report.fetched ?? 0) + candidates.length;
        for (const c of candidates) raws.push({ ...candidateToRaw(c), __url: c.source_url, __feed: url });
      }
      // Several queries of one source overlap (the same job answers "designer" and "art director"): the bound counts distinct jobs, so
      // a repeated one cannot push the last queries' jobs out of the run.
      const seen = new Set<string>();
      const batch = raws
        .filter((x) => {
          const c = canonicalizeUrl(String(x.__url ?? ""));
          if (!c) return true; // rejected below, as before
          const k = identityKey(c);
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        })
        .slice(0, MAX_CANDIDATES_PER_RUN);
      // A rejected or removed listing frees its identity in the database (so a person can import it again on purpose), which
      // would let every run recreate what a curator decided against. The run leaves those out.
      const keys = batch.map((x) => canonicalizeUrl(String(x.__url ?? ""))).filter((c): c is string => !!c).map((c) => identityKey(c));
      const decided = new Set<string>(
        keys.length === 0
          ? []
          : ((await d.from("external_listings").select("identity_key").in("identity_key", keys).in("status", ["rejected", "removed"]))?.data ?? []).map((r: { identity_key: string }) => r.identity_key),
      );
      for (const item of batch) {
        const { __url, __feed, ...raw } = item as Record<string, unknown> & { __url: string; __feed: string };
        const parsed = parseExtraction(raw, { now, kind: "gig" });
        const canonical = canonicalizeUrl(__url);
        if (!parsed.ok || !parsed.draft || !canonical) { report.rejected = (report.rejected ?? 0) + 1; continue; }
        if (decided.has(identityKey(canonical))) { report.skippedDecided = (report.skippedDecided ?? 0) + 1; continue; }
        const dr = parsed.draft;
        const identity = sourceIdentity(canonical);
        const res = await d.rpc("import_external_listing", {
          p_actor: null,
          p_row: {
            kind: "gig", source_type: "feed", source_provider: identity.provider, source_id: identity.sourceId, source_url: canonical, canonical_url: canonical,
            identity_key: identityKey(canonical), original_publisher: dr.original_publisher, title: dr.title, location: dr.location, remote_scope: dr.remote_scope,
            source_published_at: dr.source_published_at, deadline_at: dr.deadline_at, deadline_tz: dr.deadline_tz, budget: dr.budget, apply_url: dr.apply_url, excerpt: dr.excerpt, flagged_instructions: dr.flagged_instructions,
            extraction_issues: parsed.issues, provenance: { adapter: adapter.id, feed_url: __feed, job_key: key, input: "scheduled_feed" }, retrieved_at: now.toISOString(),
          },
        });
        if (res.data?.created) report.imported = (report.imported ?? 0) + 1;
        else if (res.data) report.alreadyKnown = (report.alreadyKnown ?? 0) + 1;
      }
      await d.rpc("record_discovery_run", { p_source: row.id, p_ok: true, p_error: null });
    } catch (e) {
      report.status = "failed";
      report.reason = e instanceof FetchPolicyError ? `fetch_${e.code}` : e instanceof Error ? e.message.slice(0, 120) : "failed";
      await d.rpc("record_discovery_run", { p_source: row.id, p_ok: false, p_error: report.reason });
    }
    // Settle what was really spent; the rest goes back to the budget. Results are DRAFTS: nothing here publishes.
    const settled = await d.rpc("settle_discovery_spend", { p_job_key: key, p_actual_cents: costCents(unit, calls) ?? 0 });
    report.settledCents = settled.data?.settled_cents ?? 0;
    reports.push(report);
  }
  return { ran: reports };
}

export { approvedHosts };
