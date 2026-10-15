// Pure checks for a ThriveFund pledge request. Imported by edge functions
// (Deno) and by tests (Vite). No dependency.
//
// Why (docs/roadmap/proposal-thrivefund-pledge-authorization-state.md, option C):
// `thrivefund-create-pledge` accepted any number above zero (no ceiling, a
// string passed the check), accepted a campaign's own creator as a backer,
// stored an unbounded message of any type, and let one account open any number
// of pledges on the same campaign. Each open pledge was counted by the
// database totals before anyone paid.
//
// Rules:
//   - the amount is a positive finite number, at most MAX_PLEDGE_AMOUNT in
//     the campaign's currency units, and has at most two decimals;
//   - the creator of a campaign cannot back it;
//   - `isAnonymous` is a literal true or false; the message is a string,
//     control characters removed, at most 500 characters, or null;
//   - an account holds one live pledge per campaign: a completed Checkout
//     session is a pledge already made, an open one is superseded (expired and
//     cancelled) by the new request, an expired one is cancelled.

export const MAX_PLEDGE_AMOUNT = 10_000;
export const BACKER_MESSAGE_MAX = 500;

export type PledgeRequestCheck =
  | { ok: true; amount: number; amountCents: number; isAnonymous: boolean; backerMessage: string | null }
  | { ok: false; status: 400 | 403; error: string };

export function checkPledgeRequest(
  input: { amount: unknown; isAnonymous: unknown; backerMessage: unknown },
  campaign: { creator_id: string | null | undefined },
  userId: string,
  maxAmount = MAX_PLEDGE_AMOUNT,
): PledgeRequestCheck {
  if (campaign.creator_id && campaign.creator_id === userId) {
    return { ok: false, status: 403, error: "You cannot back your own campaign" };
  }
  const raw = typeof input.amount === "string" && input.amount.trim() !== "" ? Number(input.amount) : input.amount;
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) {
    return { ok: false, status: 400, error: "Valid amount required" };
  }
  const cents = Math.round(raw * 100);
  if (Math.abs(raw * 100 - cents) > 1e-6) {
    return { ok: false, status: 400, error: "Amount can have at most two decimals" };
  }
  if (raw > maxAmount) {
    return { ok: false, status: 400, error: `A single pledge can be at most ${maxAmount}` };
  }
  if (cents < 1) return { ok: false, status: 400, error: "Valid amount required" };

  // eslint-disable-next-line no-control-regex
  const text = typeof input.backerMessage === "string" ? input.backerMessage.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim() : "";
  return {
    ok: true,
    amount: cents / 100,
    amountCents: cents,
    isAnonymous: input.isAnonymous === true,
    backerMessage: text ? text.slice(0, BACKER_MESSAGE_MAX) : null,
  };
}

export type OpenPledgeAction = "already_backed" | "supersede" | "dead" | "unknown";

/** What to do with a backer's earlier pledge, from its Checkout session status at Stripe. */
export function classifyOpenPledge(session: { status?: string | null } | null | undefined): OpenPledgeAction {
  if (!session) return "dead";
  switch (session.status) {
    case "complete":
      return "already_backed";
    case "open":
      return "supersede";
    case "expired":
      return "dead";
    default:
      return "unknown";
  }
}
