import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { creditGuestWallet, guestTopupMismatch } from "../../../supabase/functions/_shared/guestWalletCredit";

const read = (p: string) => readFileSync(resolve(__dirname, "../../../", p), "utf8");

type Row = { id: string; balance_cents: number };

// A tiny in-memory stand-in for the service-role client. A read resolves from the value it saw when it
// was issued, one macrotask later, so concurrent callers all read the same stale balance; an UPDATE is
// applied atomically when it resolves, which is what a guarded UPDATE does in Postgres.
function fakeDb(rows: Row[], opts: { failUpdate?: boolean; failRead?: boolean } = {}) {
  const table = new Map(rows.map((r) => [r.id, { ...r }]));
  const db = {
    from(_t: string) {
      let mode: "select" | "update" = "select";
      let patch: Partial<Row> = {};
      const eqs: Array<[string, unknown]> = [];
      const q: any = {
        select() {
          return q;
        },
        update(p: Partial<Row>) {
          mode = "update";
          patch = p;
          return q;
        },
        eq(c: string, v: unknown) {
          eqs.push([c, v]);
          return q;
        },
        maybeSingle() {
          if (opts.failRead) return Promise.resolve({ data: null, error: { message: "boom" } });
          const id = eqs.find(([c]) => c === "id")?.[1] as string;
          const row = table.get(id);
          const snap = row ? { ...row } : null;
          return new Promise((res) => setTimeout(() => res({ data: snap, error: null }), 0));
        },
        then(resolveFn: (v: unknown) => void) {
          if (mode !== "update") return resolveFn({ data: null, error: null });
          if (opts.failUpdate) return resolveFn({ data: null, error: { message: "boom" } });
          return setTimeout(() => {
            const matched: Row[] = [];
            for (const row of table.values()) {
              if (eqs.every(([c, v]) => (row as any)[c] === v)) {
                Object.assign(row, patch);
                matched.push({ ...row });
              }
            }
            resolveFn({ data: matched.map((r) => ({ id: r.id })), error: null });
          }, 0);
        },
      };
      return q;
    },
  };
  return { db, table };
}

describe("creditGuestWallet", () => {
  it("adds the amount to the balance", async () => {
    const { db, table } = fakeDb([{ id: "w", balance_cents: 500 }]);
    expect(await creditGuestWallet(db, "w", 2500)).toEqual({ ok: true, balance: 3000 });
    expect(table.get("w")!.balance_cents).toBe(3000);
  });

  it("refuses an amount that is not a positive whole number of cents, and writes nothing", async () => {
    for (const cents of [0, -1, 1.5, NaN, Infinity, "100" as unknown as number, 2 ** 60]) {
      const { db, table } = fakeDb([{ id: "w", balance_cents: 500 }]);
      expect(await creditGuestWallet(db, "w", cents)).toEqual({ ok: false });
      expect(table.get("w")!.balance_cents).toBe(500);
    }
  });

  it("refuses a credit that would overflow the integer column", async () => {
    const { db, table } = fakeDb([{ id: "w", balance_cents: 2_147_483_000 }]);
    expect(await creditGuestWallet(db, "w", 1000)).toEqual({ ok: false });
    expect(table.get("w")!.balance_cents).toBe(2_147_483_000);
  });

  it("a wallet that is gone or cannot be read, or a write that fails, credits nothing", async () => {
    expect(await creditGuestWallet(fakeDb([]).db, "w", 100)).toEqual({ ok: false });
    expect(await creditGuestWallet(fakeDb([{ id: "w", balance_cents: 1 }], { failRead: true }).db, "w", 100)).toEqual({ ok: false });
    const f = fakeDb([{ id: "w", balance_cents: 1 }], { failUpdate: true });
    expect(await creditGuestWallet(f.db, "w", 100)).toEqual({ ok: false });
    expect(f.table.get("w")!.balance_cents).toBe(1);
  });

  it("simultaneous credits are never lost: the balance is exactly the sum of the credits that succeeded", async () => {
    const { db, table } = fakeDb([{ id: "w", balance_cents: 1000 }]);
    const results = await Promise.all(Array.from({ length: 10 }, () => creditGuestWallet(db, "w", 100, 12)));
    expect(results.every((r) => r.ok)).toBe(true);
    expect(table.get("w")!.balance_cents).toBe(2000);
  });

  it("with fewer attempts than competitors some credits report failure, and the balance still equals what succeeded", async () => {
    const { db, table } = fakeDb([{ id: "w", balance_cents: 0 }]);
    const results = await Promise.all(Array.from({ length: 10 }, () => creditGuestWallet(db, "w", 100, 3)));
    const won = results.filter((r) => r.ok).length;
    expect(won).toBeGreaterThan(0);
    expect(table.get("w")!.balance_cents).toBe(won * 100);
  });
});

