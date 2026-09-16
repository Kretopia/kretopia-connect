# Passport & Conversion Funnel — Phase 1 Read-Only Audit

No code was edited to produce this report. Baseline commands were run (results in §0). Everything below is sourced from the repository, migration history, and this session's own prior work on this codebase — not assumed.

## §0 — Baseline

```
git status:      clean except supabase/functions/mcp/index.ts (pre-existing, untouched, unrelated drift carried across this whole session)
npm run typecheck: PASS (0 errors)
npm run test:      PASS (127/127, 12 test files)
npm run build:      PASS
npm run lint (repo-wide): 12,687 errors / 1,222 warnings — overwhelmingly @typescript-eslint/no-explicit-any across the whole codebase, pre-existing, not introduced by this audit (no code was touched). This matches the same pre-existing pattern already observed and documented file-by-file throughout this session's earlier work.
```

## §1 — Current public Passport route map

| Route | Component | Access | Purpose |
|---|---|---|---|
| `/profile` | `Profile` | `ProtectedRoute` | Owner's private dashboard (App.tsx:338) |
| `/profile/:userId` | `ViewProfile` | Public route, auth-aware inside | In-app view for signed-in visitors; renders `<CreatorEPK/>` inline for signed-out visitors (App.tsx:342) |
| `/passport` | `PassportDirectory` | Public | A directory/listing page, not an individual Passport (App.tsx:349) |
| `/passport/:passportId` | `HandleResolver mode="passportId"` | Public | Resolves a short `THR-XXXXX` code to a user, then **redirects to `/epk/:userId`** (App.tsx:351) |
| `/epk/:userId` | `CreatorEPK` | Public | The actual canonical public Passport/EPK render (App.tsx:345) |
| `/:username` | `CreatorSiteByUsername` | Public | A *different* feature (Creator Site subdomain-style page), catch-all near the end of the route list (App.tsx:544) — not the Passport |
| `/share/profile/:id` | `ShareProfileRedirect` | Public | Share-link redirect (App.tsx:473) |
| `/claim/:claimToken` | `ClaimProfile` | Public | Claim-flow entry (App.tsx:522) |

**There is no literal `/@handle` route** — React Router v6 doesn't support a literal-prefix param segment like that (confirmed via the code's own comment at App.tsx:352). Handle-based public resolution goes through `HandleResolver mode="handle"`, but that mode isn't wired to any route in App.tsx today (only `mode="passportId"` is routed, at `/passport/:passportId`) — a related gap, not the reported bug, noted for completeness.

**Two independent public-facing profile renderers exist**: `ViewProfile.tsx` (mounted at `/profile/:userId`) and `CreatorEPK.tsx` (mounted at `/epk/:userId`, and also what `ViewProfile` itself renders inline for signed-out visitors, and what `HandleResolver` redirects a resolved handle to). They are not the same code path and do not share a query layer.

## §2 — Exact root cause of "Profile Not Found"

**Confirmed, not inferred** — traced to exact source and exact migration.

