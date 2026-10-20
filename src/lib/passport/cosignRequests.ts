import { differenceInCalendarDays } from "date-fns";

/** A co-sign request as stored in `credit_endorsements` (the requester's own rows). */
export interface CosignRequestRow {
  credit_id: string;
  token: string | null;
  endorser_name: string | null;
  status: string | null;
  requested_at: string;
  responded_at: string | null;
}

export type CosignRequestState = "pending" | "accepted" | "declined" | "expired";

export interface CosignRequest {
  creditId: string;
  state: CosignRequestState;
  signer: string;
  token: string | null;
  requestedAt: string;
  respondedAt: string | null;
}

const STATES: readonly string[] = ["pending", "accepted", "declined", "expired"];

/**
 * The requests per credit, newest first. A status this app does not know is dropped rather than guessed, so a
 * request is only ever shown as the state the database really holds.
 */
export function groupCosignRequests(rows: readonly CosignRequestRow[]): Map<string, CosignRequest[]> {
  const byCredit = new Map<string, CosignRequest[]>();
  for (const row of rows) {
    if (!row.status || !STATES.includes(row.status)) continue;
    const list = byCredit.get(row.credit_id) ?? [];
    list.push({
      creditId: row.credit_id,
      state: row.status as CosignRequestState,
      signer: row.endorser_name?.trim() || "a collaborator",
      token: row.token,
      requestedAt: row.requested_at,
      respondedAt: row.responded_at,
    });
    byCredit.set(row.credit_id, list);
  }
  for (const list of byCredit.values()) list.sort((a, b) => Date.parse(b.requestedAt) - Date.parse(a.requestedAt));
  return byCredit;
}

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

/** One plain line saying where a request stands: who, what state, and when. */
export function describeCosignRequest(request: CosignRequest, now: Date = new Date()): string {
  if (request.state === "pending") {
    const days = Math.max(0, differenceInCalendarDays(now, new Date(request.requestedAt)));
    const when = days === 0 ? "today" : `${days} day${days === 1 ? "" : "s"} ago`;
    return `Request sent to ${request.signer} · Pending, asked ${when}`;
  }
  const answered = request.respondedAt ? ` on ${day(request.respondedAt)}` : "";
  if (request.state === "accepted") return `Co-signed by ${request.signer}${answered}`;
  if (request.state === "declined") return `${request.signer} declined${answered}`;
  return `Request to ${request.signer} expired without an answer`;
}

/** The request to show for a credit: an answered yes outranks one still waiting, which outranks a no. */
export function leadingCosignRequest(requests: readonly CosignRequest[] | undefined): CosignRequest | null {
  if (!requests?.length) return null;
  return requests.find((r) => r.state === "accepted") ?? requests.find((r) => r.state === "pending") ?? requests[0];
}
