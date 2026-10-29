import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// "A gig found outside Kretopia stops being public 30 days after the date its source published it." The rule lives in the one view every public
// reader goes through. These guards keep the migration, the paste script and its undo in step, and keep the rule from reopening write access.
const read = (p: string) => readFileSync(resolve(__dirname, "../../../..", p), "utf8");
const migration = read("supabase/migrations/20261029130000_expire_stale_external_gigs.sql");
const apply = read("security/apply-expire-stale-gigs-2026-10-29.sql");
const undo = read("security/rollback-expire-stale-gigs-2026-10-29.sql");
const VIEW = "public.public_external_listings";
const norm = (s: string) => s.replace(/\s+/g, " ").trim();
const body = (sql: string) => sql.slice(sql.indexOf("CREATE OR REPLACE VIEW"));

describe("the 30-day rule", () => {
  it("hides an unclaimed gig whose source date (or, without one, first-seen date) is 30 days old or older", () => {
    expect(norm(migration)).toContain("AND (kind <> 'gig' OR status = 'claimed' OR coalesce(source_published_at, created_at) > now() - interval '30 days')");
  });

  it("keeps every earlier condition of the view and exposes the same columns", () => {
    expect(migration).toContain("WHERE status IN ('published', 'claimed') AND visibility = 'public' AND NOT flagged_instructions");
    expect(migration).toContain("AND (deadline_at IS NULL OR deadline_at > now())");
    for (const hidden of ["created_by", "owner_user_id", "provenance", "identity_key", "token", "possible_duplicates", "extraction_issues", "reviewed_by"]) {
      expect(migration.slice(migration.indexOf("SELECT id,"), migration.indexOf("FROM public.external_listings"))).not.toContain(hidden);
    }
  });

  it("re-asserts read-only client access and the barrier, so replacing the view cannot reopen what the earlier fix closed", () => {
    expect(migration).toContain(`CREATE OR REPLACE VIEW ${VIEW} WITH (security_barrier = true) AS`);
    expect(migration).toContain(`REVOKE ALL ON ${VIEW} FROM PUBLIC, anon, authenticated;`);
    expect(migration).toContain(`GRANT SELECT ON ${VIEW} TO anon, authenticated;`);
    expect(migration).toContain(`GRANT ALL ON ${VIEW} TO service_role;`);
    expect(migration).not.toMatch(/GRANT\s+(?!SELECT\b)[A-Z, ]+\s+ON\s+public\.public_external_listings\s+TO\s+[^;]*\b(anon|authenticated)\b/i);
    expect(migration).not.toMatch(/^\s*(INSERT INTO|UPDATE|DELETE FROM|DROP|TRUNCATE)\b/im);
  });

  it("the paste script applies the migration's statements verbatim", () => {
    expect(norm(apply)).toContain(norm(body(migration)));
  });

  it("the undo restores the view without the rule, keeps the barrier and does not grant clients anything but SELECT", () => {
    expect(undo).not.toContain("interval '30 days'");
    expect(norm(undo)).toContain(norm("AND (deadline_at IS NULL OR deadline_at > now());"));
    expect(undo).toContain("WITH (security_barrier = true)");
    expect(undo).toContain(`GRANT SELECT ON ${VIEW} TO anon, authenticated;`);
    expect(undo).not.toMatch(/GRANT\s+(?!SELECT\b)[A-Z, ]+\s+ON\s+public\.public_external_listings\s+TO\s+[^;]*\b(anon|authenticated)\b/i);
  });
});
