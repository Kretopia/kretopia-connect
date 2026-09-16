# Kreto Identity + Stage + Recordings + Landing Conversion — Phase 1 Audit

Read-only. No edits made beyond this document. Compiled from four parallel source
audits plus targeted live browser spot-checks (dev server restarted mid-audit;
verified against a real render, both authenticated and guest states).

Confidence tags used throughout: **SOURCE_CONFIRMED** (read directly in code,
file:line cited), **RUNTIME_CONFIRMED** (also verified in the live app),
**NOT_CONFIRMED** (inferred or unverified — flagged explicitly, never silently assumed).

---

## A. Kreto identity map

**Components.** `src/components/brand/KretoAvatar.tsx` is the canonical full avatar —
props `size` (`xs`–`xl`), `animated` (default `true`), `state`
(`idle|thinking|listening|speaking|recording`). Renders `<img src={kreto-avatar.png}>`
inside framer-motion halo/rim spans. **SOURCE_CONFIRMED**.

`KretoSphere.tsx` is a separate, explicitly-scoped "morphing gradient orb" used only
by the desktop FAB (`KretoLauncher.tsx:71`) — not a KretoAvatar variant, don't touch
it as part of an avatar migration. **SOURCE_CONFIRMED**.

**Mount sites (full avatar).** 9 direct call sites: `ScoutedGigsSection.tsx` (×3),
`ThrivePromptHero.tsx`, `MeetKretoSection.tsx` (Landing), `ThriveAgentFab.tsx` (×4,
global chat drawer), `AuthBrandingPanel.tsx`, `KretoPassportBuilder.tsx`,
`PassportKretoEntry.tsx`, `VoiceFirstCreateModal.tsx`, `TalentFinder.tsx`. Plus
`KretoTip.tsx`, mounted on **9 of 10** tracked surfaces (Today, Discover/Scout ×2,
Match, Meetup, Recordings, KrePay, Clients, Scout) — only the Studio surface
(`WorkHome.tsx`) already swaps in a compact Sparkles chip instead, per this
session's earlier fix. **SOURCE_CONFIRMED**, all file:line cited by the sub-audit.

One inaccuracy caught in existing code: `KretoTip.tsx:148-150`'s own comment claims
`StudioCreateHero` "already renders a full KretoAvatar" — false; that component
renders a Sparkles-in-circle chip, not `KretoAvatar`. Worth a follow-up comment fix
regardless of this sprint. **SOURCE_CONFIRMED**.

**Logo/K-mark assets.** `kretopia-k-mark.png`, `kretopia-wordmark.png`,
`kretopia-lockup.png` (as `.asset.json` remote pointers) are real, actively used via
`BrandLogo.tsx` (`iconOnly`/`textOnly`/`lockup`/`size` props), mounted in Navbar,
footers, Auth, EPK editor. **This is the correct, ready-to-reuse K-mark asset** — no
need to source or redraw a logo. `logo-black.png`/`logo-white.png` exist but are
dormant (unused). **SOURCE_CONFIRMED, RUNTIME_CONFIRMED** (K-mark and wordmark
`<img>` tags with `alt="Kretopia"`/`"kretopia"` found live in the DOM during spot-check).

**No existing "signal-mark" component.** Only precedent is the ad-hoc inline
Sparkles chip in `KretoTip.tsx:189-198` — not a reusable component today; a new
`KretoMark` component would be genuinely new, not a rename. **SOURCE_CONFIRMED**.

**Accessibility violation — must fix.** `KretoAvatar.tsx:136`:
`alt="Kreto, your AI Executive Producer"`. This directly contradicts the standing
Kretopia rule that Kreto is never described as AI-powered/AI-generated to users.
**RUNTIME_CONFIRMED** — this exact string is live in the DOM on the public,
logged-out Landing page (`MeetKretoSection`) right now, readable by any screen
reader before signup. This is not cosmetic; it's a real, currently-shipping policy
violation and should be treated as higher priority than the identity redesign itself.

