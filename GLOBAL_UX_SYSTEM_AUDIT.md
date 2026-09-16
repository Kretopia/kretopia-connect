# Global UX System Audit

Branch: `feature/activation-priority-plan` · Date: 2026-08-15

## Baseline health

| Check | Result |
|---|---|
| `npm run typecheck` | Clean |
| `npm run build` | Succeeds (317 precache entries, main bundle 1.9MB — pre-existing, flagged in Phase 11) |
| `npm run test` | 62/62 passing |
| `npm run lint` (full repo) | ~10,353 pre-existing issues, almost entirely `@typescript-eslint/no-explicit-any` in `supabase/functions/*` (Deno edge functions). Not introduced by this work; scoped per-file lints on every touched file have been clean all session. |

## Title / header system

**Already unified via `FeaturePageHeader`** (`src/components/features/FeaturePageHeader.tsx`) + `FeatureAITutorial`: Today, Passport, KrePay, Spotlight, Verified Credits, Founding Circle, Creative Circle, Studio, Stages, Clients, Kreto, Match, Perks, Events, Recordings, Subscription.

**Not yet on the shared system:**
- **Scout** (`src/pages/Scout.tsx`) — still uses the older `FeatureHeader` primitive, teal accent, no tutorial. → Phase 6.
- **Admin** (`src/pages/Admin.tsx`) — plain `<Shield/><h1>` block, no eyebrow/subtitle system. → Phase 4.
- **About** (`src/pages/About.tsx`) — has its own cinematic hero but uses `hsl(var(--signal-teal))` as the accent instead of the white/#FF2DA1 system used everywhere else. → Phase 2.
- **Auth/Login** (`src/components/auth/AuthBrandingPanel.tsx`) — intentionally its own split-screen guest layout (not a feature page), but the "Where Creativity Lives" headline had a real bug (below). Documented exception to the shared-header rule; kept as-is otherwise.

## Login "Where Creativity Lives" bug (Phase 3 — fixed this pass)

Found in `AuthBrandingPanel.tsx`: the "Creativity" span used `background-clip: text` + `-webkit-text-fill-color: transparent` on a **solid** (non-gradient) color, purely to render one flat color. This is a fragile technique for a non-gradient case — under `forced-colors` mode, some WebKit versions, or certain accessibility settings, `background-clip: text` can fail silently and leave the text invisible, which matches the "blurred/invisible Creativity" symptom. Replaced with a plain `color: #FF2DA1` style — visually identical, zero fragility. Fixed and verified in this pass.

## Admin panel

`src/pages/Admin.tsx` (735 lines) — real, functioning 12-tab panel (Users, Feedback, Unclaimed, Outreach, Verify, Drip, Founder, Transfers, Ambassadors, Product, Hosting/analytics, Scout Funnel) plus a System tab (ODOS import, AI Discovery, broadcast email) inlined directly in the page. Client-side gate (`checkAdminAccess` queries `user_roles`, redirects non-admins) backed by server-side RLS — **not touched**, only visually wrapped.

Full ground-up rebuild into a metrics dashboard is out of proportion to the risk/reward here — the tabs already contain the real, working admin surface. Phase 4 scope: unify the header via the shared system, group the 12 flat tabs into a logical hierarchy (Users & Trust / Growth / Finance / Product & Analytics / System), and add a genuinely real (not fabricated) lightweight overview strip using additive, read-only, RLS-scoped count queries — no new write paths, no authorization changes.

## Studio loose projects

`src/components/project/studio/StudioCardsGrid.tsx`, consumed from `src/pages/WorkHome.tsx`'s `CreatorWorkHome`. "Loose projects" (projects with no folder) currently render as a plain grid at the bottom of the folder view — real target for Phase 5's carousel consolidation.

## Scout

`src/pages/Scout.tsx` (128 lines) — 3-tab surface (For You / Shortlist / Open Gigs) backed by real components (`ScoutedGigsSection`, `ShortlistedGigs`, `OpportunitiesFeed`). No tutorial system wired in yet. Target for Phase 6.

