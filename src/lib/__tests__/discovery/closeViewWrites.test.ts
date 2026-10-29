import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// public.public_external_listings runs with its owner's rights and is a plain single-table view, so Postgres lets a client write through it
// to the service-role-only base table. The first migration only revoked it from PUBLIC, which leaves what Supabase's default privileges gave
// anon and authenticated by name. These guards keep the follow-up migration, and the paste script that applies it, from losing that fix.
const read = (p: string) => readFileSync(resolve(__dirname, "../../../..", p), "utf8");
const migration = read("supabase/migrations/20261029120000_close_public_view_writes.sql");
const VIEW = "public.public_external_listings";

describe("the public view is readable by clients and writable by nobody but the service role", () => {
  it("revokes every privilege from PUBLIC, anon and authenticated by name, then grants only SELECT back", () => {
    expect(migration).toContain(`REVOKE ALL ON ${VIEW} FROM PUBLIC, anon, authenticated;`);
    expect(migration).toContain(`GRANT SELECT ON ${VIEW} TO anon, authenticated;`);
    expect(migration).toContain(`GRANT ALL ON ${VIEW} TO service_role;`);
    const grants = [...migration.matchAll(/^GRANT\s+([^;]*?)\s+ON\s+[^;]*?\s+TO\s+([^;]*);/gim)];
    for (const [, privileges, who] of grants) {
      if (/\b(anon|authenticated)\b/.test(who)) expect(privileges.trim().toUpperCase(), who).toBe("SELECT");
    }
  });

  it("keeps a client-supplied filter from reaching rows the view excludes", () => {
    expect(migration).toContain(`ALTER VIEW ${VIEW} SET (security_barrier = true);`);
  });

  it("changes no data and touches nothing else", () => {
    expect(migration).not.toMatch(/^\s*(INSERT INTO|UPDATE|DELETE FROM|DROP|TRUNCATE)\b/im);
    const statements = migration.split("\n").filter((l) => /^(REVOKE|GRANT|ALTER|CREATE|DROP)\b/.test(l));
    for (const s of statements) expect(s, s).toContain(VIEW);
  });

  it("the paste script applies exactly the migration's statements, so the two cannot drift", () => {
    const script = read("security/apply-close-view-writes-2026-10-29.sql");
    for (const line of migration.split("\n").filter((l) => /^(REVOKE|GRANT|ALTER)\b/.test(l))) expect(script, line).toContain(line);
  });
});
