import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { claimWebhookEvent, releaseWebhookEvent } from "../../../supabase/functions/_shared/webhookLedger";

const read = (p: string) => readFileSync(resolve(__dirname, "../../../", p), "utf8");

// An in-memory stand-in for `stripe_webhook_events`: a primary key on event_id (23505 on a duplicate).
function fakeLedger(opts: { failInsert?: "other" | "throw"; failDelete?: boolean } = {}) {
  const rows = new Map<string, unknown>();
  const db = {
    from(_t: string) {
      return {
        insert(row: { event_id: string }) {
          if (opts.failInsert === "other") return Promise.resolve({ error: { code: "42P01", message: "relation does not exist" } });
          if (rows.has(row.event_id)) return Promise.resolve({ error: { code: "23505", message: "duplicate key" } });
          rows.set(row.event_id, row);
          return Promise.resolve({ error: null });
        },
        delete() {
          return {
            eq(_c: string, id: string) {
              if (opts.failDelete) return Promise.resolve({ error: { message: "boom" } });
              rows.delete(id);
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  };
  return { db, rows };
}

describe("claimWebhookEvent / releaseWebhookEvent", () => {
  const event = { id: "evt_1", type: "checkout.session.completed" };

  it("the first delivery claims the event, a second delivery is a duplicate", async () => {
    const { db } = fakeLedger();
    expect(await claimWebhookEvent(db, event)).toBe("claimed");
    expect(await claimWebhookEvent(db, event)).toBe("duplicate");
  });

  it("a ledger that cannot be written is 'unrecorded', so the event is still processed and there is nothing to release", async () => {
    const { db } = fakeLedger({ failInsert: "other" });
    expect(await claimWebhookEvent(db, event)).toBe("unrecorded");
  });

  it("a failed event whose row is released is claimed again by Stripe's retry (it used to be dropped as 'already seen')", async () => {
    const { db, rows } = fakeLedger();
    expect(await claimWebhookEvent(db, event)).toBe("claimed");
    // the handler fails, answers 500 and gives the row back
    expect(await releaseWebhookEvent(db, event.id)).toBe(true);
    expect(rows.has(event.id)).toBe(false);
    expect(await claimWebhookEvent(db, event)).toBe("claimed");
  });

  it("without the release the retry is dropped: this is the hole the release closes", async () => {
    const { db } = fakeLedger();
    await claimWebhookEvent(db, event);
    expect(await claimWebhookEvent(db, event)).toBe("duplicate");
  });

  it("releasing one event does not touch another", async () => {
    const { db, rows } = fakeLedger();
    await claimWebhookEvent(db, { id: "evt_a", type: "x" });
    await claimWebhookEvent(db, { id: "evt_b", type: "x" });
    await releaseWebhookEvent(db, "evt_a");
    expect([...rows.keys()]).toEqual(["evt_b"]);
  });

  it("a release that fails reports false instead of throwing", async () => {
    const { db } = fakeLedger({ failDelete: true });
    await claimWebhookEvent(db, event);
    expect(await releaseWebhookEvent(db, event.id)).toBe(false);
    const throwing = { from: () => { throw new Error("network"); } };
    expect(await releaseWebhookEvent(throwing as never, event.id)).toBe(false);
  });
});

describe("stripe-marketplace-webhook wiring", () => {
  const src = read("supabase/functions/stripe-marketplace-webhook/index.ts");
  const at = (n: string) => {
    const i = src.indexOf(n);
    expect(i, `missing: ${n}`).toBeGreaterThan(-1);
    return i;
  };

  it("still verifies the signature and the mode before it touches the ledger", () => {
    expect(src).toContain("constructEventAsync(");
    expect(src).toContain("assertEventMatchesMode(event.livemode)");
    expect(at("assertEventMatchesMode(event.livemode)")).toBeLessThan(at("claimWebhookEvent("));
  });

  it("answers a duplicate with 200 and owns the event otherwise", () => {
    expect(src).toContain('ledgerClaim === "duplicate"');
    expect(src).toContain("idempotent_event: true");
    expect(src).toContain('ledgerClaim === "claimed"');
  });

  it("gives the ledger row back before every non-2xx answer a retry can fix", () => {
    const invoice = src.slice(at("if (invoicePaidErr)"), at("if (invoicePaidErr)") + 420);
    expect(invoice.indexOf("await releaseLedger?.()")).toBeGreaterThan(-1);
    expect(invoice.indexOf("await releaseLedger?.()")).toBeLessThan(invoice.indexOf("status: 500"));
    const order = src.slice(at("if (orderError)"), at("if (orderError)") + 260);
    expect(order.indexOf("await releaseLedger?.()")).toBeLessThan(order.indexOf("status: 500"));
    const outer = src.slice(at('logStep("ERROR", { message: String(error) })'));
    expect(outer.indexOf("await releaseLedger?.()")).toBeLessThan(outer.indexOf("status: 500"));
  });

  it("does not release for a product that does not exist (a retry cannot fix it)", () => {
    const notFound = src.slice(at('logStep("Product not found"'), at('logStep("Product not found"') + 140);
    expect(notFound).not.toContain("releaseLedger");
  });
});

describe("stripe-wallet-webhook wiring", () => {
  const src = read("supabase/functions/stripe-wallet-webhook/index.ts");
  const at = (n: string) => {
    const i = src.indexOf(n);
    expect(i, `missing: ${n}`).toBeGreaterThan(-1);
    return i;
  };

  it("keeps the signature, mode and secret checks", () => {
    expect(src).toContain("constructEventAsync(body, sig, secret)");
    expect(src).toContain("assertEventMatchesMode(event.livemode)");
    expect(src).toContain("STRIPE_WALLET_WEBHOOK_SECRET");
  });

  it("reads the result of each status update and fails the event if it cannot be written", () => {
    expect(src).toContain("if (acctErr) throw");
    expect(src).toContain("if (payoutErr) throw");
  });

  it("answers 500 and releases the ledger row on a failure instead of 'ok'", () => {
    const catchBlock = src.slice(at('log("handler error"'));
    expect(catchBlock).toContain('if (ledgerClaim === "claimed") await releaseWebhookEvent(admin, event.id)');
    expect(catchBlock).toContain("status: 500");
    expect(catchBlock.indexOf("releaseWebhookEvent")).toBeLessThan(catchBlock.indexOf("status: 500"));
  });
});