## Passport

`src/pages/Profile.tsx` + `src/components/passport/PassportHero.tsx` + `HoloCard.tsx` — already substantially reworked this session (`FeaturePageHeader`, visible Passport ID, HoloCard ambient-breathe + scan-line, verified-pro orbit ring, `KretoActionCenter` next-action, `TrustOpportunityCenter`). Phase 7 will do a targeted gap-check rather than a rebuild.

## Share Passport

`src/components/passport/PassportShareSheet.tsx` — a **bottom Sheet** (drawer), not a centered modal. Share targets come from `targetsFor(layout.shareTargets)` (profession-aware: comp card / EPK / reel / etc.) with Share / Copy link / WhatsApp / Email only — **no LinkedIn, X, Instagram, or QR code**, and not centered. Real gap for Phase 8.

## EPK / public Passport

Two distinct surfaces exist:
- `src/pages/ViewProfile.tsx` — the **authenticated** "view another user" page (messaging, connect, start-project actions). Legitimately different from an EPK; out of Phase 9's scope.
- `src/pages/CreatorEPK.tsx` — the real **public, unauthenticated** EPK (rendered by `ViewProfile` itself when `!user`). ~985 lines: plain avatar/name/badge header, then a long but *not duplicated* stack of real business features — rate cards with inquiry capture, verified credits (horizontal rail + full list), industry stats, achievements, press, reviews, digital products with purchase CTA, claim flow, EPK PDF export, share toolbar.

A full rewrite to "only a 3D card" would put real inquiry/sales/claim functionality at risk for a page this size. Phase 9 scope: replace the current plain header block with the actual `HoloCard`-wrapped 3D-card treatment (matching `PassportHero`'s visual language, read-only) as the **dominant opening surface**, keep every existing section below it untouched — each is distinct data, not a duplicate card wall.

## Tutorial system

`TutorialStepper` + `FeatureTutorialPanel` already have auto-advance (4.5s, loops, pauses permanently on manual interaction, respects `prefers-reduced-motion`) shipped and live-verified this session across Passport/Scout*/Studio/SoundStages/Messages (*Scout's landing chapter, not the app page) chapters, plus merged directly into the Kreto and Verified Credits cards. Phase 10 is a preserve-and-verify pass, not new build.

## Carousel primitives

`@/components/ui/carousel` (embla-based) + `CarouselPositionDots` — established pattern already used by `CastingCallsRail`, Recent Collaborators (WorkHome). This is the primitive Phase 5's `LooseProjectsCarousel` will reuse.

## Data / actions that must be preserved

- Admin: all 12 tabs' data and the `user_roles`-backed admin gate.
- Studio: `projects` table, `studio_folder_id`, folder drag-and-drop, invoice status — only the *loose* (unfoldered) projects' presentation changes.
- Scout: `ScoutedGigsSection`/`ShortlistedGigs`/`OpportunitiesFeed` data flows, save/apply/dismiss actions.
- Passport: credits, co-signs, reviews, privacy/visibility flags, availability, hiring CTA.
- EPK: rate-card inquiries, digital-product purchases, claim flow, PDF export, all real Supabase-backed data.
- Auth: sign in/up, Creator/Brand toggle, magic link, recovery, redirects — untouched, only a CSS/style fix.

## Plan for remaining phases

1 (title system) — mostly satisfied; Scout gets `FeaturePageHeader` in Phase 6.
2 (About) — restyle to white/#FF2DA1, add tutorial-driven product loop.
3 (Login) — done, this pass.
4 (Admin) — header unification + tab grouping + real overview strip.
5 (Studio loose projects) — `LooseProjectsCarousel`.
6 (Scout) — `FeaturePageHeader` + tutorial.
7 (Passport) — gap-check only.
8 (Share modal) — centered Dialog, add LinkedIn/X/QR.
9 (EPK) — HoloCard hero, preserve everything below.
10 (tutorial preserve) — verify only.
11 (performance) — targeted audit.
12 (accessibility) — targeted audit.
13 (final QA) — the four required docs, real verification.
