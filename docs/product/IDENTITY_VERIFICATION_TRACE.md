# Identity verification: what was traced, what is switched off

Traced from the repository on 2026-11-07. No secret was read or printed and no image was sent anywhere.

## What exists

- `src/components/onboarding/claim-flow/OptionalFaceVerifyStep.tsx` opens the camera (`getUserMedia`), draws one frame to a canvas and
  sends it as a JPEG data URL, with the profile photo URL and the name, to the edge function `verify-profile-claim`.
- `supabase/functions/verify-profile-claim/index.ts` sends the two images to the Lovable AI gateway (`ai.gateway.lovable.dev`, model
  `GEMINI_FLASH` from `_shared/aiModels.ts`, env `LOVABLE_API_KEY`) and asks a general-purpose model whether they show the same person.
  `verified` is the model's own `true` with its own confidence of at least 0.7. It writes `face_verification_attempts` (`verified`,
  `confidence`, `token`) as the service role and returns a single-use token; `claim-and-create-profile` consumes it to set
  `identity_face_verified`. Errors: 429 rate limit, 402 gateway unavailable, 500.
- `face_verification_attempts`: row-level security on, service role only. Rows carry no user.
- `profiles.id_verified`: clients cannot write it (migration `20260904150000_lock_profiles_privileged_columns`); an administrator or server
  code sets it. It drives the public "ID verified" signal (`TrustSignals`).
- **Not reachable:** `UniversalClaimFlow`, the only importer of the selfie step, is imported by no page, and `Onboarding.tsx` has no identity
  step. Today no member is asked for a selfie.

## What was not found

No identity-verification provider: no SDK, webhook, callback route or provider environment name for Persona, Onfido, Veriff, Jumio, Sumsub,
Idenfy, Stripe Identity, a liveness service or KYC, in `src/`, `supabase/` or `docs/`. The "legacy ThriveIN integration" reported by the CEO
is the selfie-against-photo model call above (ThriveIN is the former product name, e.g. `thrivein_pending_claim`). It is a lead, and it is
not a verification provider.

## Why it must not be restored as it is

1. It processes a face image with a third-party general-purpose model: no approved provider or agreement, no current consent text, no
   retention or deletion rule.
2. It proves that a selfie resembles a photo the member supplied, not who they are. There is no liveness check (a photo of a photo can
   pass) and the confidence is the model's own claim.
3. The function logs the profile id, the name, the photo URL and the model's answer, and is callable from the public perimeter. (It does
   not log the selfie.)
4. There is no accessible alternative to the camera.

## What was built (safe, switched off, not wired into sign-up)

- `src/lib/identity/identityVerification.ts`: the policy (`collection: false`, `requiredForOnboarding: false`, frozen), the four approvals,
  `identityStatusFromServer` (verified only from the server's `id_verified`; a provider saying "approved" is still pending), `nextIdentityAction`
  and `onboardingGate` (blocks nobody while the requirement or collection is off, and never an existing member or a member with a manual exception).
- `src/hooks/useIdentityVerificationStatus.ts`: reads the member's own `id_verified` and nothing else.
- `src/components/onboarding/identity/IdentityVerificationStep.tsx`: the Kretopia step for not started, pending, verified, failed, cancelled and
  expired. It has no camera and no network, cannot start without approved consent text, and says plainly that verification is not open
  while collection is off.
- Tests, with two tripwires: those files cannot reach a camera or the network, and the old selfie step stays unmounted until someone
  mounts it on purpose.

## To switch it on (people, in this order)

1. Confirm: a provider with access and an agreement; consent and privacy terms; retention and deletion rules; an accessible manual path.
2. Build what does not exist: a provider session record (status, reason, expiry, bound to the member), a server endpoint that creates the
   session, a provider callback that sets `id_verified`, and a manual-exception record.
3. Then set `collection`, mount the step, and last `requiredForOnboarding`, with existing members exempt (already in `onboardingGate`).
4. Retire or rework `verify-profile-claim` (logging, public endpoint). Do not mount `OptionalFaceVerifyStep`.
