import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  STAGE_TICKET_KIND,
  alreadyHasTicket,
  canEnterStage,
  decideStageEntry,
  entryWasChecked,
  isStageTicketSession,
  likeLiteral,
} from "../../../supabase/functions/_shared/stageTicket";

const read = (p: string) => readFileSync(resolve(__dirname, "../../../", p), "utf8");

describe("decideStageEntry", () => {
  const base = { userId: "u1", hostUserId: "host", inviteToken: null, stageInviteToken: "tok", invitedByEmail: false };

  it("a public or unlisted stage is open to anyone", () => {
    expect(decideStageEntry({ ...base, visibility: "public" })).toBe(true);
    expect(decideStageEntry({ ...base, visibility: "unlisted" })).toBe(true);
    expect(decideStageEntry({ ...base, visibility: null })).toBe(true);
  });

  it("a private stage is entered by its host, the right token, or an invitation", () => {
    expect(decideStageEntry({ ...base, visibility: "private", userId: "host" })).toBe(true);
    expect(decideStageEntry({ ...base, visibility: "private", inviteToken: "tok" })).toBe(true);
    expect(decideStageEntry({ ...base, visibility: "private", invitedByEmail: true })).toBe(true);
  });

  it("a private stage refuses everyone else: no token, a wrong token, an empty token, a stage with no token", () => {
    for (const patch of [
      {}, { inviteToken: "nope" }, { inviteToken: "" }, { stageInviteToken: null, inviteToken: "tok" },
      { stageInviteToken: "", inviteToken: "" }, { hostUserId: null }, { hostUserId: "" },
    ]) {
      expect(decideStageEntry({ ...base, visibility: "private", ...patch })).toBe(false);
    }
  });
});

describe("canEnterStage", () => {
  type Invite = { id: string; stage_id: string; email: string; status: string };
  const fakeDb = (invites: Invite[], opts: { fail?: boolean } = {}) => {
    const calls: string[] = [];
    return {
      calls,
      db: {
        from(_t: string) {
          const eqs: Record<string, string> = {};
          let pattern = "";
          let notStatus = "";
          const q: any = {
            select() { return q; },
            eq(c: string, v: string) { eqs[c] = v; return q; },
            ilike(_c: string, p: string) { pattern = p; calls.push(p); return q; },
            neq(_c: string, v: string) { notStatus = v; return q; },
            maybeSingle() {
              if (opts.fail) return Promise.resolve({ data: null, error: { message: "boom" } });
              // emulate ILIKE with Postgres's rules: `\x` is a literal x, `_` any one character, `%` any run
              let src = "";
              for (let k = 0; k < pattern.length; k++) {
                const ch = pattern[k];
                if (ch === "\\" && k + 1 < pattern.length) src += pattern[++k].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                else if (ch === "_") src += ".";
                else if (ch === "%") src += ".*";
                else src += ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
              }
              const re = new RegExp("^" + src + "$", "i");
              const hit = invites.find((i) => i.stage_id === eqs.stage_id && re.test(i.email) && i.status !== notStatus);
              return Promise.resolve({ data: hit ?? null, error: null });
            },
          };
          return q;
        },
      },
    };
  };
  const stage = { id: "s1", visibility: "private", invite_token: "tok", host_user_id: "host" };

  it("an invited email enters; a revoked or absent invitation does not", async () => {
    const ok = fakeDb([{ id: "i1", stage_id: "s1", email: "Ada@Example.com", status: "sent" }]);
    expect(await canEnterStage(ok.db, stage, { id: "u1", email: "ada@example.com" })).toBe(true);
    const revoked = fakeDb([{ id: "i1", stage_id: "s1", email: "ada@example.com", status: "revoked" }]);
    expect(await canEnterStage(revoked.db, stage, { id: "u1", email: "ada@example.com" })).toBe(false);
    expect(await canEnterStage(fakeDb([]).db, stage, { id: "u1", email: "ada@example.com" })).toBe(false);
  });

  it("an address with `_` or `%` is matched literally, never as a wildcard", async () => {
    const invites = [{ id: "i1", stage_id: "s1", email: "adaxlovelace@example.com", status: "sent" }];
    expect(await canEnterStage(fakeDb(invites).db, stage, { id: "u1", email: "ada_lovelace@example.com" })).toBe(false);
    expect(await canEnterStage(fakeDb(invites).db, stage, { id: "u1", email: "%@example.com" })).toBe(false);
    const literal = [{ id: "i1", stage_id: "s1", email: "ada_lovelace@example.com", status: "sent" }];
    expect(await canEnterStage(fakeDb(literal).db, stage, { id: "u1", email: "ada_lovelace@example.com" })).toBe(true);
  });

  it("the host and a token holder enter without a lookup; a user with no email or a failing lookup is refused", async () => {
    const f = fakeDb([]);
    expect(await canEnterStage(f.db, stage, { id: "host" })).toBe(true);
    expect(await canEnterStage(f.db, stage, { id: "u1" }, "tok")).toBe(true);
    expect(f.calls).toEqual([]);
    expect(await canEnterStage(f.db, stage, { id: "u1", email: "" })).toBe(false);
    expect(await canEnterStage(fakeDb([], { fail: true }).db, stage, { id: "u1", email: "a@b.co" })).toBe(false);
  });

  it("a stage that is not private never needs a lookup", async () => {
    const f = fakeDb([]);
    expect(await canEnterStage(f.db, { ...stage, visibility: "public" }, { id: "u1" })).toBe(true);
    expect(f.calls).toEqual([]);
  });
});

