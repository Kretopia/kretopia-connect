import { useId, useState, type ReactNode } from "react";
import { Clock, Fingerprint, ShieldAlert, ShieldCheck } from "lucide-react";

import kMarkAsset from "@/assets/brand/kretopia-k-mark.png.asset.json";
import { Button } from "@/components/ui/button";
import { DIALOG_EYEBROW, DIALOG_SURFACE } from "@/components/ui/dialogBrand.tokens";
import { cn } from "@/lib/utils";
import { IDENTITY_VERIFICATION_POLICY, type IdentityPolicy, type IdentityStatus } from "@/lib/identity/identityVerification";

export interface IdentityVerificationStepProps {
  /** From the SERVER (see identityStatusFromServer). The step cannot make itself verified. */
  status: IdentityStatus;
  policy?: IdentityPolicy;
  /** The server's code for why the last attempt failed. */
  reason?: string | null;
  /**
   * The approved consent text for processing a face image. Without it nothing can be started: the step never invents consent
   * wording, and never starts anything on its own.
   */
  consent?: ReactNode;
  busy?: boolean;
  /** Whether the member can go on without being verified. False only where onboarding is gated and they hold no exception. */
  canSkip?: boolean;
  onStart?: () => void;
  onResume?: () => void;
  onRetry?: () => void;
  onRefresh?: () => void;
  onContinue?: () => void;
  /** The accessible alternative to the camera, where one exists. Not drawn when there is none. */
  onRequestManualReview?: () => void;
}

const REASON_COPY: Record<string, string> = {
  no_match: "The photo did not match closely enough.",
  unclear_image: "The photo was not clear enough to check.",
  provider_unavailable: "The check could not run just now.",
  attempts_exhausted: "There have been too many attempts for now.",
};

/**
 * The identity step of onboarding, in Kretopia's surface. It is presentation only: it receives a server-validated status and calls
 * what it is given. It opens no camera, reads no image and sends nothing, so on its own it cannot collect anything; while the policy's
 * collection switch is off it says honestly that verification is not open and offers no way to start. "Verified" appears only for the
 * server's verified status, and identity is never mixed up with credit verification: nothing here talks about credits.
 */
export function IdentityVerificationStep({
  status,
  policy = IDENTITY_VERIFICATION_POLICY,
  reason,
  consent,
  busy = false,
  canSkip = true,
  onStart,
  onResume,
  onRetry,
  onRefresh,
  onContinue,
  onRequestManualReview,
}: IdentityVerificationStepProps) {
  const titleId = useId();
  const consentId = useId();
  const [agreed, setAgreed] = useState(false);

  const closed = status !== "verified" && status !== "pending" && !policy.collection;
  const needsConsent = !closed && status !== "verified" && status !== "pending";
  const consentReady = Boolean(consent) && agreed;

  let Icon = Fingerprint;
  let title = "Verify your identity";
  let body: ReactNode = "Confirm that you are the person behind this Passport. Kretopia's servers check the result; this device never decides it.";
  let primary: { label: string; onClick?: () => void; needsConsent: boolean } | null = { label: "Start verification", onClick: onStart, needsConsent: true };

  if (status === "verified") {
    Icon = ShieldCheck;
    title = "Identity verified";
    body = "Confirmed by Kretopia's servers.";
    primary = null;
  } else if (status === "pending") {
    Icon = Clock;
    title = "We're checking your verification";
    body = "You can leave this page. The result appears here when it is ready.";
    primary = { label: "Check status", onClick: onRefresh, needsConsent: false };
  } else if (closed) {
    title = "Identity verification isn't open yet";
    body = "You can carry on without it.";
    primary = null;
  } else if (status === "failed") {
    Icon = ShieldAlert;
    title = "We couldn't verify your identity";
    body = (reason && REASON_COPY[reason]) || "We could not complete the check.";
    primary = { label: "Try again", onClick: onRetry, needsConsent: true };
  } else if (status === "cancelled") {
    title = "Verification was cancelled";
    body = "Nothing was recorded as verified. You can pick it up again.";
    primary = { label: "Resume verification", onClick: onResume, needsConsent: true };
  } else if (status === "expired") {
    title = "Your verification session expired";
    body = "Start again to get a new one.";
    primary = { label: "Start again", onClick: onStart, needsConsent: true };
  }

  const primaryDisabled = busy || !primary?.onClick || (primary.needsConsent && !consentReady);
  const showContinue = Boolean(onContinue) && (status === "verified" || canSkip);

  return (
    <section
      aria-labelledby={titleId}
      data-identity-status={status}
      className={cn("relative overflow-hidden rounded-2xl border bg-gradient-to-br from-card via-card to-energy/10 p-5 sm:p-6", DIALOG_SURFACE)}
    >
      <div aria-hidden className="pointer-events-none absolute right-4 top-4 text-energy/15">
        <Fingerprint className="h-24 w-24" strokeWidth={0.7} />
      </div>

      <div className="relative space-y-4">
        <div className="flex items-center gap-2">
          <img src={kMarkAsset.url} alt="" className="h-7 w-7 object-contain" />
          <span className={DIALOG_EYEBROW}>Kretopia · Identity</span>
        </div>

        <div role="status" aria-live="polite" className="space-y-1.5">
          <h2 id={titleId} className="flex items-center gap-2 text-xl font-semibold leading-tight tracking-tight text-foreground">
            <Icon className="h-5 w-5 shrink-0 text-energy" aria-hidden />
            {title}
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
        </div>

        {needsConsent && (
          <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
            {consent ? (
              <>
                <div className="text-xs leading-relaxed text-muted-foreground">{consent}</div>
                <label htmlFor={consentId} className="flex items-start gap-2 text-sm text-foreground">
                  <input id={consentId} type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[hsl(var(--energy))]" />
                  <span>I have read this and agree.</span>
                </label>
              </>
            ) : (
              <p className="text-xs leading-relaxed text-muted-foreground">Consent terms are not set up, so verification cannot start.</p>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {primary && (
            <Button type="button" onClick={primary.onClick} disabled={primaryDisabled} className="gap-2">
              {primary.label}
            </Button>
          )}
          {needsConsent && onRequestManualReview && (
            <Button type="button" variant="outline" onClick={onRequestManualReview} disabled={busy}>
              I can't use a camera
            </Button>
          )}
          {showContinue && (
            <Button type="button" variant={status === "verified" ? "default" : "ghost"} onClick={onContinue}>
              {status === "verified" ? "Continue" : "Not now"}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

export default IdentityVerificationStep;
