import { blockedExplanation, describeReset, type Allowance } from "@/lib/aiAllowance";

interface KretoQuotaIndicatorProps {
  /** From useAiAllowance. Null (signed out, or the overview is unavailable) renders nothing: never an empty box or an error in the composer. */
  allowance: Allowance | null;
  now: Date;
}

/** Id of the blocked notice, so the composer can point to it. */
export const KRETO_ALLOWANCE_NOTICE_ID = "kreto-allowance-notice";

/**
 * What is left of Kreto today, and when it comes back. Normally one quiet line (messages left and the reset), in people's terms: no
 * tokens, no backend. When the next message would be refused, a plain notice that says so and says when it resets. Numbers are the
 * server's; the larger estimate for a big request is the composer's own line.
 */
export function KretoQuotaIndicator({ allowance, now }: KretoQuotaIndicatorProps) {
  if (!allowance) return null;

  if (allowance.blocked) {
    return (
      <p id={KRETO_ALLOWANCE_NOTICE_ID} role="status" aria-live="polite" data-testid="kreto-allowance-blocked" className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs leading-relaxed text-foreground">
        {blockedExplanation(allowance, now)}
      </p>
    );
  }

  const { messages } = allowance;
  const reset = describeReset(allowance.resetsAt, now);
  const parts: string[] = [];
  if (messages) parts.push(`${messages.left} of ${messages.cap} messages left today`);
  parts.push(`resets in ${reset.wait} (midnight UTC)`);

  return (
    <p className="text-[11px] text-muted-foreground" aria-live="polite" data-testid="kreto-allowance">
      {parts.join(" · ")}
    </p>
  );
}

export default KretoQuotaIndicator;
