import { ArrowRight, BadgeCheck, Handshake, MessageCircle, UserPlus2 } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { CtaButton } from "@/components/ui/cta-button";

interface Props {
  firstName: string;
  /** The viewer is this Passport's owner: nothing is drawn, because none of these actions can be taken on oneself. */
  isOwner: boolean;
  isSignedIn: boolean;
  connectionStatus?: "none" | "pending" | "connected";
  isConnecting?: boolean;
  onConnect?: () => void;
  /** A signed-out visitor pressing Message, Start a project or Claim Credits: sign in first, then come back to this Passport. */
  onSignIn?: () => void;
  onMessage?: () => void;
  onPropose?: () => void;
  onInvite?: () => void;
  onClaimCredits?: () => void;
}

/** The three actions share one shape on purpose: same size, same weight, same icon slot. */
const ACTION = "min-w-0 gap-1.5 px-2 text-xs";

/**
 * Message, Start a project and Claim Credits: the three things a visitor can do with this Passport, drawn together in the "At a glance"
 * block. The rules are the same wherever they are drawn (see PassportCollaborationCta for the rest of the entry):
 *  - the owner gets none of them (nothing is drawn);
 *  - a signed-out visitor can press any of them, and each leads to sign-in, then back to this Passport;
 *  - Message and Start a project need an accepted connection (a connection request is not consent) and say so while they wait;
 *  - Claim Credits does not need a connection.
 */
export function PassportCollaborationActions({ firstName, isOwner, isSignedIn, connectionStatus = "none", onSignIn, onMessage, onPropose, onClaimCredits }: Props) {
  if (isOwner) return null;

  const pending = connectionStatus === "pending";
  const connected = connectionStatus === "connected";
  const needsConnection = isSignedIn && !connected;
  const hintId = "passport-collab-hint";
  const hint = !isSignedIn
    ? "Sign in to message, start a project or claim a credit."
    : needsConnection
      ? pending
        ? `Message and Start a project open once ${firstName} accepts your request.`
        : `Message and Start a project open once you are connected with ${firstName}.`
      : null;
  // Signed out: every action leads to sign-in. Signed in: each one runs its own flow.
  const run = (action?: () => void) => (isSignedIn ? action : onSignIn);

  return (
    <div className="space-y-2">
      <div role="group" aria-label={`Work with ${firstName}`} aria-describedby={hint ? hintId : undefined} className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Button variant="outline" onClick={run(onMessage)} disabled={needsConnection} className={ACTION}>
          <MessageCircle className="h-4 w-4 shrink-0" />
          Message
        </Button>
        <Button variant="outline" onClick={run(onPropose)} disabled={needsConnection} className={ACTION}>
          <Handshake className="h-4 w-4 shrink-0" />
          Start a project
        </Button>
        <Button variant="outline" onClick={run(onClaimCredits)} className={ACTION}>
          <BadgeCheck className="h-4 w-4 shrink-0" />
          Claim Credits
        </Button>
      </div>
      {hint && (
        <p id={hintId} className="text-xs leading-relaxed text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

/**
 * The rest of the collaboration entry, under the Passport's header: the invitation to work together, the connection request that
 * Message and Start a project wait for, the invitation to an existing project once connected, and what every request is subject to.
 * Its three actions live in the "At a glance" block (PassportCollaborationActions).
 */
export function PassportCollaborationCta({ firstName, isOwner, connectionStatus = "none", isConnecting = false, onConnect, onInvite }: Props) {
  // An owner never sees this: no message to oneself, no project with oneself, no claim on one's own record.
  if (isOwner) return null;

  const pending = connectionStatus === "pending";
  const connected = connectionStatus === "connected";

  return (
    <section className="relative space-y-4 py-5" aria-label="Collaborate on Kretopia">
      <BrandLogo size="sm" />
      <div className="space-y-2">
        <h2 className="break-words text-xl font-bold text-foreground">
          Create something great <span className="k-gradient-text">with {firstName}.</span>
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {pending ? "Connection request sent. The next step is theirs." : "Have a project in mind? Turn a first connection into your next creative partnership."}
        </p>
      </div>

      {!connected && (
        <CtaButton onClick={onConnect} disabled={pending || isConnecting} className="w-full gap-2">
          <Handshake className="h-4 w-4 shrink-0" />
          {pending ? "Request pending" : isConnecting ? "Sending…" : `Connect with ${firstName}`}
          <ArrowRight className="ml-auto h-4 w-4 shrink-0" />
        </CtaButton>
      )}

      {connected && (
        <Button variant="ghost" size="sm" onClick={onInvite} className="h-auto gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:text-foreground">
          <UserPlus2 className="h-3.5 w-3.5 shrink-0" />
          Invite to an existing project
        </Button>
      )}

      <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
        <Handshake className="mt-0.5 h-3.5 w-3.5 shrink-0 text-energy" />
        Every project invitation, role proposal and credit claim is subject to confirmation by the person or company concerned.
      </p>
    </section>
  );
}