describe("likeLiteral", () => {
  it("escapes the three characters that mean something to LIKE", () => {
    expect(likeLiteral("a_b%c\\d@x.com")).toBe("a\\_b\\%c\\\\d@x.com");
    expect(likeLiteral("plain@x.com")).toBe("plain@x.com");
  });
});

describe("alreadyHasTicket / session helpers", () => {
  it("a seat or a paid order means the buyer already has a ticket", () => {
    expect(alreadyHasTicket("rsvp", 0)).toBe(true);
    expect(alreadyHasTicket("attended", 0)).toBe(true);
    expect(alreadyHasTicket(null, 1)).toBe(true);
  });
  it("a waitlist place, nothing, or only a pending order does not", () => {
    expect(alreadyHasTicket("waitlist", 0)).toBe(false);
    expect(alreadyHasTicket(undefined, 0)).toBe(false);
    expect(alreadyHasTicket(null, 0)).toBe(false);
  });
  it("only a session created for a stage ticket is a ticket, and entry_checked is a flag we set", () => {
    const meta = { kind: STAGE_TICKET_KIND, stage_id: "s", user_id: "u", entry_checked: "1" };
    expect(isStageTicketSession(meta)).toBe(true);
    for (const m of [null, undefined, {}, { ...meta, kind: "milestone" }, { ...meta, stage_id: "" }, { ...meta, user_id: "" }]) {
      expect(isStageTicketSession(m as never)).toBe(false);
    }
    expect(entryWasChecked(meta)).toBe(true);
    for (const m of [null, undefined, {}, { entry_checked: "0" }, { entry_checked: "true" }]) {
      expect(entryWasChecked(m as never)).toBe(false);
    }
  });
});

describe("checkout-stage-ticket wiring", () => {
  const src = read("supabase/functions/checkout-stage-ticket/index.ts");
  const at = (n: string) => {
    const i = src.indexOf(n);
    expect(i, `missing: ${n}`).toBeGreaterThan(-1);
    return i;
  };

  it("applies the entry rule and the one-ticket rule before it creates a Stripe session", () => {
    expect(src).toContain('from "../_shared/stageTicket.ts"');
    expect(at("canEnterStage(admin, stage, user, inviteToken)")).toBeLessThan(at("checkout.sessions.create"));
    expect(at("alreadyHasTicket(seat?.status")).toBeLessThan(at("checkout.sessions.create"));
    expect(src).toContain('"INVITE_REQUIRED"');
    expect(src).toContain("status: 403");
  });

  it("records that the entry rule was applied, and keeps the price, currency, status and idempotency key", () => {
    expect(src).toContain('entry_checked: "1"');
    expect(src).toContain("unit_amount: stage.price_cents || 0");
    expect(src).toContain('["scheduled", "live"].includes(stage.status)');
    expect(src).toContain("stage-ticket-checkout-${stage_id}-${user.id}");
  });

  it("no longer swallows the pending-order insert error", () => {
    expect(src).toContain("pending order not recorded");
    expect(src).not.toContain("best-effort */ }");
  });
});

describe("verify-stage-ticket wiring", () => {
  const src = read("supabase/functions/verify-stage-ticket/index.ts");
  const at = (n: string) => {
    const i = src.indexOf(n);
    expect(i, `missing: ${n}`).toBeGreaterThan(-1);
    return i;
  };

  it("still requires a paid session of the caller, now also a stage-ticket session", () => {
    expect(src).toContain('session.payment_status !== "paid"');
    expect(src).toContain("isStageTicketSession(session.metadata");
    expect(src).toContain('if (buyerId !== user.id) throw new Error("Buyer mismatch")');
  });

  it("seats a buyer of a private stage only after the entry rule, before it writes anything", () => {
    expect(at("entryWasChecked(")).toBeLessThan(at('from("curated_stage_orders")'));
    expect(at("canEnterStage(admin, stage, user)")).toBeLessThan(at('from("curated_stage_rsvps")'));
    expect(src).toContain('error: "INVITE_REQUIRED", paid: true');
  });

  it("records the payment even when the pending row is missing, and reads the seat's result", () => {
    expect(src).toContain('status: "paid",\n        paid_at: paidAt');
    expect(src).toContain("if (rsvpErr) throw");
    expect(src).toContain("if (orderErr) throw");
  });
});

describe("rsvp-curated-stage wiring", () => {
  const src = read("supabase/functions/rsvp-curated-stage/index.ts");
  it("uses the shared entry rule and keeps its answer", () => {
    expect(src).toContain('from "../_shared/stageTicket.ts"');
    expect(src).toContain("canEnterStage(admin, { ...stage, id: stage_id }, user, invite_token)");
    expect(src).toContain('"INVITE_REQUIRED"');
    expect(src).toContain('rsvp_count >= stage.capacity ? "waitlist" : "rsvp"');
  });
});
