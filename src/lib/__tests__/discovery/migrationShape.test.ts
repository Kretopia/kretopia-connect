import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(resolve(__dirname, "../../../../supabase/migrations/20261029100000_external_discovery.sql"), "utf8");
const code = sql.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n"); // rollback comments are not statements

// The behaviour of this migration (one listing under 40 concurrent imports, one use of a claim link under 40
// redemptions, one verified owner under 30 simultaneous verifications, caps never exceeded by 40 parallel
// reservations, grants) was run on a throwaway Postgres 16, see docs/release/EXTERNAL_DISCOVERY.md. These guards keep
// its SHAPE: purely additive, closed to clients, and off by default.
const TABLES = ["discovery_settings", "discovery_sources", "external_listings", "external_listing_claim_tokens", "external_listing_claims", "external_listing_events", "discovery_spend_counters", "discovery_spend_ledger"];

describe("the external discovery migration is additive, locked and off by default", () => {
  it("creates only new objects: no ALTER, DROP, UPDATE or DELETE of anything that exists", () => {
    expect(code).not.toMatch(/^\s*ALTER\s+TABLE\s+(?!public\.(discovery_|external_listing))/im);
    expect(code).not.toMatch(/^\s*DROP\s/im);
    expect(code).not.toMatch(/^\s*(UPDATE|DELETE\s+FROM)\s+public\.(?!external_listing|discovery_)/im);
    for (const table of ["profiles", "opportunities", "scouted_gigs", "credits", "projects", "invoices"]) {
      expect(code, table).not.toMatch(new RegExp(`(ALTER TABLE|UPDATE|INSERT INTO|DELETE FROM)\\s+public\\.${table}\\b`, "i"));
    }
  });

  it("enables row level security on every new table and revokes them all from clients", () => {
    for (const t of TABLES) expect(code).toContain(`ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY`);
    const revoke = code.slice(code.indexOf("REVOKE ALL ON public.discovery_settings"));
    for (const t of TABLES) expect(revoke.slice(0, revoke.indexOf("FROM PUBLIC, anon, authenticated;"))).toContain(`public.${t}`);
    expect(code).not.toMatch(/GRANT\s+(INSERT|UPDATE|DELETE|ALL)[^;]*\bTO\b[^;]*\b(anon|authenticated)\b/i); // the only client grant is SELECT on the view
  });

  it("the public sees one view, with no internal column", () => {
    const view = code.slice(code.indexOf("CREATE OR REPLACE VIEW public.public_external_listings"), code.indexOf("REVOKE ALL ON public.public_external_listings"));
    for (const hidden of ["created_by", "owner_user_id", "provenance", "identity_key", "token", "possible_duplicates", "extraction_issues", "reviewed_by"]) expect(view).not.toContain(hidden);
    expect(view).toMatch(/status IN \('published', 'claimed'\) AND visibility = 'public' AND NOT flagged_instructions/);
    expect(view).toMatch(/deadline_at IS NULL OR deadline_at > now\(\)/);
  });

  it("every function is SECURITY DEFINER with a fixed search_path and executable by the service role only", () => {
    const fns = [...code.matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)/g)].map((m) => m[1]);
    expect(fns.length).toBeGreaterThanOrEqual(13);
    expect((code.match(/SECURITY DEFINER SET search_path = public, pg_temp/g) ?? []).length).toBe(fns.length);
    const grant = code.slice(code.indexOf("fns text[] := ARRAY["));
    for (const f of fns) expect(grant, f).toContain(`public.${f}(`);
    expect(grant).toContain("REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated");
    expect(grant).toContain("GRANT EXECUTE ON FUNCTION %s TO service_role");
  });

  it("everything automated is off by default, and an unknown cost cannot be enabled", () => {
    expect(code).toMatch(/discovery_settings[\s\S]{0,200}enabled boolean NOT NULL DEFAULT false/);
    expect(code).toMatch(/discovery_sources[\s\S]{0,200}enabled boolean NOT NULL DEFAULT false/);
    expect(code).toContain("CONSTRAINT discovery_sources_enable_needs_known_cost CHECK (NOT enabled OR cost_per_call_cents IS NOT NULL)");
    expect(code).toMatch(/applications_enabled boolean NOT NULL DEFAULT false/);
    expect(code).toMatch(/visibility text NOT NULL DEFAULT 'private'/);
  });

  it("the guarantees are in the database, not only in the edge function", () => {
    expect(code).toContain("CREATE UNIQUE INDEX IF NOT EXISTS external_listings_identity_uq");
    expect(code).toContain("external_listing_one_verified_claim");
    expect(code).toContain("token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$')");
    expect(code).toContain("external_listings_screenshot_stays_private");
    expect(code).toMatch(/excerpt text CHECK \(excerpt IS NULL OR char_length\(excerpt\) <= 600\)/);
    expect(code).toMatch(/job_key text NOT NULL UNIQUE/);
  });
});
