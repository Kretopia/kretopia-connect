// The confirmation email for a Stage registration, sent by rsvp-curated-stage through send-transactional-email with the service
// role (that function resolves the recipient's address from the user id, checks suppressions and queues the send). Self-contained
// on purpose: the same few lines call it from the repository's and production's rsvp-curated-stage, which have drifted apart.
// Sent once per registration state: a repeat RSVP that changes nothing sends nothing, and the idempotency key names the state.

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
        idempotencyKey: `stage-registration:${opts.stage.id}:${opts.userId}:${opts.status}`,
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
