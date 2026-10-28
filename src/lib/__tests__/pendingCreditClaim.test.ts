import { describe, expect, it, vi } from "vitest";
import { attachPendingCreditClaim, PENDING_CLAIM_KEY } from "../pendingCreditClaim";

type Row = Record<string, unknown>;

// A stand-in for the credits table that, like the real one, refuses a status the CHECK constraint does not allow.
const ALLOWED = ["unverified", "verified", "pending", "pending_review", "rejected", "auto_discovered", "disputed", "peer", "self_reported"];

function fakeDb(rows: Row[] = [], opts: { lookupError?: boolean; insertError?: boolean } = {}) {
  const inserted: Row[] = [];
  const db = {
    from: (table: string) => {
      expect(table).toBe("credits");
      const filters: [string, unknown][] = [];
      const q: Record<string, unknown> = {
        select: () => q,
        eq: (c: string, v: unknown) => (filters.push([c, v]), q),
        limit: () => q,
        maybeSingle: async () =>
          opts.lookupError
            ? { data: null, error: { message: "lookup failed" } }
            : { data: [...rows, ...inserted].find((r) => filters.every(([c, v]) => r[c] === v)) ?? null, error: null },
        insert: async (row: Row) => {
          if (opts.insertError) return { error: { message: "network" } };
          if (!ALLOWED.includes(String(row.verification_status))) return { error: { message: "violates check constraint credits_verification_status_check" } };
          inserted.push(row);
          return { error: null };
        },
      };
      return q;
    },
  };
  return { db, inserted };
}

const store = (claim?: unknown) => {
  const data = new Map<string, string>();
  if (claim !== undefined) data.set(PENDING_CLAIM_KEY, typeof claim === "string" ? claim : JSON.stringify(claim));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    has: () => data.has(PENDING_CLAIM_KEY),
  };
};

describe("attachPendingCreditClaim: a credit claimed before signing up", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});

  it("files the claim with a status the credits table allows, and forgets it once attached", async () => {
    const { db, inserted } = fakeDb();
    const s = store({ project_name: "Night Film", role: "Editor" });
    expect(await attachPendingCreditClaim(db, "u1", s)).toBe("attached");
    expect(inserted).toEqual([{ user_id: "u1", project_name: "Night Film", role: "Editor", verification_status: "pending_review" }]);
    expect(s.has()).toBe(false);
  });

  it("defaults the role to Contributor", async () => {
    const { db, inserted } = fakeDb();
    await attachPendingCreditClaim(db, "u1", store({ project_name: "Night Film" }));
    expect(inserted[0].role).toBe("Contributor");
  });

  it("never writes a status the credits constraint refuses (the old 'manual' was rolled back every time)", async () => {
    const { db, inserted } = fakeDb();
    expect(await attachPendingCreditClaim(db, "u1", store({ project_name: "X" }))).toBe("attached");
    expect(ALLOWED).toContain(inserted[0].verification_status);
  });

  it("keeps the claim for the next sign-in when the insert fails, and says so", async () => {
    const { db, inserted } = fakeDb([], { insertError: true });
    const s = store({ project_name: "Night Film", role: "Editor" });
    expect(await attachPendingCreditClaim(db, "u1", s)).toBe("failed");
    expect(inserted).toHaveLength(0);
    expect(s.has()).toBe(true);
    expect(console.error).toHaveBeenCalled();
  });

  it("keeps the claim when it cannot even check for an existing credit", async () => {
    const { db } = fakeDb([], { lookupError: true });
    const s = store({ project_name: "Night Film" });
    expect(await attachPendingCreditClaim(db, "u1", s)).toBe("failed");
    expect(s.has()).toBe(true);
  });

  it("does not attach the same claim twice: a retry after a half-finished sign-in is a no-op", async () => {
    const { db, inserted } = fakeDb([{ user_id: "u1", project_name: "Night Film", role: "Editor" }]);
    const s = store({ project_name: "Night Film", role: "Editor" });
    expect(await attachPendingCreditClaim(db, "u1", s)).toBe("already_attached");
    expect(inserted).toHaveLength(0);
    expect(s.has()).toBe(false);
  });

  it("another user's credit with the same name does not block this user's claim", async () => {
    const { db, inserted } = fakeDb([{ user_id: "someone-else", project_name: "Night Film", role: "Editor" }]);
    expect(await attachPendingCreditClaim(db, "u1", store({ project_name: "Night Film", role: "Editor" }))).toBe("attached");
    expect(inserted).toHaveLength(1);
  });

  it("does nothing without a claim, and drops an unreadable or empty one", async () => {
    const { db, inserted } = fakeDb();
    expect(await attachPendingCreditClaim(db, "u1", store())).toBe("none");
    const bad = store("{not json");
    expect(await attachPendingCreditClaim(db, "u1", bad)).toBe("none");
    expect(bad.has()).toBe(false);
    const empty = store({ project_name: "   " });
    expect(await attachPendingCreditClaim(db, "u1", empty)).toBe("none");
    expect(empty.has()).toBe(false);
    expect(inserted).toHaveLength(0);
  });
});
