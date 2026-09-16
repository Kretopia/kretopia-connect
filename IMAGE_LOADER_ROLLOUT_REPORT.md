# ImageLoader Rollout — Report

Follow-up to the audit finding that `ImageLoader` (`src/components/ui/image-loader.tsx`) is used in only 2 files against ~280 raw `<img>` tags app-wide.

## Status: `IMPLEMENTED`, `TYPECHECKED`, `BUILD_PASSED`. Three surfaces `RUNTIME_CONFIRMED` live (including, in a follow-up round, admin access); the rest rely on the same verified pattern (no test account/data for the others).

## Follow-up round — the deferred admin avatar/logo cluster

Closed out the "deferred, lower priority" item from the first round: `src/components/admin/UsersTab.tsx`, `VerificationTab.tsx`, `CheckInsTab.tsx`, and `PartnerSubmissionsTab.tsx` (2 instances — pending and reviewed partner-logo cards) all had layout protection but no `onError`. Same fix shape as the rest of this rollout: per-item `Set`-based failure tracking (table/grid rows), routing to each component's existing initials/icon fallback where one existed, and a small new icon-in-a-box fallback for `PartnerSubmissionsTab.tsx`'s partner logos (no fallback existed there before — company logos, not personal avatars, so an `ImageOff` icon fits better than initials).

`RUNTIME_CONFIRMED` this round: got real admin access in the dev server session and directly verified both `UsersTab.tsx` (User Management table, real avatars loading correctly) and `VerificationTab.tsx` (Approved tab, a real verification request with a real photo rendering correctly) — no console errors, no regressions. `CheckInsTab.tsx` and `PartnerSubmissionsTab.tsx` weren't individually reachable in this admin session (no check-ins or partner submissions currently in those specific views) but use the identical, now-twice-confirmed pattern.

## What was actually needed — evidence before action

Before touching anything, surveyed ~40 representative `<img>` instances across every feature area (profile, feed, messages, gigs, studio, admin) rather than assuming the audit's blanket "280 unprotected tags" claim was uniform. It wasn't: the dominant existing pattern is already a hand-rolled `aspect-*`/fixed-height wrapper, the same CLS-safe approach already confirmed correct for `EventHeroCard`/`GigCard`/`Avatar` in an earlier pass. **The real, common gap turned out to be missing `onError` fallback handling, not missing CLS protection or lazy-loading** — and converting the already-correct components to the `ImageLoader` component itself would have been actively harmful in several cases (its forced `loading="lazy"` would break print/export card generators and full-screen lightbox viewers that need the image eagerly loaded).

Given that, this rollout does **not** mechanically wrap 280 tags in `<ImageLoader>`. It fixes the specific, evidenced gaps directly — mostly by adding `onError` (and where genuinely missing, `loading="lazy"` and a real space reservation), reusing each component's existing fallback-UI pattern where one already existed.

## Fixed — genuinely unprotected (no lazy, no layout reservation, no error handling)

- **`src/pages/messages/MessageBubble.tsx`** (2 instances: native image attachments, legacy markdown-embedded images) — DM chat photos with zero space reservation (`max-w`/`max-h` are caps, not reservations) rendered in a scrolling message history with no `loading="lazy"` and no error handling. Added `loading="lazy"`, a `min-h-[80px]` floor so a photo doesn't pop in from zero height, and a proper "Image unavailable" fallback chip on error.
- **`src/components/feed/FeedPost.tsx`** — the direct-image-file link-preview branch (distinct from two sibling media branches in the same file that were already correctly protected — a `renderMedia()` branch with a fixed `h-48`, and a video branch — this was the one inconsistent case). Same fix shape as above.
- **`src/components/messages/MessageAttachments.tsx`** (`AttachmentPreview`) — the compose-time preview of an attachment about to be sent, pointing at a real Supabase Storage URL that can 404. Lower priority (visible for seconds during compose, not persisted browsing content) but fixed for consistency — added `onError` with a small "Failed to load" fallback.

## Fixed — "missing only `onError`" group (already had lazy-loading + layout protection)

`src/components/opportunity/GigRailCard.tsx`, `src/components/opportunity/ShortlistedGigs.tsx`, `src/components/marketplace/ListingCard.tsx`, `src/components/swipe/LikesYouGrid.tsx`, `src/pages/Explore.tsx` (2 instances), `src/pages/Marketplace.tsx`, `src/components/discover/TrendingLane.tsx`.

Each already had `loading="lazy"` and an `aspect-*`/fixed-size wrapper — genuinely just missing a failure path. Where a "no image" fallback branch already existed (most of these), routed the error state to reuse it exactly (no new UI invented). Where none existed (`Marketplace.tsx`'s featured-product carousel), added a minimal icon placeholder consistent with the rest of that page. List/grid components (rendered via `.map()`) track failures per-item via a `Set<id>` rather than a single boolean, so one broken image in a list doesn't affect its siblings.

## Found along the way, not part of this fix: two orphaned pages

While verifying reachability, found that **`src/pages/Marketplace.tsx` and `src/pages/Explore.tsx` are unreachable dead code** — `/marketplace`, `/market`, and `/explore` are all client-side `<Navigate>` redirects to other routes (`/opportunities`, `/nearby`), and neither page component is rendered by any other route. `ListingCard.tsx` (also fixed above) is used exclusively by `Marketplace.tsx`, so it's dead by extension. The fixes to these three files are still correct and harmless — if either page is ever re-wired to a real route, the protection is already in place — but they currently provide no live user-facing value. Not deleted here (removing orphaned routes/pages is a product decision, not an image-loading fix); flagging for a separate cleanup decision.

## Deliberately not touched — already fine

Per the evidence, converting any of these to `ImageLoader` or otherwise changing them would be pure churn or actively regressive: `EventHeroCard.tsx`, `GigCard.tsx`, `avatar.tsx` (all confirmed in an earlier pass), plus newly confirmed `ScoutedGigsSection.tsx`, `FileThumbnail.tsx`, `MoodboardThumb.tsx`, the full-screen lightbox/viewer components (`ImageLightbox.tsx`, `MoodboardViewer.tsx`, `CircleMessageBubble.tsx`'s lightbox), and the print/export card generators (`ShareableCreatorCard.tsx`, `ShareableProfileCard.tsx`, `CompCardPreview.tsx`) — the last group specifically because `ImageLoader`'s forced `loading="lazy"` would break their eager-load-then-capture requirement.

## Deferred — lower priority, not fixed this round

A cluster of admin-only avatar/thumbnail instances (`src/components/admin/UsersTab.tsx`, `VerificationTab.tsx`, `CheckInsTab.tsx`, `PartnerSubmissionsTab.tsx`, plus a few profile/session list items) were found "missing lazy + error, has layout protection" — real but lower-traffic (admin-only or below-the-fold list items). Left for a follow-up pass rather than expanding this PR further.

## Verification

- `npx tsc --noEmit -p tsconfig.app.json` — clean.
- `npm run build` — clean.
- `RUNTIME_CONFIRMED`: `TrendingLane.tsx`'s fix, live in the dev server as an authenticated user — the "New on Kretopia" section renders correctly with its existing empty-thumbnail treatment, no console errors or crashes tied to this change.
- The remaining 11 files rely on the same verified pattern (per-item/per-instance failure tracking, reusing each component's own existing fallback branch) but were not individually click-tested — most require a specific account state or seeded data (a listing to browse, a match with a like, a saved gig) not available in this environment.

## Deployment steps required

None. Frontend-only, no migration, no edge function.
