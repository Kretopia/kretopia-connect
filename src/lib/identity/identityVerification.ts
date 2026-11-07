/**
 * Identity verification, as far as it can be built WITHOUT collecting anything.
 *
 * What exists today is not a provider: a selfie compared to the member's own profile photo by a general-purpose model behind the Lovable AI
 * gateway (see docs/product/IDENTITY_VERIFICATION_TRACE.md). It proves a selfie resembles a photo the member supplied, not who they are, and
 * it processes biometric data with no approved provider, current consent terms, retention rules or manual path. So this module holds only
 * what is safe regardless of how that is settled: the policy (both switches OFF), the states a verification can be in, how a state is read
 * from SERVER data, and the rule that decides whether onboarding may wait on it. Nothing here opens a camera, sends an image or calls a
 * network; it is separate from credit verification (lib/passport/creditEvidence), which says whether a CREDIT is confirmed.
 */

export interface IdentityPolicy {
  /** The app may open the camera or send an image anywhere for identity verification. */
  collection: boolean;
  /** Finishing onboarding waits for a verified identity. */
  requiredForOnboarding: boolean;
}

/**
 * Both OFF, on purpose. Turning either on is a decision for a person, after every approval below is confirmed; no test, config or
 * environment variable flips it.
 */
export const IDENTITY_VERIFICATION_POLICY: Readonly<IdentityPolicy> = Object.freeze({
  collection: false,
  requiredForOnboarding: false,
});

/** What must be confirmed, by a person, before collection or enforcement is switched on. */
export const IDENTITY_VERIFICATION_APPROVALS = [
  { id: "provider", label: "An approved identity-verification provider, with access and an agreement in place" },
  { id: "consent", label: "Current consent and privacy terms for processing a face image" },
  { id: "retention", label: "Retention and deletion rules for what is sent and what comes back" },
  { id: "exception", label: "An accessible, manual exception path for members who cannot or will not use a camera" },
] as const;

export type IdentityStatus = "not_started" | "pending" | "verified" | "failed" | "cancelled" | "expired";

/**
 * What the SERVER holds about one member's verification. Today only `id_verified` exists: a profile column that clients cannot write
 * (migration 20260904150000_lock_profiles_privileged_columns), set by an administrator or by server code. `session` is the shape a future
 * provider session record must have; nothing writes it yet, so nothing reads anything but `id_verified` from a real row.
 */
export interface ServerIdentityRecord {
  id_verified?: boolean | null;
  session?: {
    status: "pending" | "approved" | "failed" | "cancelled" | "expired";
    /** A code from the server, never free text from the client. */
    reason?: string | null;
    expires_at?: string | null;
  } | null;
}

/**
 * The state of a verification, from server data only. There is no way to pass "verified" in from a component: the one input that
 * produces it is the server's `id_verified`, and a provider saying "approved" without that column being set is still pending.
 */
export function identityStatusFromServer(record: ServerIdentityRecord | null | undefined, now: number = Date.now()): IdentityStatus {
  if (record?.id_verified === true) return "verified";
  const session = record?.session;
  if (!session) return "not_started";
  switch (session.status) {
    case "pending":
    case "approved": {
      const expiresAt = session.expires_at ? Date.parse(session.expires_at) : NaN;
      return session.status === "pending" && Number.isFinite(expiresAt) && expiresAt <= now ? "expired" : "pending";
    }
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
    case "expired":
      return "expired";
    default:
      return "not_started";
  }
}

export type IdentityAction = "none" | "wait" | "unavailable" | "start" | "resume" | "retry";

/** What the member can do next. While collection is off nothing can be started, and the answer says so instead of offering a dead button. */
export function nextIdentityAction(status: IdentityStatus, policy: IdentityPolicy = IDENTITY_VERIFICATION_POLICY): IdentityAction {
  if (status === "verified") return "none";
  if (status === "pending") return "wait";
  if (!policy.collection) return "unavailable";
  if (status === "cancelled") return "resume";
  if (status === "failed") return "retry";
  return "start";
}

export type OnboardingGate =
  | { blocked: false; reason: "not_required" | "collection_off" | "existing_member" | "manual_exception" | "verified" }
  | { blocked: true; reason: "identity_verification_required" };

/**
 * Whether finishing onboarding must wait for a verified identity. It never blocks:
 *  - while the requirement is off (today);
 *  - when collection is off, because a step nobody can complete must not trap anyone;
 *  - an existing member, who finished onboarding before any requirement existed;
 *  - a member with a manual exception, the accessible alternative to the camera.
 */
export function onboardingGate(input: {
  status: IdentityStatus;
  existingMember: boolean;
  manualException?: boolean;
  policy?: IdentityPolicy;
}): OnboardingGate {
  const policy = input.policy ?? IDENTITY_VERIFICATION_POLICY;
  if (!policy.requiredForOnboarding) return { blocked: false, reason: "not_required" };
  if (!policy.collection) return { blocked: false, reason: "collection_off" };
  if (input.existingMember) return { blocked: false, reason: "existing_member" };
  if (input.manualException) return { blocked: false, reason: "manual_exception" };
  if (input.status === "verified") return { blocked: false, reason: "verified" };
  return { blocked: true, reason: "identity_verification_required" };
}