**Motion.** Halo pulse + spinning rim run whenever `animated` (default `true`), and
**no caller gates it on `prefers-reduced-motion`** except `KretoLauncher.tsx` (which
uses `KretoSphere`, not `KretoAvatar`). Two callers (`ScoutedGigsSection.tsx`,
`VoiceFirstCreateModal.tsx`) already call `useReducedMotion()` for other elements on
the same page but don't pass it to their `KretoAvatar` calls — this is a real,
pre-existing accessibility gap, confirmed by omission across every call site.
**SOURCE_CONFIRMED**.

**No overlap with user profile avatars.** Those use shadcn/Radix `Avatar` (183
files) — completely separate markup/imports from `KretoAvatar.tsx`. Safe to leave
untouched. **SOURCE_CONFIRMED**.

---

## B. Stage UX/UI and action map

**Naming collision, resolved.** Two unrelated "Circle" features exist:
`Circle.tsx` (`/circle` — match/browse/network + live Stage panel, the one named in
the spec) and `CircleDetail.tsx` (a separate community "Crew" hub with its own
Stages tab). This audit covers `Circle.tsx` only, per the spec's explicit
`Circle.tsx` reference. **SOURCE_CONFIRMED**.

**There is no dedicated "Stages" tab.** `circleTabs` defines exactly 3 tabs —
`match`, `browse`, `network` — via `StudioSectionTabs`. `LiveCallsPanel` (the Stage
UI) renders unconditionally **below** those tabs, not as a tab of its own.
**SOURCE_CONFIRMED and RUNTIME_CONFIRMED** — live spot-check on `/circle` shows an
"STAGES" page header but the actual selectable tabs are Match/Browse/Network, with
the live-session panel appearing beneath them. This mismatch (header says Stages,
tabs don't) is itself a source of the "scattered" feeling described in the spec.

**Component sprawl.** Within `src/components/circle/`: `LiveCallsPanel.tsx` (hub),
`SoundStagesRail.tsx` (live-only carousel), `CuratedStagesRail.tsx` (scheduled/live
rail, separate table), `GoLiveSheet.tsx` / `CreateStageSheet.tsx` (two different
creation sheets for two different stage types), `SoundStageRoom.tsx` (in-call room,
1200+ lines), plus `StageDoorsCountdown.tsx`, `StageHostConsole.tsx`,
`ApplyToStageSheet.tsx`, `InviteToStageDialog.tsx` — all four scoped only to the
separate `/circle/stage/:id` curated-stage route, not the Circle page. Two backing
tables (`sound_stages` vs `curated_stages`) with different lifecycles. **SOURCE_CONFIRMED**.

**Start/Join trace.** Start: HoloCard button → `GoLiveSheet` →
`create-sound-stage` edge function → opens `SoundStageRoom`. Join: rail card click →
`join-sound-stage` edge function → opens `SoundStageRoom`. "Find a Collaborator"
doesn't navigate at all — it flips `Circle.tsx`'s in-place tab state to `match`.
**SOURCE_CONFIRMED**.

**Card sizing is genuinely inconsistent** — confirms the spec's "anarchic" framing
with hard evidence: `SoundStagesRail` cards are fixed `w-[280px]`, `CuratedStagesRail`
cards are fixed `w-64` with `h-24` covers, primary HoloCards use a
`grid-cols-1 sm:grid-cols-2` layout, and the Browse-tab grid uses
`grid-cols-2`/`aspect-[3/4]`. No shared card component or aspect ratio across any of
them. **SOURCE_CONFIRMED**.

**Live/upcoming/replay state handling exists but is inconsistent.**
`SoundStagesRail` shows live-only; `CuratedStagesRail` shows scheduled+live with a
pulse badge for live and a formatted time for scheduled, but nothing for ended;
no rail on this page shows a "no live session, browse upcoming" fallback state as a
single coherent primary card — the spec's required hierarchy (live → upcoming →
replay → nothing) doesn't exist as one flow today, it's scattered across two rails
with two different data models. **SOURCE_CONFIRMED**.

