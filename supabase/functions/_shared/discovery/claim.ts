// Claiming an external listing. Pure helpers; the state itself lives in the database (atomic RPCs).
//
// A claim link is an INVITATION TO VERIFY, never proof of ownership. Redeeming it only opens a claim that still has to
// be verified by control of the publisher's own domain, or by a documented admin review. Whoever holds the link, a
// matching name or a visible email proves nothing. Tokens are random, stored only as a SHA-256 hash, expire, work
// once, and are bound to one listing.

import { adapterForUrl } from "./sources.ts";

export const CLAIM_TOKEN_PREFIX = "kc_";
export const CLAIM_TTL_DAYS = 14;
export const CLAIM_MAX_TTL_DAYS = 30;
export const WELL_KNOWN_PATH = "/.well-known/kretopia-claim.txt";
export type ClaimMethod = "source_domain" | "admin_review";
export const CLAIM_METHODS: ClaimMethod[] = ["source_domain", "admin_review"];

const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const toBase64Url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export async function sha256Hex(input: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input)));
}

/** A fresh token (256 bits of randomness) and the hash that is stored. The token itself is never stored or logged. */
export async function mintClaimToken(randomBytes: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): Promise<{ token: string; tokenHash: string }> {
  const token = `${CLAIM_TOKEN_PREFIX}${toBase64Url(randomBytes(32))}`;
  return { token, tokenHash: await sha256Hex(token) };
}

/** Shape check before any lookup, so malformed input never reaches the database. */
export function looksLikeClaimToken(s: unknown): s is string {
  return typeof s === "string" && /^kc_[A-Za-z0-9_-]{43}$/.test(s);
}

export function claimExpiry(now: Date, days: number = CLAIM_TTL_DAYS): Date {
  const d = Math.min(Math.max(Math.floor(days) || CLAIM_TTL_DAYS, 1), CLAIM_MAX_TTL_DAYS);
  return new Date(now.getTime() + d * 86_400_000);
}

// Hosts shared by many unrelated publishers: controlling a page on them says nothing about the employer.
const SHARED_HOSTS = [
  "linkedin.com", "indeed.com", "glassdoor.com", "facebook.com", "instagram.com", "x.com", "twitter.com", "youtube.com",
  "tiktok.com", "medium.com", "notion.site", "notion.so", "github.io", "wixsite.com", "squarespace.com", "carrd.co",
  "linktr.ee", "forms.gle", "google.com", "eventbrite.com", "meetup.com", "greenhouse.io", "lever.co", "ashbyhq.com",
  "workable.com", "bamboohr.com", "smartrecruiters.com", "wordpress.com", "blogspot.com", "substack.com",
];

/**
 * The host the claimant can be asked to prove control of: the publisher's OWN site, taken from the listing's own URLs.
 * Null when the listing only lives on a job board or a shared platform (then the only route is an admin review).
 * The claimant never supplies the domain.
 */
export function sourceDomainFor(listing: { apply_url: string | null; source_url: string | null }): string | null {
  for (const raw of [listing.apply_url, listing.source_url]) {
    if (!raw) continue;
    let host: string;
    try {
      const u = new URL(raw);
      if (u.protocol !== "https:") continue;
      host = u.hostname.toLowerCase().replace(/^www\./, "");
    } catch {
      continue;
    }
    if (adapterForUrl(raw)) continue; // an approved job board is not the employer
    if (SHARED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) continue;
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)) continue; // no IPs, no single-label hosts
    return host;
  }
  return null;
}

/** HMAC-SHA256(secret, listing|user|domain): bound to this claimant, this listing and this domain; not guessable. */
export async function domainChallenge(secret: string, listingId: string, userId: string, domain: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${listingId}|${userId}|${domain}`));
  return toHex(sig).slice(0, 40);
}

export function challengeLine(challenge: string): string {
  return `kretopia-claim=${challenge}`;
}

/** The file proves control only if one of its lines is exactly the expected challenge. */
export function fileProvesChallenge(fileText: string, challenge: string): boolean {
  const expected = challengeLine(challenge);
  return fileText.split(/\r?\n/).some((line) => {
    const l = line.trim();
    if (l.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < l.length; i++) diff |= l.charCodeAt(i) ^ expected.charCodeAt(i);
    return diff === 0;
  });
}
