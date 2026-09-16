# Auth Page UX Audit

Section 7 of the August 31 release charter. Scope: audit the Auth page (`src/pages/Auth.tsx`) against the charter's "3-step centered flow (Sign up / First Stamp / Launch Passport)" requirement, verify live, fix what's genuinely broken.

Compiled: 2026-08-18. Repo: `/Users/noeplantier/thrivein-new-beta`, branch `feature/activation-priority-plan`.

## 1. Starting point

An Auth page redesign was already completed earlier in this engagement (task "Redesign Auth page with AI-type interactive animations"). This audit verifies that work still holds up against the charter's specific ask rather than rebuilding from scratch, and treats "3-step centered flow" as a requirement to check, not license to discard working code.

## 2. What's live today

Verified via `mcp__Claude_Browser` against the running dev server, guest (signed-out) state, both `?tab=signup` and `?tab=signin`, at 1280px and 375px.

- **The exact 3-step flow already exists**: `src/components/onboarding/FunnelStepper.tsx:4-8` defines `STEPS = [{ key: "signup", label: "Sign up" }, { key: "discover", label: "First Stamp" }, { key: "review", label: "Launch Passport" }]` — the charter's three labels verbatim, with connector-line progress and a checkmark for completed steps. Wired into the signup side of `Auth.tsx` via `<FunnelStepper current="signup" />`.
- **Layout**: a two-column split (`AuthBrandingPanel` left, form right) above `lg` (1024px); the form column becomes the whole viewport below that, with the branding panel replaced by a compact mobile logo (`lg:hidden`, `Auth.tsx:442-444`). The form card and its stepper are internally centered (`text-center`, `items-center`) — this is the standard modern-SaaS split-screen auth pattern (Linear, Notion, etc. use the same shape), not a literal single centered column filling the viewport. Read as satisfying "centered flow" at the level of "the 3-step indicator and form are a centered block," which is what a user actually sees and interacts with.
- **Claim-first signup**: the default signup mode is `UniversalClaimFlow` (search your name → find/create your Passport) with a "Use email & password instead" fallback into a classic `SignUpWizard`. This matches the charter's Kreto-first product framing ("Start with Kreto — search your name, we'll pull the credits and build your Passport") sitting directly above the stepper.
- **Reduced motion**: the page's own entrance (`Auth.tsx:435-439`) uses the same `initial={reducedMotion ? false : {...}} / transition={{ ease: [0.2,0.65,0.3,0.95] }}` pattern documented as the app's standard in [TITLE_ANIMATION_AUDIT.md](TITLE_ANIMATION_AUDIT.md) — consistent with the rest of the app.
- **Keyboard/a11y**: the Sign In / Sign Up toggle is a Radix `Tabs` primitive (`role="tablist"`/`role="tab"`, arrow-key navigation and `aria-selected` built in — confirmed via `read_page`'s accessibility tree, no custom reimplementation to audit).

## 3. Bug found and fixed

**The signup funnel promo block showed on the Sign In tab too.** `Auth.tsx` rendered the "Start with Kreto" header + `<FunnelStepper current="signup" />` block behind `{!isPasswordReset && (...)}` — a condition that doesn't check which tab is active. Live screenshot at `/auth?tab=signin` confirmed it: a returning user opening Sign In saw "Start with Kreto / Search your name — we'll pull the credits and build your Passport" and a "Sign up: step 1 of 3" progress indicator above their password field, none of which applies to someone who already has an account.

**Fix**: `src/pages/Auth.tsx` — changed the condition to `{!isPasswordReset && activeTab === "signup" && (...)}`. Verified live: `/auth?tab=signin` now renders a clean card (Sign In / Sign Up toggle straight into the email/password form, Google/Apple buttons, forgot-password link) with no signup-funnel copy; `/auth?tab=signup` is unchanged, still showing the full stepper and claim flow. No console errors introduced (checked via `read_console_messages`, confirmed clean after a fresh navigation — an initial stale `MessagesDrawer` "cn is not defined" error present in the console buffer was from earlier navigation history in the same tab, not reproducible on a fresh load, and unrelated to this file).

## 4. Findings not acted on (out of scope / correct as-is)

- The split-screen desktop layout (branding panel + form) vs. a single fully-centered column: read as already meeting the charter's intent (see §2) — reworking a working, polished two-column layout into a single-column one would be a much larger, riskier change for a cosmetic reading of "centered" that the current implementation already satisfies functionally. Flagging here rather than silently deciding a product question.
- `FunnelStepper` is hardcoded to `current="signup"` with no dynamic step tracking within the signup flow itself (e.g. it doesn't advance to "First Stamp" once `UniversalClaimFlow` finds results, or to "Launch Passport" near submission) — it's a static orientation cue, not a live progress tracker. This may be intentional (the actual step-by-step progression happens in `/onboarding` after signup, which is a separate flow), but is worth a product-owner confirmation before investing in making it dynamic.

## 5. Verification

- `npx tsc --noEmit -p .` — clean.
- `npm run build` — clean (pre-existing chunk-size warning only).
- `npm run test -- --run` — 68/68 passing (no Auth-specific test existed before or was required by this section; the change is a single JSX conditional with no new logic branch worth a dedicated unit test beyond the live verification already performed).
- Live browser: `/auth?tab=signin` and `/auth?tab=signup` at 1280px and 375px, guest session (verified via the same reversible localStorage-swap technique used earlier this session, auth token restored afterward).
