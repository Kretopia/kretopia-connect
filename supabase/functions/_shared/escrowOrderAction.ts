// Pure request parsing for `release-escrow` (a buyer confirming or disputing a marketplace order).
// Imported by edge functions (Deno) and by tests (Vite). No dependency.
//
// Why: `reason` was used as text without being checked (`reason.substring`
// threw a TypeError AFTER the order had already been written as disputed, and
// the stored text was unbounded), and the order was updated without a
// condition on its status, so a confirm and a dispute racing each other could
// overwrite one another.

export const MAX_DISPUTE_REASON_LENGTH = 1000;

export type EscrowAction =
  | { ok: true; orderId: string; action: "confirm" }
  | { ok: true; orderId: string; action: "dispute"; reason: string }
  | { ok: false; error: string };

export function parseEscrowAction(body: unknown): EscrowAction {
  const b = (body ?? {}) as Record<string, unknown>;
  const orderId = b.orderId;
  const action = b.action;
  if (typeof orderId !== "string" || !orderId || typeof action !== "string" || !action) {
    return { ok: false, error: "orderId and action required" };
  }
  if (action === "confirm") return { ok: true, orderId, action: "confirm" };
  if (action === "dispute") {
    const raw = typeof b.reason === "string" ? b.reason.trim() : "";
    if (!raw) return { ok: false, error: "Dispute reason is required" };
    return { ok: true, orderId, action: "dispute", reason: raw.slice(0, MAX_DISPUTE_REASON_LENGTH) };
  }
  return { ok: false, error: "Invalid action. Use 'confirm' or 'dispute'." };
}
