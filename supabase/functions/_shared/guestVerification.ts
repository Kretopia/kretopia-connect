// Pure, dependency-free decision for the public "post an opportunity as a
// guest" verification mail. Imported by edge functions (Deno) and by tests
// (Vite).
//
// Why: verify-guest-opportunity is public by design (a guest has no account),
// and it sent a Kretopia-branded mail to whatever address the request named, with
// no cap and with the company name and title interpolated unescaped. One request
// per address per second would have been accepted: an email-bombing relay under
// our own domain. A guest can still post; the same address cannot be mailed
// more than a few times an hour.
//
// A failed count is not "zero": it answers 503 and sends nothing.

import { cleanRecipientEmail } from "./outboundText.ts";

export const GUEST_VERIFICATIONS_PER_EMAIL_PER_HOUR = 3;

export type GuestVerificationDecision =
  | { ok: true; email: string }
  | { ok: false; status: 400 | 429 | 503; error: string };

export function decideGuestVerificationSend(f: {
  email: unknown;
  /** Guest posts for this address in the last hour; null when the count failed. */
  recentCount: number | null;
}): GuestVerificationDecision {
  const email = cleanRecipientEmail(f.email);
  if (!email) return { ok: false, status: 400, error: "A valid email address is required" };
  if (f.recentCount === null) {
    return { ok: false, status: 503, error: "Could not verify this request, try again shortly" };
  }
  if (f.recentCount >= GUEST_VERIFICATIONS_PER_EMAIL_PER_HOUR) {
    return { ok: false, status: 429, error: "Too many verification emails for this address, try again later" };
  }
  return { ok: true, email };
}
