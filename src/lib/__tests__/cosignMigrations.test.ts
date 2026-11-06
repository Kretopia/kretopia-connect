import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The credits table refuses to take 'peer' or 'verified' from anything that has not authorized itself
// (guard_credit_verification_escalation, introduced by 20260812071205). A function that re-declares submit_credit_endorsement_by_token
// without raising app.credit_verification_authorized therefore makes EVERY accepted co-sign fail. One such file reached main
// (20261106100000, first version) because the older definition it was copied from predates the guard. Found by running it on a real
// PostgreSQL engine; this test keeps the mistake from coming back.
const dir = join(process.cwd(), "supabase/migrations");
const GUARD_INTRODUCED = "20260812071205";
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

function functionBodies(sql: string, name: string): string[] {
  const bodies: string[] = [];
  const re = new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}\\s*\\(`, "g");
  for (let m = re.exec(sql); m; m = re.exec(sql)) {
    const open = sql.indexOf("$$", m.index);
    const close = sql.indexOf("$$", open + 2);
    if (open !== -1 && close !== -1) bodies.push(sql.slice(open + 2, close));
  }
  return bodies;
}

describe("migrations that re-declare submit_credit_endorsement_by_token", () => {
  const definitions = files
    .filter((f) => f.slice(0, 14) >= GUARD_INTRODUCED)
    .flatMap((f) => functionBodies(readFileSync(join(dir, f), "utf8"), "submit_credit_endorsement_by_token").map((body) => ({ file: f, body })));

  it("finds the definitions made since the guard exists", () => {
    expect(definitions.length).toBeGreaterThanOrEqual(3);
    expect(definitions.map((d) => d.file)).toEqual(expect.arrayContaining(["20261106100000_cosign_recipient_authority.sql", "20261106130000_cosign_submit_raises_guard_flag.sql"]));
  });

  it.each(definitions.map((d) => [d.file, d.body] as const))("%s authorizes itself to the credits guard before it writes a credit", (_file, body) => {
    const flag = body.indexOf("app.credit_verification_authorized");
    const write = body.indexOf("UPDATE public.credits");
    expect(flag).toBeGreaterThan(-1);
    expect(write).toBeGreaterThan(-1);
    expect(flag).toBeLessThan(write);
  });
});

describe("the role-claim decision function", () => {
  it("raises the flag the role-rewrite trigger looks for before it claims the role, and never writes a verified credit", () => {
    const sql = readFileSync(join(dir, "20261106120000_featured_in_confirmation_and_role_claim_requests.sql"), "utf8");
    const [body] = functionBodies(sql, "decide_icdb_role_claim");
    expect(body.indexOf("app.icdb_claim_authorized")).toBeGreaterThan(-1);
    expect(body.indexOf("app.icdb_claim_authorized")).toBeLessThan(body.indexOf("UPDATE public.icdb_project_roles"));
    expect(body).toContain("'unverified'");
    expect(body).not.toMatch(/'verified'|'peer'/);
  });
});
