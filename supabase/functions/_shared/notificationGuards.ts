// Pure decisions and one small registry helper for senders that notify people
// about something that happened (a right swipe, a session ping, a session
// update, an invoice reminder). Imported by edge functions (Deno) and by tests
// (Vite). No dependency.
//
// Why: these senders proved WHO may notify WHOM (a real swipe, the session's
// host, the invoice's issuer) but never that the notification happens once.
// Each could be called again and again with the same proof, so one real swipe,
// one RSVP list or one overdue invoice became an unbounded stream of email,
// push and in-app notifications to the same people.
//
// Rules (code-only; every field used already exists):
//   - a notification that is tied to a pair or an object is claimed once, in
//     the same `email_send_log` registry (_shared/outboundBudget.ts), under a
//     deterministic message id; the registry's partial unique index on
//     (message_id) WHERE status = 'sent' makes the claim atomic;
//   - a claim or a count that cannot be read is not "none": the answer is 503
//     and nothing is sent;
//   - a host's free text is a string, clipped, without control characters.

import { cleanFreeText } from "./outboundText.ts";

export const SWIPE_NOTIFY_TEMPLATE = "swipe-notify";
/** One account may trigger this many swipe notifications an hour: a person swiping, not a script. */
export const SWIPE_NOTIFY_PER_ACTOR_PER_HOUR = 60;

export const SESSION_PING_COOLDOWN_MS = 2 * 60_000;
export const SESSION_UPDATE_COOLDOWN_MS = 2 * 60_000;
/** A cancellation is told once; a repeat within the hour is the same cancellation. */
export const SESSION_CANCEL_COOLDOWN_MS = 60 * 60_000;

export const SESSION_REASON_MAX = 500;
export const SESSION_CHANGES_MAX_ITEMS = 8;
export const SESSION_CHANGE_ITEM_MAX = 60;

export const INVOICE_CHASE_COOLDOWN_MS = 24 * 60 * 60_000;

// ---------------------------------------------------------------------------
// Session text
// ---------------------------------------------------------------------------

/** The host's reason for a cancellation: a clipped string, or null. Never an object. */
export function cleanSessionReason(raw: unknown): string | null {
  return cleanFreeText(raw, SESSION_REASON_MAX);
}

/** The list of what changed: strings only, clipped, at most 8, no empties. */
export function cleanSessionChanges(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    const text = cleanFreeText(item, SESSION_CHANGE_ITEM_MAX);
    if (text) out.push(text);
    if (out.length >= SESSION_CHANGES_MAX_ITEMS) break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Cooldown
// ---------------------------------------------------------------------------

export type CooldownDecision =
  | { ok: true }
  | { ok: false; status: 429 | 503; error: string };

/** `recentCount` = notifications of this kind for this object inside the window; null = unreadable. */
export function decideCooldown(recentCount: number | null, waitMessage: string): CooldownDecision {
  if (recentCount === null) {
    return { ok: false, status: 503, error: "Could not check recent notifications, try again shortly" };
  }
  if (recentCount > 0) return { ok: false, status: 429, error: waitMessage };
  return { ok: true };
}

export const cooldownCutoffIso = (nowMs: number, windowMs: number) => new Date(nowMs - windowMs).toISOString();

// ---------------------------------------------------------------------------
// Invoice reminder
// ---------------------------------------------------------------------------

export interface ChaseInvoice {
  status?: string | null;
  paid_at?: string | null;
  reminder_sent_at?: string | null;
}

export type ChaseDecision =
  | { ok: true }
  | { ok: false; status: 409; reason: "settled" | "not_issued" | "reminder_recent"; error: string };

/**
 * May this invoice be chased now? A paid or cancelled invoice is never chased; a draft is not
 * sent as a reminder (it was never issued); a reminder sent in the last 24 hours is not repeated.
 * Drafting the text (send = false) only needs the invoice to be unsettled.
 */
export function decideInvoiceChase(inv: ChaseInvoice, send: boolean, nowMs: number): ChaseDecision {
  const status = typeof inv.status === "string" ? inv.status.trim().toLowerCase() : "";
  if (status === "paid" || status === "cancelled" || status === "canceled" || inv.paid_at) {
    return { ok: false, status: 409, reason: "settled", error: "This invoice is already settled; there is nothing to chase." };
  }
  if (!send) return { ok: true };
  if (status === "draft") {
    return { ok: false, status: 409, reason: "not_issued", error: "This invoice was never issued; send it before chasing it." };
  }
  const last = inv.reminder_sent_at ? Date.parse(inv.reminder_sent_at) : NaN;
  if (Number.isFinite(last) && nowMs - last < INVOICE_CHASE_COOLDOWN_MS) {
    return {
      ok: false,
      status: 409,
      reason: "reminder_recent",
      error: "A reminder was already sent for this invoice in the last 24 hours.",
    };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Once-per-pair claim (registry)
// ---------------------------------------------------------------------------

// Minimal structural type of the service-role client, so this stays testable.
// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (table: string) => any };

export type ClaimResult = "claimed" | "duplicate" | "error";

export const swipeNotifyMessageId = (swiperId: string, recipientId: string) =>
  `${SWIPE_NOTIFY_TEMPLATE}:${swiperId}:${recipientId}`;

/**
 * Claims one notification, once. The row is written with status 'sent' so the registry's partial
 * unique index on `message_id` makes a second claim fail with a unique violation (23505): that is
 * "duplicate", not an error. Any other failure is "error": the caller sends nothing.
 */
export async function claimNotificationOnce(
  db: Db,
  row: { messageId: string; template: string; actorId: string; recipientEmail: string },
): Promise<ClaimResult> {
  const { error } = await db.from("email_send_log").insert({
    message_id: row.messageId,
    template_name: row.template,
    recipient_email: row.recipientEmail,
    status: "sent",
    error_message: null,
    metadata: { actor_user_id: row.actorId },
  });
  if (!error) return "claimed";
  const code = String((error as { code?: unknown }).code ?? "");
  return code === "23505" ? "duplicate" : "error";
}

/** Frees a claim whose notification reached nobody, so a later attempt can send it. */
export async function releaseNotificationClaim(db: Db, messageId: string): Promise<void> {
  await db
    .from("email_send_log")
    .update({ status: "failed", error_message: "notification not delivered" })
    .eq("message_id", messageId)
    .eq("status", "sent");
}

/** Recent in-app notifications of one kind for one object (the cooldown count). null on error. */
export async function countRecentSessionNotifications(
  db: Db,
  q: { type: string; actionUrl: string; sinceIso: string },
): Promise<number | null> {
  const { count, error } = await db
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("type", q.type)
    .eq("action_url", q.actionUrl)
    .gte("created_at", q.sinceIso);
  return error ? null : (count ?? 0);
}
