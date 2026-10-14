// Per-actor and per-recipient send budget for senders that call Resend directly.
// Imported by edge functions (Deno) and by tests (Vite). No dependency.
//
// Why: send-project-invitation and send-outreach-email (through our own domain)
// had no limit at all: one signed-in account could mail any number of addresses,
// and a project invitation also mints a magic link and, for an unknown address,
// creates a passwordless account. A durable per-account send registry is a
// schema proposal (docs/roadmap/proposal-outbound-send-registry.md); until it is
// approved this uses what already exists: the `email_send_log` table, whose
// `metadata` JSON column carries the acting user id and whose `created_at` is
// indexed. Rows written here use their own template names, so they never mix with
// the transactional queue's counts.
//
// Rule: the count is taken BEFORE anything is created or sent. A count that
// could not be read is not zero: it answers 503 and nothing is sent.

export const PROJECT_INVITE_TEMPLATE = "project-invitation-direct";
export const OUTREACH_TEMPLATE = "outreach-direct";

export const PROJECT_INVITES_PER_ACTOR_PER_HOUR = 20;
export const PROJECT_INVITES_PER_RECIPIENT_PER_HOUR = 3;
export const OUTREACH_PER_ACTOR_PER_HOUR = 30;
export const OUTREACH_PER_RECIPIENT_PER_HOUR = 3;

export type BudgetDecision =
  | { ok: true }
  | { ok: false; status: 429 | 503; error: string };

export function decideSendBudget(f: {
  /** Sends by this actor in the window; null when the count failed. */
  actorCount: number | null;
  /** Sends to this recipient in the window; null when the count failed. */
  recipientCount: number | null;
  actorLimit: number;
  recipientLimit: number;
}): BudgetDecision {
  if (f.actorCount === null || f.recipientCount === null) {
    return { ok: false, status: 503, error: "Could not check your sending limit, try again shortly" };
  }
  if (f.actorCount >= f.actorLimit) {
    return { ok: false, status: 429, error: "You have sent too many messages in the last hour, try again later" };
  }
  if (f.recipientCount >= f.recipientLimit) {
    return { ok: false, status: 429, error: "This address was contacted too recently, try again later" };
  }
  return { ok: true };
}

// Minimal structural type of the service-role client, so this stays testable.
// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (table: string) => any };

const sinceIso = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

export async function countActorSends(db: Db, actorId: string, template: string, sinceMinutes = 60): Promise<number | null> {
  const { count, error } = await db
    .from("email_send_log")
    .select("id", { count: "exact", head: true })
    .eq("template_name", template)
    .eq("metadata->>actor_user_id", actorId)
    .in("status", ["pending", "sent"])
    .gte("created_at", sinceIso(sinceMinutes));
  return error ? null : (count ?? 0);
}

export async function countRecipientSends(db: Db, recipientEmail: string, template: string, sinceMinutes = 60): Promise<number | null> {
  const { count, error } = await db
    .from("email_send_log")
    .select("id", { count: "exact", head: true })
    .eq("template_name", template)
    .eq("recipient_email", recipientEmail)
    .in("status", ["pending", "sent"])
    .gte("created_at", sinceIso(sinceMinutes));
  return error ? null : (count ?? 0);
}

/** Writes the registry row. Returns false if it could not be written. */
export async function recordActorSend(
  db: Db,
  row: { template: string; actorId: string; recipientEmail: string; status: "pending" | "sent" | "failed"; errorMessage?: string | null },
): Promise<boolean> {
  const { error } = await db.from("email_send_log").insert({
    message_id: `${row.template}:${row.actorId}:${crypto.randomUUID()}`,
    template_name: row.template,
    recipient_email: row.recipientEmail,
    status: row.status,
    error_message: row.errorMessage ?? null,
    metadata: { actor_user_id: row.actorId },
  });
  return !error;
}
