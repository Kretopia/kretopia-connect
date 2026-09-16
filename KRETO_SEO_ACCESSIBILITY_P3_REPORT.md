# SEO & Accessibility — P3 Fix Report

First batch of P3 platform-wide hardening from `KRETO_PLATFORM_ACCELERATION_AUDIT.md` §G (SEO), §J (performance), §K (UX/a11y). Scoped to fixes that were either mechanical/low-risk or reused an already-proven pattern elsewhere in the codebase — larger, more exploratory items are flagged separately, not attempted here.

## Status: `IMPLEMENTED`, `TYPECHECKED`, `BUILD_PASSED`. See per-item verification below — some confirmed live, some `NOT_CONFIRMED` for the same no-test-account reason as every prior phase.

## 1. `ViewProfile.tsx` — fixed a real bug the audit's SEO framing missed

The audit assumed `ViewProfile.tsx` (`/profile/:userId`) just needed the same `Person` JSON-LD/canonical/OG treatment as `CreatorEPK.tsx`. Checking the actual code first found something more fundamental: `fetchData()` returns immediately if there's no authenticated `user` (`if (!userId || !user) return;`), so **every anonymous visitor — including every search-engine crawler and link-preview bot — has always hit a bare "Profile not found" wall on this route, regardless of whose profile the link pointed at.** Adding SEO metadata to a page anonymous visitors structurally cannot see would have been actively misleading, not a fix.

Since `/epk/:userId` already exists as the correct, fully-public equivalent (confirmed live: full `Person` JSON-LD, canonical, OG image all present, verified via the dev server), the fix redirects anonymous visitors from `/profile/:userId` straight to `/epk/:userId` instead of duplicating SEO logic on a page that can't serve it. `RUNTIME_CONFIRMED` — verified live in the dev server: anonymous navigation to `/profile/<uuid>` now lands on `/epk/<uuid>` with the correct title and full `Person` schema present in `<head>`.

## 2. `CreatorSite.tsx` / `CreatorSiteByUsername.tsx` — added the missing SEO metadata

Both pages fetch and render without requiring auth (genuinely public), matching the audit's assumption. Added `type="profile"`, `image`, `url`, and `profile={...}` to their existing `<SEO>` calls — the exact same prop shape already proven live on `/epk/:userId`, no new SEO logic invented.

Also set the canonical URL on `/site/:userId` to point at `/:username` when the profile has claimed one, since both routes render the same content for the same profile — without this, the two URLs would silently split search-ranking signal for identical content.

`NOT_CONFIRMED` live: no test account with `site_enabled` + a paid tier was available in this environment to click through the actual rendered page (confirmed instead that `/site/:userId` correctly falls through to its "Site Not Found" state for a profile without an enabled site, so the code path is at least reachable and doesn't crash).

## 3. `robots.txt` / `sitemap.xml`

- `robots.txt`: added `Disallow: /auth` and `Disallow: /dashboard` (the latter is `ProtectedRoute`-gated and redirects to `/desk` — never meant to be indexed).
- `sitemap.xml`: removed `/auth` (an auth page, never indexable) and `/landing`, `/onboarding`, `/company-onboarding`, `/founding-member` — checked each against `App.tsx` directly rather than assuming: `/landing` is a dead client-side redirect stub to `/` (redundant, already listed separately), and the other three are all `ProtectedRoute`-gated, so a crawler following them would only ever reach a login wall. Replaced `/magazine`/`/podcast` (client-side `<Navigate>` redirects a non-JS crawler won't follow) with their real destinations, `/spotlight?tab=magazine` and `/spotlight?tab=podcast`.

**Not fixed, flagged separately:** the sitemap's 15 hardcoded `/epk/{uuid}` entries still go stale as new profiles are created — turning this into a properly dynamically-generated sitemap is a real, separate build-tooling task (a build-time generator script or an edge function), not a one-line fix, and deserves its own focused pass rather than a rushed version bolted onto this batch.

## 4. Accessibility — avatar `alt` text

`FramedAvatar` (the shared avatar component used across `ViewProfile.tsx`, `PassportHero.tsx`, and `CircleBrowseGrid.tsx`, ~4 call sites) rendered its underlying `<img>` with no `alt` at all — a real gap, since an unset `alt` can cause some screen readers to fall back to announcing the raw image URL rather than nothing. Added an `alt` prop (defaulting to a generic label derived from the existing `fallback` initial when the caller doesn't pass one) and wired a real name through at every call site.

One deliberate exception: `CircleBrowseGrid.tsx` already masks creator names for non-authenticated viewers via `maskCreatorName()` before rendering them as visible text — the new `alt` text uses that same masked value, not the raw name, so this fix doesn't accidentally leak an unmasked name to screen readers that the visible UI is deliberately hiding.

Left `UnifiedHome.tsx`'s CSS `background-image` avatar in the "People for you" carousel as-is: unlike `<img>`, a CSS background image is never read by screen readers at all (no raw-URL-announcement risk), and the person's name is already rendered as real, adjacent link text in the same card — so there was no actual gap to close there, just a cosmetic mismatch with a stricter reading of the audit's blanket "images lack alt text" note.

`NOT_CONFIRMED` live for `CircleBrowseGrid`/`PassportHero`: both sit behind auth-gated surfaces (`/circle` shows a "Sign up to unlock" wall for anonymous visitors, same as `/kreto` in the earlier Kreto work) — same no-test-account limitation as every prior phase.

## Explicitly out of scope, flagged as follow-ups (not attempted here)

- **Dynamic sitemap generation** (§3 above) — a real build-tooling task.
- **2.38MB main chunk / 1.65MB `Discover` chunk investigation** (audit §J) — needs a bundle analyzer and manual tracing to find the actual cause; too open-ended to bundle into this pass.
- **Broad `ImageLoader` rollout** (audit §J: used in only 2 of ~280 `<img>` tags app-wide) — a large, mechanical but high-file-count change better suited to its own dedicated pass than folded into this one.

## Verification

- `npx tsc --noEmit -p tsconfig.app.json` — clean.
- `npm run build` — clean.
- Live-verified in the dev server (anonymous session): `/profile/:userId` → `/epk/:userId` redirect fires correctly with full `Person` JSON-LD/canonical present; `/epk/:userId` and static JSON-LD (`Organization`/`SoftwareApplication`/`WebSite`/`FAQPage`) all confirmed present in `<head>`.
- Not independently re-verified: `CreatorSite.tsx`/`CreatorSiteByUsername.tsx` rendering with a real `site_enabled` + pro-tier account, and the avatar `alt` fixes on auth-gated pages — both `NOT_CONFIRMED` for the reason stated above.

## Deployment steps required

None beyond the normal PR merge — no migrations, no edge functions touched. Purely frontend + two static `public/` files.
