// Pure, dependency-free rules for send-get-paid-link: "may this caller email
// this person a get-paid link, and what text may go in it". Imported by edge
// functions (Deno) and by tests (Vite).
//
// Why: the function took a recipient address, a project title, a display name
// and a free-text message from any signed-in user, interpolated them unescaped
// into a Kretopia-branded payment email from our own domain, and never checked
// that the project was the caller's. Any account (free to create) could send a
// "someone wants to pay you" phishing mail to anyone, with its own HTML.
//
// Rule: the caller must hold money access on the project they name (the owner,
// or an accepted collaborator or creative: the same tier that sees amounts); the
// project title comes from the database, not from the request; every
// interpolated value is escaped and clipped. A failed access lookup is not "no":
// it answers 503 and sends nothing.

import { cleanRecipientEmail } from "./outboundText.ts";

export const GET_PAID_NAME_MAX = 80;
export const GET_PAID_MESSAGE_MAX = 500;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type GetPaidAccess =
  | { ok: true; canSeeMoney: boolean }
  | { ok: false; status: 401 | 403 | 503 };

export interface GetPaidFacts {
  projectId: unknown;
  recipientEmail: unknown;
  access: GetPaidAccess;
}

export type GetPaidDecision =
  | { ok: true; recipientEmail: string }
  | { ok: false; status: 400 | 401 | 403 | 503; error: string };

export function decideGetPaidLink(f: GetPaidFacts): GetPaidDecision {
  if (typeof f.projectId !== "string" || !UUID_RE.test(f.projectId)) {
    return { ok: false, status: 400, error: "projectId is required" };
  }
  const recipientEmail = cleanRecipientEmail(f.recipientEmail);
  if (!recipientEmail) return { ok: false, status: 400, error: "A valid recipient email is required" };

  if (f.access.ok === false) {
    if (f.access.status === 503) return { ok: false, status: 503, error: "Could not verify project access" };
    if (f.access.status === 401) return { ok: false, status: 401, error: "Authentication required" };
    return { ok: false, status: 403, error: "You cannot send payment links for this project" };
  }
  if (!f.access.canSeeMoney) {
    return { ok: false, status: 403, error: "You cannot send payment links for this project" };
  }
  return { ok: true, recipientEmail };
}