The owner's "Preview public Passport ↗" button (`src/pages/Profile.tsx:564`) opens:
```js
window.open(`/profile/${profile?.user_id}`, '_blank', 'noopener')
```
which routes to `ViewProfile.tsx`. For a signed-out visitor (or once the new tab's Supabase session hydrates and the visitor is *not* the owner), `ViewProfile` renders `<CreatorEPK />` inline (`ViewProfile.tsx:351-353`).

`CreatorEPK.tsx:159-164` queries:
```js
// Fetch from profiles table directly - RLS allows public read
const { data: profileData, error: profileError } = await supabase
  .from('profiles')
  .select('user_id, full_name, role, ...')
  .eq('user_id', userId)
  .maybeSingle();
```
That comment is **false as of migration `20260502224404_d273510f-ca92-46e7-8954-030ab40c3cae.sql`** (2026-05-02), which explicitly states its own intent:
```sql
-- 2) profiles: drop the blanket-true SELECT policy
DROP POLICY IF EXISTS "Authenticated users view safe profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can safe view profiles" ON public.profiles;

-- Defense-in-depth: revoke sensitive columns from non-owners at the GRANT layer.
-- Owner access is preserved via the existing "Owner full access" policy.
```
This was a **deliberate, correct security hardening** — it removed an overly-permissive "any authenticated user can read any profile row" policy. But `CreatorEPK.tsx` (and its stale comment) were never updated to match. The migration history (traced across 15+ migrations from `20251022` through `20260502`, see `git log`-style trace in the working notes) shows `profiles` SELECT access oscillated repeatedly between "public", "any authenticated user", and "owner only" over many months — the current, final state (post `20260502224404`) is **owner-only**, with a handful of narrow, context-specific exceptions (connected users, opportunity applicants/owners, endorsement contexts) that do not cover an arbitrary public/cross-user Passport view.

So: `CreatorEPK`'s direct `.from('profiles')` query returns **zero rows** (RLS silently filters, no error) for any visitor who is not the profile owner — anonymous or a different signed-in user alike. `!profileData` at line 166 → `setNotFound(true)` → the exact rendered text at `CreatorEPK.tsx:325`:
```jsx
<h1 className="text-2xl font-bold">Profile Not Found</h1>
```
This is a precise text match for the reported bug.

### Classification (per the audit's own list)

- ❌ wrong route — the route itself (`/epk/:userId`) is correct and reachable.
- ❌ wrong identifier — `user_id` is used consistently end-to-end.
- ❌ absent profile — the profile exists; it's filtered by RLS, not missing.
- ❌ unpublished profile — there is no "published" flag in play here at all.
- ✅ **RLS denial** — confirmed root cause, with the exact migration that caused it.
- ❌ wrong profile lookup — the lookup key is correct.
- ❌ handle normalization bug — not implicated in this specific path (the `HandleResolver` handle-normalization logic, `raw.replace(/^@/, "").toLowerCase()`, is independently correct and already queries the safe view — see §4).
- ❌ stale auth state — not implicated; the failure occurs even for a *correctly authenticated but non-owner* viewer.
- ✅ **frontend mapping bug (secondary)** — `CreatorEPK` queries a table it no longer has read access to, when a safe view already exists for exactly this purpose (see §4). Also, `ViewProfile.tsx:144-148` redirects an owner viewing their *own* `userId` straight back to `/profile`, meaning the owner can never actually see the *visitor's* view of their own Passport through this link even once the data issue is fixed — a related, compounding bug.
- ❌ missing public view — a correct, safe public view (`public_profiles_safe`) already exists; it's simply not the one `CreatorEPK` queries.
- ❌ other.

### A second, related bug found in the same investigation

The "Private dashboard →" button (`Profile.tsx:571`) calls `navigate('/dashboard')`. **Two separate `<Route path="/dashboard">` definitions exist in the same `<Routes>` tree**:
- `App.tsx:339` — `<ProtectedRoute><Dashboard /></ProtectedRoute>` (an old component)
- `App.tsx:538` — inside a "Legacy redirects — consolidated" block: `<Navigate to="/desk" replace />`

React Router v6 uses declaration order for path ties within one `<Routes>` tree; the first (line 339) wins, so `/dashboard` currently renders the **old** `Dashboard` component, not the intended `/desk` (Studio) redirect the "Legacy redirects" comment clearly intends. This is not the "Profile Not Found" bug, but it directly affects the same CTA pair this task is fixing (§5/§6), so it's flagged here rather than discovered mid-implementation.

## §3 — Public and private data contracts

**Private/owner read** (`Profile.tsx`, via various hooks): reads `profiles` directly as the authenticated owner — RLS's "Owner full access" policy covers this correctly. Full column set, including server-managed fields (Stripe IDs, verification internals, XP/level, storage quotas) that are correctly write-protected from the client as of `20260823223419` (a `REVOKE UPDATE (...) ON public.profiles FROM anon, authenticated` deny-list covering Stripe/subscription/verification/badge/XP/claim fields) but still client-readable for the owner's own row.

**Intended public read** — `public_profiles_safe` (view) / `get_public_profiles_safe()` (its backing function), defined in `supabase/migrations/20260803091710_8f59697e-2bc6-40fc-be79-87f720d68322.sql`:
```sql
GRANT EXECUTE ON FUNCTION public.get_public_profiles_safe() TO anon, authenticated, service_role;
CREATE OR REPLACE VIEW public.public_profiles_safe WITH (security_invoker = true) AS
  SELECT * FROM public.get_public_profiles_safe();
GRANT SELECT ON public.public_profiles_safe TO anon, authenticated, service_role;
```
Column allowlist: `user_id, full_name, username, avatar_url, role, bio, location, professional_skills, badge, xp, level, onboarding_completed, account_type, instagram_url, tiktok_url, youtube_url, twitter_url, linkedin_url, id_verified, verification_status, verification_tier, membership_number, cover_image_url, behance_url, imdb_url, soundcloud_url, spotify_url, created_at, updated_at`. No email, no phone, no Stripe/financial fields, no raw scoring internals. This is already correctly used by `HandleResolver.tsx` and by `Circle.tsx`'s Browse tab (`fetchBrowse`, `.from("public_profiles_safe")`).

**Gap**: `CreatorEPK.tsx`'s current column list includes several fields **not present** in `public_profiles_safe`: `website, calendly_url, average_rating, total_reviews, achievement_badges, professional_skills` (present), `passion_skills, collab_intent, rate_range, is_claimed, icdb_creator_id, job_title, sub_roles, model_stats, mother_agency, model_unions, model_categories`. Several of these (rate/collab_intent/booking-relevant fields, `is_claimed`, `job_title`, model-specific fields) are legitimately public per the Feature Bible's own description of Passport as a "discovery, collaboration and payments" surface — but they are not currently exposed by the safe view/function. Closing this gap fully (not just the "Profile Not Found" crash) likely needs a small migration extending `get_public_profiles_safe()`'s column list — flagged as `REQUIRES_MIGRATION`, not something to resolve by loosening RLS on the base table.

## §4 — Current HoloCard API and CTA placement

`src/components/passport/HoloCard.tsx` — pointer-tracked 3D tilt shell (already reduced-motion-aware via `prefers-reduced-motion` and `hover:hover) and (pointer:fine)` gating, already pauses its ambient glow when scrolled offscreen via `IntersectionObserver`, already GPU-composited via `transform`/`translateZ`). Props: `{ children, className, maxTilt = 8 }`. This session's own prior work (Subscription page, Circle/Sound Stages) confirms it's the shared, canonical holo-card primitive — reused as-is both times, never forked.

`PassportHero.tsx` already wraps its content in `<HoloCard>` (lines 103-351) and already uses a callback-prop pattern (`onEdit`, `onShare`, `onAvatarClick`, `onShowQR`, `onDownloadEPK`) — extending it with `onPreviewPublic`/`onOpenDashboard` callbacks is consistent with its existing API shape, not a new pattern.

**Current CTA placement is confirmed detached**: `Profile.tsx:511` renders `<PassportHero ... />` (self-contained, closes before any CTA markup), and the "Preview public Passport ↗" / "Private dashboard →" buttons are separate markup at `Profile.tsx:560-576`, **after** `PassportHero` closes, not inside it or the HoloCard. This directly confirms the reported "too detached... tiny detached links" complaint with an exact line reference.

## §5 — Current Private Dashboard structure and UX problems

`Profile.tsx` is 710 lines, single return path, **zero tabs** (`grep -n "Tabs\|TabsContent"` on the render tree returns nothing) — confirmed entirely vertically stacked: PassportHero → KretoActionCenter → TrustOpportunityCenter → CTA row → PassportCreditsCta → (more below, not fully inventoried in this pass given the audit's time budget, but the shape is established: one long scroll, no in-place tabs, no responsive grid of panels). This matches the reported "too much scroll... simplistic UI" complaint directly.

## §6 — Landing CTA inventory

`src/components/landing/` (top-level, ~30 files) is a mix of **live** and **dead** code:

- **Live**: `KretopiaHero.tsx`, and the entire `src/components/landing/kretopia/` chapter system (`ChapterProgressNav`, `ClosingCTASection`, `MeetKretoSection`, `TrustSection`, etc.) — these are what `KretopiaLanding.tsx` actually renders. `KretopiaLanding.tsx` is the sole component mounted for guests, from `UnifiedHome.tsx:493`.
- **Dead / not rendered anywhere reachable**: `BottomCTASection.tsx` (imported in `UnifiedHome.tsx:31` but never used in JSX there — confirmed via grep for `<BottomCTASection`, zero matches), `StickyMobileCTA.tsx` (not even imported — `UnifiedHome.tsx:41` has an explicit comment: `// StickyMobileCTA removed — dismissible popup handles guest CTA`), `OneWedgeLanding.tsx` (mentioned only in a comment, never imported or routed — confirmed dead), `PricingPreviewSection.tsx` and others in the same top-level directory not confirmed live in this pass.

**This directly contradicts one of the task's stated assumptions**: StickyMobileCTA is not merely "unattributed," it is **not mounted on the current Landing route at all** — it was deliberately removed in favor of an unnamed "dismissible popup" mechanism that this pass did not yet locate/verify (flagged for Phase 2 investigation, not assumed to exist).

**Confirmed live CTA**: `ClosingCTASection.tsx:44-45,104` — `<Link to="/auth?tab=signup&intent=closing_cta" onClick={trackSignupClick}>` where `trackSignupClick = () => analytics.ctaClick("claim_your_creative_passport", "closing_cta")`. This is a real, already-working CTA-click event (see §7) — the task's blanket claim that Landing "currently has no reliable CTA... instrumentation" is **not fully accurate**; coverage is real but almost certainly incomplete across the full chapter set (KretopiaHero's own primary CTA, other chapters) — Phase 2 needs to inventory every chapter's CTA individually, not assume zero coverage.

## §7 — Current analytics event inventory

**Three partially-overlapping mechanisms exist** — this is a real architectural finding, not a simplification:

1. **`src/lib/analytics.ts`** (`trackEvent` + `analytics.*` object, 579 lines) — writes to `analytics_events` (session-scoped via `sessionStorage`, silent-fail, non-blocking). Already has `analytics.ctaClick(ctaName, location)` (§6), `analytics.signUp(method)`, `analytics.signIn(method)`, `analytics.signOut()`, `analytics.pageView`, `analytics.errorOccurred`, `analytics.paywallViewed`, `analytics.checkoutAttempt`, and many domain-specific events (confirmed via this session's own earlier use of `analytics.paywallViewed`/`analytics.checkoutAttempt` in Subscription.tsx work).

2. **`src/lib/deckMetrics.ts`** (33 lines) — `trackDeckEvent(event_name, event_category, event_properties)`, also writes to `analytics_events`, same silent-fail contract, explicitly documented: `// Writes to public.analytics_events (allows anon+authed insert, admin-only read)`. This is the **cleanest, most directly reusable pattern** for a new `landingMetrics.ts` — same table, same safety contract, minimal surface.

3. **`src/hooks/useLandingVariant.ts`** — writes to a **third, separate table**, `site_analytics` (different schema: `visitor_id, page_path, event_type, event_target, referrer, device_type` — no `event_properties` jsonb, no `session_id`/`user_id` in the same shape as `analytics_events`). Exposes `trackLandingCta(variant, target)`. **Confirmed via grep: its only call site is `OneWedgeLanding.tsx`, which is dead code (§6)** — so `site_analytics`/`trackLandingCta` is effectively orphaned on the current live landing page, not a second active system to reconcile with, but flagged so Phase 2 doesn't accidentally build on top of a dead table.

**Auth funnel events already exist**, contradicting another of the task's framing assumptions: `Auth.tsx:225` and `Auth.tsx:338` already fire `trackEvent({ eventName: 'signin_attempt', ... })` and `trackEvent({ eventName: 'signup_attempt', ... })` respectively — with the exact event names the task's Section 7 asks to create. Success is tracked via `analytics.signIn('email'|provider)` / `analytics.signUp('email')` (event names `sign_in`/`sign_up`, not `signup_success`/`signin_success` — a naming mismatch against the task's desired schema, not a missing capability). Errors go through `errAnalytics.errorOccurred('signin_failed'|'signup_failed', errorType, 'auth')` — need to verify in Phase 2 whether `errorType` is already a safe category or a raw provider message (this determines whether `errorOccurred`'s existing call sites need a categorization pass, or just renaming to match the task's requested event names).

`Auth.tsx:525` also already fires `auth_tab_switch` — relevant for verifying "does a new visitor see signup by default" (see §9).

## §8 — Current Auth funnel behavior

`Auth.tsx:30`: `const [activeTab, setActiveTab] = useState<string>("signin")` — **the default is "signin"**, confirmed by direct code read, not inference. The effect at `Auth.tsx:75-80` only switches to `"signup"` when the URL explicitly carries `?tab=signup`, `?claim=`, `?invite=`, or `?inviteCode=` — a visitor arriving with none of those (e.g. from a generic hero CTA that doesn't append `?tab=signup`) lands on **Sign in** by default. This is a direct, confirmed match for the task's own stated hypothesis ("Auth page is likely sign-in dominant for new users") — now evidenced, not assumed. `ClosingCTASection.tsx`'s own link already correctly appends `?tab=signup&intent=closing_cta` — so at least one CTA is already doing the right thing; the question for Phase 2 is whether *every* Landing CTA does, or whether some route to `/auth` bare.

## §9 — Existing `useLandingVariant` behavior

Not an active A/B system today. `useLandingVariant.ts`'s own comment: *"The OneWedge landing is now the canonical public landing... we explicitly retire that assignment and default to wedge."* The hook always returns `"wedge"` except for a manual `?lv=control` QA override; a previous 50/50 experiment was run and concluded, and this hook is now a **settled single-variant selector**, not a live experiment. This matters directly for the task's Section 10 (hero-copy experiment): the mechanism exists and is reusable, but it needs to be *reactivated* for a new controlled experiment, not extended from an already-running one — and the task's own explicit ordering (experiment only after instrumentation + funnel + auth events are live and collecting data) already accounts for this correctly.

## §10 — Existing admin analytics architecture

Confirmed end-to-end, reusable pattern via `CreativeActionFunnels.tsx` (`src/components/admin/CreativeActionFunnels.tsx`, 141 lines), mounted in `Admin.tsx:466` inside `ProductDashboardTab`:

- **Frontend**: `supabase.rpc("get_creative_action_funnels", { _start, _end })` → returns `{ scout?: Step[], connection?: Step[], workspace?: Step[], invoice?: Step[] }` where `Step = { label, count }` → rendered via a `FunnelStrip` component computing stage-to-stage conversion % and drop-off %, with a day-range selector (7/30/90), loading skeletons, and a "No data" empty state per funnel.
- **Backend**: `supabase/migrations/20260606224851_9295558d-3066-4f30-8f21-3d9bdc36960d.sql` — the RPC is `SECURITY DEFINER` and **self-enforces admin authorization inside the function body**: `IF NOT has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'admin only'; END IF;`, then `GRANT EXECUTE ... TO authenticated` (not `anon`) — a non-admin authenticated caller gets a hard exception, not silently empty data.
- **Defense in depth**: `Admin.tsx` itself independently checks `.eq("role", "admin")` (line 203) before rendering any admin tab content at all.

This is the exact pattern to replicate for `get_landing_funnel` (§8 of the task spec) — same RPC-level admin self-check, same frontend day-range/skeleton/empty-state shape, same mount point convention (a new tab or panel inside `Admin.tsx`/`ProductDashboardTab`, not a new parallel admin surface).

## §11 — Files to change (Phase 2, pending approval)

- `src/pages/CreatorEPK.tsx` — swap `.from('profiles')` → `.from('public_profiles_safe')` (P0 fix)
- `src/pages/ViewProfile.tsx` — fix the owner-self-redirect so "preview as visitor" actually shows the visitor view
- `src/App.tsx` — remove the shadowed duplicate `/dashboard` route (line 339 vs 538)
- `src/pages/Profile.tsx` — move CTA row into `PassportHero`/HoloCard; redesign dashboard layout
- `src/components/passport/PassportHero.tsx` — accept and render the two CTAs, context-aware
- `src/lib/landingMetrics.ts` (new) — section-view/scroll-depth/CTA helper, modeled on `deckMetrics.ts`
- `src/pages/Auth.tsx` — align event names to the task's schema; verify/adjust default-tab logic per §8
- `src/components/admin/CreativeActionFunnels.tsx` or a sibling component (new) — Landing funnel panel
- Landing chapter components (`src/components/landing/kretopia/*`, `KretopiaHero.tsx`) — instrument CTAs/sections not yet covered

## §12 — Files to protect (do not touch without cause)

- Any RLS/GRANT statement on `profiles` beyond what §2/§3 require — no loosening.
- `deckMetrics.ts`, `analytics.ts`'s existing method signatures already in use elsewhere in the app (Subscription, Circle work this session) — additive only.
- `get_creative_action_funnels` RPC and its Scout/Connection/Studio/Invoice funnels — unrelated to this task.
- `HoloCard.tsx`'s core tilt/glow mechanics — already reduced-motion/offscreen-safe; extend via props, don't rewrite.

## §13 — Required migration(s)

1. **Not required for the P0 fix itself** — `public_profiles_safe` already exists and is grant-correct; the fix is a frontend query change.
2. **Optional, `REQUIRES_MIGRATION`**: extend `get_public_profiles_safe()`'s column list to close the gap in §3, if the full EPK feature set (ratings, achievement badges, rate/collab-intent, is_claimed, model-specific fields) should remain visible publicly. Needs a security review of which of those fields are genuinely safe to expose (most are, per the Feature Bible's own description of Passport as a booking/discovery surface — but this is a product decision, not mine to make unilaterally).
3. **`REQUIRES_MIGRATION`**: `get_landing_funnel` RPC (§8 of the task), modeled directly on `get_creative_action_funnels`'s admin-self-check pattern.
4. **`REQUIRES_PRODUCT_DECISION`**: whether to fix the duplicate `/dashboard` route by removing the shadowed old `Dashboard` component entirely (§2's second bug) — this is a routing/product-architecture call, not purely mechanical.

## §14 — Security/privacy risks identified

- The core risk (public Passport reads bypassing the safe view) is a **read failure**, not a leak — confirmed no private field is currently exposed; the bug is over-restrictive, not under-restrictive. Fixing it via `public_profiles_safe` keeps that property.
- `CreatorEPK.tsx`'s current column list, if simply pointed at `public_profiles_safe` without adjustment, would silently drop fields the view doesn't have (no crash, just `undefined` — needs graceful handling either way, not a security issue but a completeness one).
- The admin funnel RPC pattern (§10) is the correct model — no anonymous read of raw `analytics_events`, no visitor-level PII in aggregates.

## §15 — Test plan (Phase 2)

Per the task's own exhaustive §14 test list — not restated here in full; confirmed feasible given the current test setup (Vitest, 12 existing test files, 127 passing). New test files will follow the existing project convention (co-located `__tests__/` directories, confirmed via `src/components/project/studio/__tests__/`).

## §16 — Browser verification plan

Per the task's §15 matrix. This audit did not run any browser verification (read-only phase, no server assumed running yet) — Phase 2 will start the dev server and verify against the viewport matrix once implementation begins.

## §17 — Three things needing your decision before Phase 2 starts

1. **`CreatorEPK`'s field gap** (§3, §13.2): minimal fix (swap to `public_profiles_safe`, accept that rate/rating/badges/model fields disappear from the public EPK until a follow-up migration) vs. fuller fix (extend the safe view now, in this same pass, after I identify exactly which fields are safe to add). I'd lean minimal-first (unblocks the P0 bug immediately, zero migration risk) with the extension as an explicit fast-follow — but this is your call given it changes what's publicly visible.
2. **The duplicate `/dashboard` route** (§2, §13.4): remove the shadowed old `Dashboard` component so `/dashboard` correctly redirects to `/desk` per the "Legacy redirects — consolidated" comment's own intent? This is unrelated to Passport specifically but sits directly behind the "Private dashboard →" CTA I'm about to rewire.
3. **The "dismissible popup" mobile CTA mechanism** (§6): I haven't yet located what replaced `StickyMobileCTA`. Before I claim "StickyMobileCTA is verified on the current Landing route" (impossible, since it isn't mounted) I want to confirm with you whether the intent is (a) revive `StickyMobileCTA` on `KretopiaLanding`, or (b) instrument whatever the popup mechanism actually is instead — these are different implementation paths.

No code was edited to produce this report. Stopping here per instruction, waiting for approval before Phase 2 implementation.