**No recordings/replay linkage from any Stage card.** Recording is only an in-call
host toggle inside `SoundStageRoom.tsx`, uploading to Daily's workspace with no
in-app link back to `/recordings`. **SOURCE_CONFIRMED**.

**Error handling gap.** Fetch failures in `SoundStagesRail`/`LiveCallsPanel` are
swallowed via `.catch(() => setLoading(false))` — silently falls back to an empty
state indistinguishable from "genuinely nothing live right now." No dedicated error
state exists. **SOURCE_CONFIRMED**.

**Accessibility.** Reasonable coverage inside the live call room itself
(`aria-label`s on mute/screenshare/record, `aria-live="polite"`) and on the
`SoundStagesRail` carousel controls, but `CuratedStagesRail` and `GoLiveSheet` cards
have no `aria-label`s beyond native semantics, and no custom visible
`focus-visible` styling exists anywhere in this component set. **SOURCE_CONFIRMED**.

---

## C. Recordings replay flow map

**Current behavior: Replay does not open a modal at all.**
`WatchReplayButton.tsx` calls the `get-recording-link` edge function, gets a
Daily-hosted signed URL back, and does `window.open(url, "_blank")` — a plain new
browser tab pointing at Daily's own player, entirely outside Kretopia's UI.
**SOURCE_CONFIRMED**. This is the single biggest, clearest gap in this sprint: there
is currently zero in-app player code for recordings to build on top of — the modal
needs to be built from scratch (reusing existing primitives, not from zero).

**What already exists to build the modal from.** The Dialog+media pattern already
exists twice in the codebase: `MediaPlayerModal.tsx` (Dialog wrapping `<video
autoPlay controls>` / `AudioWaveformPlayer`) and `FilePreviewDialog.tsx`
(signed-URL fetch → Dialog → video/audio). Either is a legitimate direct template
for a `RecordingReplayDialog`. **SOURCE_CONFIRMED**.

**Access control is real and server-enforced**, not just client-side: the
`get-recording-link` edge function checks `created_by`, `participants` array,
`project_members`, or (for direct calls) `started_by`/`invited_user_id`, returning
403 otherwise; RLS on `call_transcripts` mirrors this via
`user_can_view_call_transcript()`. The client button itself does no authorization
check of its own — it relies entirely on the edge function. **SOURCE_CONFIRMED**.
This means a new modal can safely reuse the exact same `get-recording-link` call —
no new authorization logic needed.

**Metadata reality check — title and host name do not exist as real data.**
`call_transcripts` has no `title` column; the current UI derives a label from
`call_kind` via a static map, not a real per-recording title. `created_by` is a bare
uuid with no join to a display name in the current query. **A replay modal must not
invent a fake title or host name** — it should either show the same derived
label the list view already uses, or add a join, but must not fabricate anything not
already real. Date and duration ARE real, available fields. **SOURCE_CONFIRMED**.

**Transcript/recap already exists, but as a separate UI**, not connected to replay:
`CallRecapSheet.tsx` (a bottom Sheet, not the replay path) shows Actions/Summary/raw
Transcript tabs. No chapter/timestamp markers exist. **SOURCE_CONFIRMED**.

**Autoplay precedent in the codebase is a real gap to fix, not follow.** The
existing `MediaPlayerModal.tsx` (unrelated feature) autoplays unmuted
(`<video autoPlay controls>`, no `muted` attribute) — this is NOT the pattern to
copy; the spec explicitly requires no unmuted autoplay. **SOURCE_CONFIRMED** of the
existing (bad) precedent.

---

## D. Landing → Auth → Signup funnel map

