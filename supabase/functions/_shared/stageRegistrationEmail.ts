// The confirmation email for a Stage registration, sent by rsvp-curated-stage through send-transactional-email with the service
// role (that function resolves the recipient's address from the user id, checks suppressions and queues the send). Self-contained
// on purpose: the same few lines call it from the repository's and production's rsvp-curated-stage, which have drifted apart.
// Sent once per registration state: a repeat RSVP that changes nothing sends nothing, and the idempotency key names the state.
// A paid ticket uses the same email in its ticket form, sent once when the seat is first confirmed (a webhook retry or a reload of
// the return page finds the seat already there and sends nothing).

export const STAGE_REGISTRATION_TEMPLATE = "curated-stage-registration-confirmation";
const SITE = "https://www.kretopia.com";

export interface StageForEmail {
  id: string;
  title: string | null;
  starts_at: string;
  ends_at?: string | null;
  visibility?: string | null;
}

export type RegistrationStatus = "rsvp" | "waitlist";

/** What was paid for a ticket, as Stripe reports it (amount in the currency's minor unit). */
export interface TicketPaid {
  amountCents?: number | null;
  currency?: string | null;
}

/** "12.00 EUR": built by hand, not Intl, so it reads the same in every runtime. Null when nothing usable was reported. */
export function formatTicketAmount(t: TicketPaid | null | undefined): string | null {
  if (!t || typeof t.amountCents !== "number" || !Number.isFinite(t.amountCents) || t.amountCents <= 0) return null;
  const currency = (t.currency || "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) return null;
  return `${(t.amountCents / 100).toFixed(2)} ${currency}`;
}

/** Send only for a new registration or a changed state (waitlist -> spot), never for a repeat of the same answer. */
export const shouldSendRegistrationEmail = (previous: string | null | undefined, next: RegistrationStatus) => previous !== next;

/** "Thu 17 Dec 2026, 20:00 UTC": the server does not know the reader's zone; the Stage page shows their own. */
export function formatStageStartUtc(startsAt: string): string {
  const d = new Date(startsAt);
  if (Number.isNaN(d.getTime())) return "See the Stage page";
  // Built from UTC parts, not Intl: ICU's punctuation differs between runtimes (Deno, Node, browsers).
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const gcalStamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export function stageRegistrationTemplateData(input: {
  stage: StageForEmail;
  status: RegistrationStatus;
  attendeeName?: string | null;
  hostName?: string | null;
  /** The invite token the person used, kept in their link for a private Stage so the page opens for them. */
  inviteToken?: string | null;
  /** Set for a paid ticket: the email says the ticket is paid, and shows the amount when Stripe reported one. */
  ticket?: TicketPaid | null;
}) {
  const { stage, status } = input;
  const invite = stage.visibility === "private" && input.inviteToken ? `?invite=${encodeURIComponent(input.inviteToken)}` : "";
  const stageUrl = `${SITE}/circle/stage/${encodeURIComponent(stage.id)}${invite}`;
  const start = new Date(stage.starts_at);
  const end = stage.ends_at ? new Date(stage.ends_at) : new Date(start.getTime() + 60 * 60_000);
  const googleCalendarUrl = Number.isNaN(start.getTime())
    ? undefined
    : `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(stage.title ?? "Kretopia Stage")}&dates=${gcalStamp(start)}/${gcalStamp(end)}&details=${encodeURIComponent(stageUrl)}`;
  return {
    stageTitle: stage.title ?? "the Stage",
    status,
    startsWhen: formatStageStartUtc(stage.starts_at),
    stageUrl,
    googleCalendarUrl,
    ...(input.attendeeName ? { attendeeName: input.attendeeName } : {}),
    ...(input.hostName ? { hostName: input.hostName } : {}),
    ...(input.ticket ? { ticket: true, ...(formatTicketAmount(input.ticket) ? { paidAmount: formatTicketAmount(input.ticket)! } : {}) } : {}),
  };
}

/** Best effort: the registration is already saved, so a failed send is logged and never fails it. Resolves to whether it was queued. */
export async function sendStageRegistrationEmail(opts: {
  supabaseUrl: string;
  serviceKey: string;
  userId: string;
  stage: StageForEmail;
  status: RegistrationStatus;
  attendeeName?: string | null;
  hostName?: string | null;
  inviteToken?: string | null;
  ticket?: TicketPaid | null;
  fetchImpl?: typeof fetch;
}): Promise<boolean> {
  const doFetch = opts.fetchImpl ?? fetch;
  try {
    const res = await doFetch(`${opts.supabaseUrl}/functions/v1/send-transactional-email`, {
      method: "POST",
      headers: { Authorization: `Bearer ${opts.serviceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        templateName: STAGE_REGISTRATION_TEMPLATE,
        recipientUserId: opts.userId,
        idempotencyKey: opts.ticket
          ? `stage-ticket:${opts.stage.id}:${opts.userId}`
          : `stage-registration:${opts.stage.id}:${opts.userId}:${opts.status}`,
        templateData: stageRegistrationTemplateData(opts),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.warn("[stage-registration-email] not queued", res.status);
    return res.ok;
  } catch (e) {
    console.warn("[stage-registration-email] failed", e instanceof Error ? e.name : "error");
    return false;
  }
}

// Minimal structural type of the service-role client (as in stageTicket.ts), so this stays testable.
// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (table: string) => any };

/**
 * The paid-ticket confirmation, for the code that seats a buyer (the Stripe webhook here; production's verify-stage-ticket).
 * Call it only when the seat is new. Looks up the two names it shows and reads the backend's own address and service key.
 * Never throws: the seat is already saved.
 */
export async function sendStageTicketEmail(admin: Db, opts: {
  stage: StageForEmail & { host_user_id?: string | null };
  userId: string;
  ticket: TicketPaid;
  fetchImpl?: typeof fetch;
}): Promise<boolean> {
  try {
    const env = (globalThis as unknown as { Deno?: { env: { get(k: string): string | undefined } } }).Deno?.env;
    const supabaseUrl = env?.get("SUPABASE_URL");
    const serviceKey = env?.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return false;
    const name = async (userId: string | null | undefined) => {
      if (!userId) return null;
      const { data } = await admin.from("profiles").select("full_name").eq("user_id", userId).maybeSingle();
      return (data?.full_name as string | null | undefined) ?? null;
    };
    const [attendeeName, hostName] = await Promise.all([name(opts.userId), name(opts.stage.host_user_id)]);
    return await sendStageRegistrationEmail({
      supabaseUrl, serviceKey, userId: opts.userId, stage: opts.stage, status: "rsvp", attendeeName, hostName,
      ticket: opts.ticket, fetchImpl: opts.fetchImpl,
    });
  } catch (e) {
    console.warn("[stage-registration-email] ticket email failed", e instanceof Error ? e.name : "error");
    return false;
  }
}
