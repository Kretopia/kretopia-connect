# Deadline Day — Performance Report

## Status: `AUDITED`. No new performance work required for today's P0/P2 changes — one incidental improvement noted. Prior performance work from the Kreto Platform Acceleration program is summarized for a complete picture.

## Today's changes — performance impact

**`EventCommunityHub`'s tab wrapping has a small, real performance upside**, not just a UX one: Radix UI's `Tabs` component only renders the *active* tab's `TabsContent` to the DOM — inactive panels aren't mounted. Before this change, the guest roster, the group-chat card, the inline chat (with its own realtime subscription), and the comment thread (with its own realtime subscription) were **all mounted and subscribed simultaneously** on every visit to an event page. After this change, only the active tab's component is mounted — e.g., a visitor who never clicks into "Chat" never opens that realtime connection at all. This reduces simultaneous Supabase realtime channels and DOM nodes per event-page visit. Not benchmarked (no test event/account available to measure against), but the mechanism is a direct, well-understood property of how Radix Tabs works, not a claim requiring live measurement to be true.

**No other performance-relevant code was touched** in the P0 (comment moderation, co-host copy) or P2 (Events/Messages) work this round.

## Carried forward from the Kreto Platform Acceleration program (still valid, not re-measured today)

- **Main JS bundle cut 26%**: 2,380.92KB → 1,753.45KB minified (721.21KB → 536.74KB gzipped), by lazy-loading `QuickActionFab`'s four dialogs instead of statically importing them (one of which pulled in `pdfjs-dist`, ~787KB, for every visitor regardless of whether they ever used that feature). Full detail: `KRETO_BUNDLE_SIZE_REPORT.md`.
- **Dynamic sitemap generation** now runs on every production build via a dedicated Vite plugin, replacing a static file that silently went stale. Build-time only, no runtime user-facing performance effect, but relevant to overall release health. Full detail: `KRETO_DYNAMIC_SITEMAP_REPORT.md`.
- **Image CLS risk, investigated and found already handled**: the audit's own earlier claim that event covers, gig cards, and avatars lacked explicit sizing (a layout-shift risk) did not hold up under direct inspection — all three already use CSS `aspect-ratio` or fixed-height containers that reserve layout space before the image loads. No fix was needed or made.
- **`Discover` route's 1.65MB chunk** is 96% `mapbox-gl`, already correctly isolated behind route-level lazy-loading — large but appropriately scoped, not a bug.
- **Known, deliberately deferred**: an N+1 query pattern in `event-reminders`'s per-participant reminder loop (profile lookup + admin API call + email invoke, all per-user in a loop). Confirmed still present in this round's audit (`DEADLINE_DAY_EVENTS_AND_UX_AUDIT.md` §D/§F.3) — a real performance cost at scale, not a correctness bug, and deliberately left alone per this brief's own "no risky architecture rewrite before deadline" rule.

## Verification

- `npm run build` — clean, no new chunk-size warnings beyond the pre-existing one (main entry and `Discover` still exceed the 500kB advisory threshold, unchanged from before today's work).
- No live performance measurement (Lighthouse, real-user timing) was performed — this environment has no way to load-test against production traffic patterns.