**Route reality.** `/` (not `/landing`, which just redirects) renders
`KretopiaLanding` for guests via `UnifiedHome`. Structure, confirmed by direct
import trace: Hero → SearchTutorial → Passport chapter → VerifiedCredits chapter →
Trust → ProductLoop → Scout/Match/Studio chapters → MeetKreto → CreativeUniverse →
Community chapter → ForOrganisations → ClosingCTA → Footer. **SOURCE_CONFIRMED**.

**`BottomCTASection` and `StickyMobileCTA` are both dead code.** Both files exist
and are even imported into `UnifiedHome.tsx`, but neither is ever rendered — a
comment in the code confirms `StickyMobileCTA` was intentionally removed in favor of
a dismissible popup banner. **SOURCE_CONFIRMED and RUNTIME_CONFIRMED** — a live
DOM query found zero `position: fixed; bottom: 0` elements on the rendered page.
**This means any spec requirement assuming a mounted sticky CTA is currently false**
— it would need to be newly (re)built, not "fixed."

**14 other landing CTA/section components exist in `src/components/landing/` but
are not imported by the page that actually renders** (`LandingBelowFold.tsx`) —
orphaned/legacy, not live. Don't confuse these with the live page when scoping
changes. **SOURCE_CONFIRMED**.

**A full alternate landing variant, `OneWedgeLanding.tsx`, exists but is also
dead** — imported, never rendered, per an explicit code comment calling it "the
retired A/B variant." **SOURCE_CONFIRMED**.

**`useLandingVariant` is not a live A/B test.** It force-assigns everyone to
`"wedge"`, clears the legacy split, and is only overridable via a `?lv=` QA param.
Its output (`isWedge`) is computed in `UnifiedHome.tsx` but never actually used to
branch rendering — `KretopiaLanding` renders unconditionally regardless of variant.
**SOURCE_CONFIRMED**. Any "variant" property in new analytics events should
therefore be constant/meaningless right now, not a real experiment — don't build
variant-breakdown UI on top of it without first re-enabling a real split, or the
admin funnel view's "per-variant breakdown" requirement (§8 of the spec) would show
data for a fake experiment.

**Auth defaults to sign-in, not sign-up**, for a bare `/auth` visit —
`activeTab` initializes `"signin"` and only flips to `"signup"` if `?tab=signup` or
a claim/invite param is present. Every chapter CTA traced in this audit already
passes the right param to force signup, so this isn't broken for the traced CTAs,
but any NEW CTA added must remember to pass `?tab=signup` explicitly, or it will
silently default to sign-in. **SOURCE_CONFIRMED**.

**Redirect param inconsistency, flagged not resolved.** Landing chapter CTAs use
`?next=...`; `Auth.tsx` itself directly reads `?redirect=...`.
`computePostAuthRedirect` (in `eventAuthRedirect.ts`) wasn't opened by the
sub-audit, so whether it separately honors `next` is **NOT_CONFIRMED** — this is a
real open question worth resolving before assuming the current chapter CTAs
correctly return users to their intended destination post-signup. Recommend
confirming this explicitly before Phase 2 touches any CTA destination.

**OAuth: Google and Apple only.** No other providers found. **SOURCE_CONFIRMED**.

---

## E. Existing analytics inventory

Two independent, **not unified**, analytics paths currently write Landing-adjacent events:

