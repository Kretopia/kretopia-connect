# Landing Conversion Report

Covers the Landing portion of the Kreto/Stage/Recordings/Landing sprint — the
largest of the four areas. Built directly on the Phase 1 audit's findings
(`KRETO_STAGE_RECORDINGS_CONVERSION_AUDIT.md` §D/§E).

## Addendum — reconciled with independent parallel work

After this report was originally written, a `git push` surfaced ~30 commits
already on `origin/feature/reliability-overhaul` that this session didn't
create — an independently-built implementation of the *same* feature
(`src/lib/landingFunnel.ts`, `LandingFunnelTracker.tsx`, `InlineSignupBar.tsx`,
a differently-shaped `get_landing_funnel` migration, a rewritten
`LandingFunnelPanel.tsx`), authored via Lovable's own editor and following the
identical instrument → funnel view → fix-the-two-leaks plan
(`.lovable/plan/conversion-diagnosis-last-7-days-2026-08-31.md`, dated Aug 31 —
predating this session's version). Real production data drove it: 282 weekly
landing visitors, 82% never reaching `/auth`, 1 new account in 7 days.

Merging surfaced two real bugs (both files edited by both sides: an import
line survived from one side, the function call using it from the other) —
`KretopiaHero.tsx` and `KretopiaLanding.tsx` both referenced now-unimported
functions. Fixed by removing the dangling calls rather than re-importing,
since their generic `LandingFunnelTracker` (observes every real `section[id]`
in the DOM) already covers what those calls were duplicating.

**Their system is now the sole section-view/scroll-depth tracker.** This
session's `landingMetrics.ts` `useLandingSectionView`/`useLandingScrollDepth`
and their corresponding calls were removed from all 9 section components that
had them (running both would have double-counted every section). Six sections
that only had a tracking `ref` and no real DOM `id` (`SearchTutorialSection`,
`TrustSection`, `ProductLoopSection`, `ForOrganisationsSection`,
`ClosingCTASection`, `CreativeUniverseSection`) gained one, so their generic
observer picks them up too — checked `chapterRegistry.ts` first to confirm
none of these six are part of the chapter-numbering system, so adding ids
couldn't collide with `ChapterProgressNav`. Two sections
(`VerifiedCreditsChapterSection` id `chapter-verified-credits`, the Community
`ChapterSection` id `chapter-community`) don't match their `LANDING_SECTION_ORDER`
list's expected names (`chapter-credits`/`chapter-soundstages`) — left
unrenamed since `chapterRegistry.ts` uses these exact ids for chapter
numbering and `ChapterProgressNav`; the mismatch only affects display
ordering in their admin panel, not data collection.

**This session's `LandingFunnelPanel.tsx` and its RPC migration
(`20260902200000_landing_funnel_admin_rpc.sql`) are superseded and were
deleted** — the merge already replaced the panel with theirs, and the
migration, if ever applied, would have silently overwritten their
already-live, differently-shaped `get_landing_funnel` function (`CREATE OR
REPLACE`, same name) and broken it. `trackLandingCtaClick` and the entire
auth-funnel section of `landingMetrics.ts` were kept — confirmed
non-duplicative: their RPC's CTA/auth queries use `coalesce()` across both
naming conventions (`cta_id`/`cta_name`, `section`/`location`,
`signup_attempt`/`sign_up`), so both sides' events count correctly without
double-counting.

**The Auth default-tab question this report originally left open is
resolved** — their side implemented it independently
(`localStorage.getItem("thrivein_last_signin_method")` as the returning-visitor
signal), and also fixed the `?next=` vs `?redirect=` redirect-param
inconsistency this session's audit had flagged. Both match what this report
proposed almost exactly.

Verified after reconciling: `npm run typecheck` (0 errors — the pre-existing
SEPA types-drift flagged all session is also gone, apparently fixed by their
regenerated `types.ts`), `npm run test` (127/127), and live in-browser — all
15 real sections carry a DOM id, `LandingFunnelTracker` mounts cleanly, no
console/render errors, every landing CTA's `/auth` link carries the right
`?src=`/`?tab=`/`?intent=` params from both systems side by side.

## Instrumentation (spec §6)

**`src/lib/landingMetrics.ts`** (new) — a thin vocabulary layer over the
existing `trackEvent()`/`analytics_events` pipeline from `analytics.ts`.
Same writer, same table, same session-id and fail-safe behavior — not a
second analytics system, deliberately not repeating the pattern the audit
flagged (`useLandingVariant`'s separate `site_analytics` table).

One deliberate deviation from the spec text: its JSON examples show
illustrative section categories (`hero | proof | product | pricing | faq |
bottom_cta`), but the spec's own very next line says "use actual rendered
section IDs, not invented names" — and this page has no real proof/pricing/
FAQ sections. So `LandingSectionId` is typed to the 14 sections that
actually exist in `LandingBelowFold.tsx` (`hero`, `search_tutorial`,
`chapter-passport`, `verified_credits`, `trust`, `product_loop`,
`chapter-scout`, `chapter-match`, `chapter-studio`, `meet_kreto`,
`creative_universe`, `chapter-community`, `for_organisations`,
`closing_cta`), plus `sticky_mobile`/`direct`/`unknown` where genuinely
needed. Real data over a fictional fit to the illustrative schema.

**`landing_section_viewed`** — `useLandingSectionView(section)` hook,
`IntersectionObserver`-based, fires once per section per page load. Wired
into all 14 real sections: `ChapterSection.tsx` (one shared-component edit
covers Passport/Scout/Match/Studio/Community), plus the 9 standalone section
components individually. Hero fires on mount instead (it's above the fold —
mount ≈ view, no observer needed).

**`cta_click`** — `trackLandingCtaClick()`, richer shape than the
pre-existing `analytics.ctaClick()` (`cta_id`, `section`, `label`, `variant`,
`destination_type`). Wired into every CTA on the page, including the one
confirmed gap from the audit (`MeetKretoSection` had zero tracking on its
"Meet Kreto" link). Every CTA that routes to `/auth` now also carries a
`?src=<section>` param, so `Auth.tsx` can attribute the funnel to exactly
which section it came from — read via `resolveAuthEntrySource()`, not
guessed from `?next=`/referrer after the fact.

**`landing_scroll_depth`** — one `useLandingScrollDepth()` hook mounted once
at `KretopiaLanding.tsx`, rAF-throttled, fires each of 25/50/75/100 exactly
once per page load.

**Auth funnel** — `signup_attempt/success/error`, `signin_attempt/success/error`,
wired into `Auth.tsx`'s existing `handleSignIn`/`handleSignUp`/`handleOAuthSignIn`
handlers, additive alongside the pre-existing tracking there (which uses
different event names — `sign_in`/`sign_up`/`error_occurred` — likely
consumed elsewhere, so left untouched rather than replaced). `error_category`
is always a fixed enum (`categorizeAuthError()`, pattern-matched from the
error message) — never the raw Supabase error string, and never an email,
password or token. The Supabase "fake user" case (email already registered,
surfaced with no explicit `error`) is correctly tracked as
`signup_error(..., "account_exists")`, not a false `signup_success`.

## StickyMobileCTA (spec §7)

Confirmed mounted, per the spec's explicit requirement — see the dedicated
commit (`3e124524`) for the two real bugs found and fixed in the component
itself before mounting it (a `bottom-[72px]` offset reserving space for a
bottom nav bar guests never see, and no safe-area padding).

## Hero and auth-default — deliberately not changed

**Hero already has one dominant promise and no competing CTAs** — its own
code comments document that a prior version had two competing buttons under
the search bar and they were deliberately removed. The search-first design
already satisfies the spec's underlying goal (one clear primary action)
through a different, already-considered mechanism than a literal "Sign Up"
button. Re-introducing a separate CTA here would undo that prior, reasoned
decision — left alone, only instrumented.

**Auth's tab default is unchanged** (still `signin` for a bare, param-less
`/auth` visit). The spec asks new visitors to default to Signup, but also
explicitly warns "do not force signup for users who intentionally arrived at
a sign-in path" and to "preserve the existing returning-user path." Every
real Landing CTA already correctly forces `?tab=signup` — the only case left
un-migrated is a direct/bookmarked `/auth` visit with no params at all, and
there's no reliable, honest signal in this codebase today to distinguish a
genuinely new visitor from a returning one who bookmarked the bare URL.
Guessing wrong risks exactly what the spec cautions against. Flagging this
as a real open decision rather than picking a heuristic and shipping it
silently — happy to implement a specific rule (e.g., check for a stale/absent
Supabase session hint in localStorage) if you want to define one.

## Landing Funnel Admin View (spec §8)

**`supabase/migrations/20260902200000_landing_funnel_admin_rpc.sql`**
(prepared, **not applied** — per this session's standing rule, no migration
is pushed without your explicit go-ahead). Mirrors `get_creative_action_funnels`'s
exact pattern: `SECURITY DEFINER`, `has_role(auth.uid(), 'admin')` gate,
`STABLE`, `GRANT EXECUTE` to `authenticated` only (relying on the internal
admin check, not a narrower grant, matching the existing convention). Counts
`DISTINCT session_id` per stage from `analytics_events` (guests have no
`user_id`, so session is the right unit) across a real 6-stage funnel built
from the events actually shipped above: Landing visited → Reached first
chapter → CTA clicked → Auth page reached → Signup attempted → Signup
completed. Also returns per-section, per-CTA, and entry-source breakdowns.

**`src/components/admin/LandingFunnelPanel.tsx`** (new) — mounted in
`ProductDashboardTab.tsx` right after `CreativeActionFunnels`, reusing its
exact visual funnel-strip pattern. Includes a real loading/error+retry/empty
state set (the existing `CreativeActionFunnels` has no error state at all;
this one does, since the spec explicitly asked for it here). Shows the
low-traffic warning line verbatim from the spec ("Small samples can make
week-to-week conversion changes volatile") whenever the window's total
session count is under 50.

**Until the migration is applied, this panel will correctly show its
error+retry state** — `get_landing_funnel` doesn't exist in the database
yet. That's the honest, expected state right now, not a bug.

## Verification

- `npm run typecheck` / `npm run test` (127/127) clean throughout — no new
  errors beyond the pre-existing, already-flagged SEPA types-drift.
- Every section-view and CTA-click wire-up was checked against its actual
  component structure before editing (root element, existing analytics
  calls, destination), not assumed.
- `StickyMobileCTA` verified live via `getBoundingClientRect`/computed-style
  inspection at both a real mobile viewport (375×812) and a genuine desktop
  width (1280px, not the browser pane's own narrower "desktop" default,
  which would have given a false pass on the `lg:hidden` check).
- **Not verified live**: the admin funnel panel itself and the full
  signup/signin funnel end-to-end, since this session's browser lost its
  authenticated session partway through this work (no stored token) and I
  won't log in without credentials. Typecheck is clean and the panel follows
  the exact proven pattern of the already-working `CreativeActionFunnels`
  sitting right next to it, but a visual/authenticated check is worth doing
  once you're back in.

---

This closes all four areas of the sprint: Kreto identity, Stage, Recordings,
Landing conversion. Two things need your action beyond this session: applying
`20260902200000_landing_funnel_admin_rpc.sql` (prepared, not applied), and
deciding whether/how to handle the Auth default-tab question above.