describe("guestTopupMismatch", () => {
  const topup = { id: "t1", wallet_id: "w1", amount_cents: 2500 };
  const session = { mode: "payment", amount_total: 2500, currency: "usd", metadata: { topup_id: "t1", wallet_id: "w1", kind: "guest_wallet_topup" } };

  it("the session this row was created for matches", () => {
    expect(guestTopupMismatch(topup, session)).toBeNull();
    expect(guestTopupMismatch(topup, { ...session, currency: "USD" })).toBeNull();
  });

  it("any difference refuses: amount, currency, wallet, top-up id, mode, missing metadata", () => {
    for (const patch of [
      { amount_total: 100 }, { amount_total: null }, { currency: "eur" }, { currency: null },
      { metadata: { ...session.metadata, wallet_id: "other" } }, { metadata: { ...session.metadata, topup_id: "other" } },
      { metadata: null }, { mode: "subscription" }, { mode: undefined },
    ]) {
      expect(guestTopupMismatch(topup, { ...session, ...patch } as never)).not.toBeNull();
    }
  });
});

describe("guest-wallet-webhook wiring", () => {
  const src = read("supabase/functions/guest-wallet-webhook/index.ts");
  const at = (n: string) => {
    const i = src.indexOf(n);
    expect(i, `missing: ${n}`).toBeGreaterThan(-1);
    return i;
  };

  it("keeps the signature, mode, event-ledger and paid checks", () => {
    expect(src).toContain("constructEventAsync(rawBody, signature, webhookSecret)");
    expect(src).toContain("assertEventMatchesMode(event.livemode)");
    expect(src).toContain('session.payment_status !== "paid"');
    expect(src).toContain('kind !== "guest_wallet_topup"');
  });

  it("matches the session to its row before claiming or crediting", () => {
    expect(at("guestTopupMismatch(topup, session)")).toBeLessThan(at('.update({ status: "succeeded" })'));
    expect(at("guestTopupMismatch(")).toBeLessThan(at("creditGuestWallet("));
  });

  it("reads the claim's result and credits by compare-and-set instead of read-then-write", () => {
    expect(src).toMatch(/\.eq\("status", "pending"\)\s*\n\s*\.select\("id"\)/);
    expect(src).toContain("if (!claimed?.length)");
    expect(src).not.toContain("balance_cents: newBalance");
    expect(at('.update({ status: "succeeded" })')).toBeLessThan(at("creditGuestWallet("));
  });

  it("gives the claim and the event ledger row back when the credit fails, so Stripe's retry is processed", () => {
    expect(src).toContain("GUEST TOP-UP CLAIMED BUT NOT CREDITED");
    expect(src).toContain('.update({ status: "pending" })');
    expect(src).toContain('from("stripe_webhook_events").delete().eq("event_id", event.id)');
    expect(at("ledgerRowHeld = false; // the event is done")).toBeGreaterThan(at("creditGuestWallet("));
  });

  it("a failed audit line cannot undo or repeat the credit", () => {
    expect(src).toContain("audit log failed");
  });
});

describe("guest-wallet-session wiring", () => {
  const src = read("supabase/functions/guest-wallet-session/index.ts");
  const at = (n: string) => {
    const i = src.indexOf(n);
    expect(i, `missing: ${n}`).toBeGreaterThan(-1);
    return i;
  };

  it("draws the verification code from the CSPRNG", () => {
    expect(src).not.toContain("Math.random");
    expect(src).toContain("crypto.getRandomValues(rand)");
  });

  it("takes the attempt before comparing the code, conditional on the count that was read", () => {
    expect(src).toContain('.eq("attempts", record.attempts)');
    expect(at('.eq("attempts", record.attempts)')).toBeLessThan(at("hashCode(email, code)"));
    expect(src).not.toMatch(/attempts: record\.attempts \+ 1 \}\)\s*\n\s*\.eq\("id", record\.id\);\s*\n\s*return json\(\{ error: "Incorrect code" \}/);
  });

  it("consumes a code once, conditionally, and reads the result", () => {
    expect(src).toContain('.is("consumed_at", null)\n      .select("id")');
    expect(src).toContain("if (!consumed?.length)");
  });

  it("keeps the per-email request limit, the expiry and the fail-closed email behaviour", () => {
    expect(src).toContain("(count ?? 0) >= 5");
    expect(src).toContain("record.attempts >= 5");
    expect(src).toContain("Email verification is temporarily unavailable");
  });
});