1. **`analytics.ts` → `analytics_events` table.** Real, wired-in tracking already
   exists on the live page: `landing_hero_viewed`, `landing_search_focused`,
   `searchStarted`, and `ctaClick(...)` on hero example chips, every chapter CTA,
   the closing CTA (both claim + sign-in), and ForOrganisations CTAs.
   `MeetKretoSection`'s CTA has **no tracking at all** — a real gap.
   `analytics_events` currently allows **anon + authenticated INSERT** (`WITH CHECK
   (true)`, latest of 14 migrations touching this table's RLS), SELECT restricted
   to admin/own-row. **SOURCE_CONFIRMED**.
2. **`useLandingVariant.ts` → `site_analytics` table** (a *different* table).
   Fires one `view` row per session and exposes `trackLandingCta()` for click
   events — but as established in §D, the "variant" this tags every event with is
   currently constant (`"wedge"`), not experimental. **SOURCE_CONFIRMED**.

No `landingMetrics.ts` exists anywhere in the repo — the spec's proposed filename
would be new, not a rename of something existing. `deckMetrics.ts` exists and also
writes to `analytics_events`, but isn't called from any Landing component today —
it's a separate, unrelated Passport-deck feature. **SOURCE_CONFIRMED**.

**No section-view (`IntersectionObserver`) tracking exists** for chapters below the
hero, and **no scroll-depth tracking exists** anywhere — both are genuinely net-new
work, not gaps in existing instrumentation. **SOURCE_CONFIRMED** (absence verified
by the sub-audit's targeted search).

**No signup/signin attempt/success/error events exist yet** in `Auth.tsx` per the
sub-audit's findings — this entire auth-funnel instrumentation layer (§6 of the
spec) is net-new. **SOURCE_CONFIRMED** (not found in the searched files; flagging as
inferred-absence rather than exhaustively proven negative, since `Auth.tsx`'s full
body wasn't quoted back).

**`CreativeActionFunnels.tsx` is a real, working precedent** for the admin funnel
UI requirement (§8): an admin card driven by `get_creative_action_funnels(_start,
_end)`, a `SECURITY DEFINER`-style RPC granted to `authenticated`, rendering 4
funnels (Scout/Connection/Studio/Invoice) with step counts and drop-off %, mounted
in `/admin`'s Product tab. A Landing funnel panel should follow this exact
established pattern rather than invent a new one. **SOURCE_CONFIRMED**.

---

## F. Files to modify (Phase 2, pending approval)

- **Kreto identity:** `KretoAvatar.tsx` (fix `alt` text — highest priority, is a
  live policy violation right now), new `KretoMark`/similar component, then the 9
  avatar call sites + `KretoTip.tsx` + its inaccurate comment.
- **Stage:** `Circle.tsx` (tab structure), `LiveCallsPanel.tsx`, `SoundStagesRail.tsx`,
  `CuratedStagesRail.tsx` (card size unification), possibly a new shared stage-card component.
- **Recordings:** new `RecordingReplayDialog` component, `WatchReplayButton.tsx`
  (swap `window.open` for the dialog), `Recordings.tsx`.
- **Landing:** `KretopiaHero.tsx`, `kretopia/ChapterSection.tsx`, `MeetKretoSection.tsx`
  (missing tracking), new `landingMetrics.ts` (or extend `analytics.ts`), `Auth.tsx`
  (funnel events), new admin Landing-funnel panel alongside `CreativeActionFunnels.tsx`.

## G. Files to protect (do not touch in this sprint)

- `src/components/ui/avatar.tsx` and all 183 real user-avatar call sites — zero overlap with Kreto identity work, confirmed.
- `KretoSphere.tsx` / `KretoLauncher.tsx` — already correctly scoped, already handles reduced-motion correctly; don't regress it while fixing `KretoAvatar.tsx`.
- `CuratedStage.tsx` and its 4 dedicated components (`StageHostConsole.tsx` etc.) — a separate route/flow from `/circle`, out of this sprint's stated scope.
- `CircleDetail.tsx` / `hub/CircleStagesTab.tsx` — the other "Circle" feature, explicitly not what the spec named.
- The 14 orphaned `src/components/landing/*` files not imported by `LandingBelowFold.tsx`, and `OneWedgeLanding.tsx` — don't resurrect or edit dead code as part of this sprint without a separate explicit decision.
- `supabase/functions/mcp/index.ts` — standing pre-existing drift from earlier in this session, unrelated, still not staged/touched.

## H. Backend/migration requirements

- Recordings modal needs **no new backend work** — `get-recording-link` already does authorization + signed URL minting correctly; reuse as-is.
- Landing section/scroll/CTA tracking needs **no schema change** — `analytics_events` already accepts anon+authenticated inserts.
- Auth funnel events (`signup_attempt` etc.) — same table, same policy, no migration needed.
- Admin Landing-funnel panel likely needs **one new RPC** (a `get_landing_funnel(...)` sibling to `get_creative_action_funnels`), following the exact same security-definer + grant pattern. Per your standing instruction: this migration will be prepared and reviewed but **not applied** without separate explicit approval, same as every DB change this session.
- If `useLandingVariant` is meant to become a real experiment again (currently fake-constant), that's a product decision to raise separately — not assumed as part of this sprint's scope.

## I. Security/privacy concerns

- **Confirmed no new exposure needed anywhere in this plan** — Recordings reuses existing server-side authorization; analytics tables already have the right anon-insert/admin-read shape; no plan here proposes weakening RLS.
- **Do not log emails, tokens, or raw provider errors** in the new auth-funnel events — `error_category` must stay a fixed enum as specified, not a passthrough of Supabase's raw error message (which can include emails in some auth error strings).
- **`site_analytics` vs `analytics_events` duplication** (§E) is itself a minor privacy/hygiene concern worth a note: two separate tables tracking overlapping Landing behavior under two different RLS policies increases surface area without a clear reason found in this audit — worth deciding whether to consolidate, though that's a judgment call for Phase 2 planning, not something to silently merge.

## J. Test plan (for Phase 2)

- Unit/component tests for: `KretoMark` variants + reduced-motion behavior; `RecordingReplayDialog` open/close/focus-trap/Escape; new `trackLanding()` helper (no throw on failure, no duplicate fire).
- Regression run of the existing 127-test suite (currently 100% passing) after each phase.
- Manual/browser verification per §K below for anything not unit-testable (visual layout, real Stripe/Daily integration paths, RLS-gated data).

## K. Browser verification plan (for Phase 2)

- Kreto mark: verify on Today, Kreto chat, Studio, Scout, Landing at desktop + mobile widths, both light motion and `prefers-reduced-motion: reduce`.
- Stage: verify live/upcoming/empty/error states render distinctly; verify keyboard navigation through cards and tabs; verify no horizontal scroll at 375px width.
- Recordings: verify modal opens on Replay, traps focus, Escape closes and returns focus to the button, playback stops on close, no unmuted autoplay, unauthorized access still correctly 403s through the existing edge function.
- Landing: verify every CTA still lands on the correct `/auth?...` param combination post-change; verify section-view events fire once per section per load (not on every scroll tick); verify scroll-depth fires exactly at 25/50/75/100 and not continuously; verify sticky CTA (once built) respects safe-area and doesn't cover content on a real mobile viewport.

---

## Baseline (run before any edits)

- `npm run build` — **pass**.
- `npm run test` — **pass**, 127/127, 12 test files.
- `npm run typecheck` — **fails**, but for a reason unrelated to this sprint:
  `InvoiceSepaBeneficiaryCard.tsx` references `invoice_sepa_beneficiaries` /
  `set_invoice_sepa_beneficiary`, added by an earlier SEPA migration applied
  directly via Lovable's SQL editor (no CLI/MCP access in this session to
  regenerate `types.ts` afterward). Pre-existing, not caused by or blocking this
  sprint — flagging so it isn't mistaken for a regression introduced here.
- `npm run lint` — **fails**, ~13,900 pre-existing problems across the whole repo
  (overwhelmingly `@typescript-eslint/no-explicit-any` in edge functions). Also
  pre-existing, repo-wide, unrelated to this sprint's scope.

---

**Status: awaiting your explicit approval before any edit, per the sprint's own
Phase 1 instruction.** One item above is worth flagging as higher-priority than the
rest of the identity redesign: the `alt="Kreto, your AI Executive Producer"` text is
a live, currently-shipping violation of the standing "never AI-labeled" rule,
independent of whether/when the fuller K-mark redesign proceeds — happy to patch
just that one line first if you'd rather not wait for the full identity component work.
