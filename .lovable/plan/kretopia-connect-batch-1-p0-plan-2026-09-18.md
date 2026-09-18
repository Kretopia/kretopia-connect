# Kretopia Connect — Batch 1 P0 plan

## Verified production state
- `www.kretopia.com` is active, public, published, and the primary domain for this project.
- DNS ownership and routing are verified. No DNS or domain setting will be changed.
- The visible Lovable mark is the platform-injected publish badge, not Kretopia footer code. Its current setting is visible; hiding it requires the project plan to permit that setting.

## P0 diagnosis
- **Onboarding persistence:** `src/pages/Onboarding.tsx` awaits the profile update but never checks its returned error, so later UI can continue as if the Passport exists after a rejected write.
- **Completion feedback:** onboarding uses generic progress messages and has no durable, per-stage guard for the requested profile-created, Step 2, and Step 3 confirmations.
- **Recurring modal:** `src/components/ProfileActivationGate.tsx` renders an always-open, non-dismissible Dialog whenever minimum discovery requirements are missing. It is mounted by Circle and Browse, so returning to those surfaces recreates the blocking modal. This is the repeat trigger—not the explicit Passport edit dialog.
- **Passport access:** the Passport page itself does not auto-open its edit dialog; it opens only from explicit edit actions.

## Implementation
1. **Platform badge**
   - Request the native setting to hide the published “Edit/Made with Lovable” badge.
   - If the plan rejects the change, leave code and legal footer untouched and report the manual path: Project Settings → General → Publishing → badge visibility.

2. **Truthful onboarding saves and confirmations**
   - Refactor the onboarding profile write into a checked persistence operation: surface “Saving your profile…” while pending, stop immediately on a returned error, and show “Profile not saved yet. Try again.” on failure.
   - Use the persisted `onboarding_step`/`onboarding_completed` state as the durable source of truth.
   - Add one confirmation per successful milestone with accessible dismissal and a next action:
     - profile created: “Your Creative Passport is live. Let’s make it recognisable.”
     - Step 2: “Your creative direction is set. Now add the details that help Kreto find the right people and Calls.”
     - Step 3/final completion: “You’re in. Your Passport is ready to grow — Kreto has a few next moves for you.”
   - Ensure refreshes and auth returns do not replay completed notifications.

3. **Remove the recurring customization trap**
   - Replace the always-open Dialog in `ProfileActivationGate` with a non-blocking inline activation panel that preserves discovery requirements and import/manual-completion actions.
   - Keep the user free to navigate to and view their Passport.
   - Preserve deliberate editing through the existing Passport edit action only.
   - Remove the timer-based page reload after import; re-check completion from confirmed persisted data instead.

4. **Tests**
   - Add focused tests for successful/failed profile persistence and milestone notification deduplication.
   - Add component tests proving incomplete discovery is non-blocking, explicit profile editing still opens, and refresh/auth-return state does not reopen a modal.
   - Run the repository’s P0-relevant tests, lint, typecheck, and build through the normal verification harness.
   - Browser-check public startup on `www.kretopia.com` and authenticated onboarding when a test session is available; verify no blank screen, no `supabaseUrl is required`, and no critical console errors.

## Files in Batch 1
- `src/pages/Onboarding.tsx`
- `src/components/ProfileActivationGate.tsx`
- focused new test files under `src/**/__tests__/`
- `ROADMAP.md` for batch status only

## Boundaries
- No publish, DNS, custom-domain, payment, broad database, RLS, or Git-history changes.
- The attached `Kretopia Overview — September 2026` is a CPO product overview, not explicitly a Chief UX Designer specification. It informs product truth and terminology, but P5 will not claim a Chief UX document was executed unless that specific document is supplied or identified.