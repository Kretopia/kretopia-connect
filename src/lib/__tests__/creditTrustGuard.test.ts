import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(__dirname, "../../../supabase/migrations/20261028130000_guard_credit_trust_fields_on_insert.sql"), "utf8");
const fn = migration.slice(migration.indexOf("CREATE OR REPLACE FUNCTION"));

// The behaviour (forged 'peer', endorsement_count and verified_by_name refused for an authenticated caller; the
// importers, downgrades and the co-sign RPC unaffected) was run on a throwaway Postgres, see the PR.
describe("a credit's trust fields are server-written: the insert guard", () => {
  it("refuses an unauthorized insert or escalation to verified, auto_discovered or peer", () => {
    expect(fn).toMatch(/verification_status IN \('verified', 'auto_discovered', 'peer'\)/);
    expect(fn).toMatch(/TG_OP = 'INSERT' OR NEW\.verification_status IS DISTINCT FROM OLD\.verification_status/);
  });

  it("refuses an unauthorized insert that carries an endorsement count or a verifier name", () => {
    expect(fn).toMatch(/TG_OP = 'INSERT'[\s\S]{0,120}COALESCE\(NEW\.endorsement_count, 0\) <> 0 OR NEW\.verified_by_name IS NOT NULL/);
  });

  it("leaves verification_url and ai_confidence alone: the importers write them on credits that stay pending", () => {
    const conditions = fn.slice(fn.indexOf("IF NOT v_authorized"));
    expect(conditions).not.toContain("verification_url");
    expect(conditions).not.toContain("ai_confidence");
  });

  it("keeps who is authorized: the service role, or an RPC that set the flag", () => {
    expect(fn).toContain("auth.role() = 'service_role'");
    expect(fn).toContain("current_setting('app.credit_verification_authorized', true)");
  });

  it("does not drop or recreate the trigger or change any grant", () => {
    expect(migration).not.toMatch(/^\s*(DROP|CREATE) TRIGGER/im);
    expect(migration).not.toMatch(/^\s*(GRANT|REVOKE)\b/im);
  });
});
