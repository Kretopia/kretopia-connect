import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A scouted gig or event link is an invitation to ASK, never proof of ownership. These read the code and the migrations
 * so that a future change cannot quietly give the link its power back: only decide_scouted_claim (curators) may move
 * created_by / claim_status, and nothing in the app calls the old "the token is the owner" functions.
 */
const ROOT = join(__dirname, "../../..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

const functionBody = (sql: string, name: string): string => {
  const start = sql.indexOf(`FUNCTION public.${name}(`);
  expect(start, `${name} must be defined`).toBeGreaterThan(-1);
  const end = sql.indexOf("\n$$;", start);
  return sql.slice(start, end);
};

const walk = (dir: string, out: string[] = []): string[] => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) { if (f !== "node_modules" && f !== "__tests__") walk(p, out); } else if (/\.(ts|tsx)$/.test(f)) out.push(p);
  }
  return out;
};

describe("a scouted claim link starts a request, a curator decides", () => {
  const requests = read("supabase/migrations/20261029110000_scouted_claim_requests.sql");
  const closing = read("supabase/migrations/20261029110100_scouted_claim_close_token_ownership.sql");

  it("request_scouted_claim never changes who owns anything", () => {
    const body = functionBody(requests, "request_scouted_claim");
    expect(body).not.toMatch(/created_by\s*=/i);
    expect(body).not.toMatch(/claim_status\s*=\s*'claimed'/i);
    expect(body).not.toMatch(/UPDATE\s+public\.(opportunities|creative_jams)/i);
    expect(body).toMatch(/'verified',\s*false/); // and it says so
  });

  it("only decide_scouted_claim moves ownership, only for a curator, and only while the target is still unclaimed", () => {
    const body = functionBody(requests, "decide_scouted_claim");
    expect(body).toMatch(/external_is_admin\(v_admin\)/);
    expect(body.indexOf("external_is_admin")).toBeLessThan(body.indexOf("SET created_by"));
    expect(body).toMatch(/coalesce\(claim_status, 'unclaimed'\) = 'unclaimed'/); // compare-and-swap on the gig
    expect(body).toMatch(/claim_status = 'unclaimed'/); // ... and on the event
    const moved = requests.match(/SET created_by/g) ?? [];
    expect(moved).toHaveLength(2); // the gig and the event branch of the one decision function, nowhere else
    expect(functionBody(requests, "list_scouted_claim_requests")).toMatch(/external_is_admin\(auth\.uid\(\)\)/);
  });

  it("the requests are server-only: RLS on, no policy, no client grant on the table, no anonymous execute", () => {
    expect(requests).toMatch(/ALTER TABLE public\.scouted_claim_requests ENABLE ROW LEVEL SECURITY/);
    expect(requests).not.toMatch(/CREATE POLICY/i);
    expect(requests).toMatch(/REVOKE ALL ON public\.scouted_claim_requests FROM PUBLIC, anon, authenticated/);
    for (const fn of ["request_scouted_claim(text, text)", "list_scouted_claim_requests()", "decide_scouted_claim(uuid, text)"]) {
      expect(requests).toMatch(new RegExp(`REVOKE ALL ON FUNCTION public\\.${fn.replace(/[()]/g, "\\$&")} FROM PUBLIC, anon`));
    }
  });

  it("once the frontend is out, the old token-is-the-owner functions change nothing", () => {
    for (const fn of ["claim_scouted_opportunity", "claim_scouted_event"]) {
      const body = functionBody(closing, fn);
      expect(body).not.toMatch(/UPDATE|created_by/i);
      expect(body).toMatch(/'claimed',\s*false,\s*'reason',\s*'verification_required'/);
    }
    expect(closing).toMatch(/APPLY ONLY AFTER/);
  });

  it("nothing in the app calls the old ownership functions", () => {
    const offenders = walk(join(ROOT, "src")).filter((f) => /rpc\(\s*["'](claim_scouted_opportunity|claim_scouted_event)["']/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
    for (const page of ["src/pages/ClaimGig.tsx", "src/pages/ClaimEvent.tsx"]) expect(read(page)).toContain("request_scouted_claim");
  });
});
