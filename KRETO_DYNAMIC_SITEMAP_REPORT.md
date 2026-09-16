# Dynamic Sitemap — Fix Report

Follow-up to `KRETO_SEO_ACCESSIBILITY_P3_REPORT.md`, which flagged (but didn't fix) the audit's finding that `public/sitemap.xml` is a static, hand-maintained file whose 15 hardcoded `/epk/{uuid}` links silently go stale.

## Status: `IMPLEMENTED`, `TYPECHECKED`, `BUILD_PASSED`, `RUNTIME_CONFIRMED` (verified against the live production database during a real build).

## What was actually needed

Before writing anything new, checked whether this problem was already solved elsewhere — it was. `plugins/seo-pages.ts` already generates a complete, current sitemap from live data (via the `get_sitemap_profiles` SECURITY DEFINER RPC, already deployed) as one of its two jobs. It's just gated behind `VITE_GENERATE_STATIC_SOCIAL_PAGES=true` alongside its *other* job — emitting individual static HTML files per profile/credit — which is legitimately opt-in because that volume of per-entity file uploads can throttle Lovable's preview uploader.

The sitemap itself is a single file. None of that throttling risk applies to it. Bundling "always-safe sitemap freshness" behind a flag whose real purpose is "opt-in bulk HTML export" was the actual bug — not a missing feature.

## Fix

New `plugins/sitemap-plugin.ts` — a minimal, always-on plugin (same `closeBundle()` pattern as `plugins/version-plugin.ts`) that:
- Calls the same `get_sitemap_profiles` RPC and verified-credits query `seo-pages.ts` already uses.
- Writes `dist/sitemap.xml` with the static routes + every onboarding-complete profile (`/epk/:id`) + every verified credit (`/credits/project/:id`).
- Runs unconditionally in `vite.config.ts`, not behind the static-page flag.

Kept deliberately separate from `seo-pages.ts` rather than refactored into it, so enabling or disabling the bulk static-page export can never affect sitemap freshness either way.

Also fixed the same stale-static-route bugs in `seo-pages.ts`'s own hardcoded list (`/auth`, `/landing`, `/founding-member` — auth-gated or dead redirects, shouldn't be indexed; `/magazine`/`/podcast` — dead redirect stubs, now point at their real `/spotlight?tab=...` destinations) for consistency, since that flag's sitemap output would otherwise regress the exact bugs already fixed in `public/sitemap.xml` during the prior P3 pass.

## Verification

- `npx tsc --noEmit -p tsconfig.node.json` — clean (this is the config that covers `vite.config.ts` and its plugin imports).
- `npm run build` — clean, and the plugin's own log line confirms real live data: `[sitemap] Wrote sitemap.xml with 232 URLs (142 profiles, 80 credits).`
- Inspected `dist/sitemap.xml` directly: static routes present and correct, real profile UUIDs with individually-varied `lastmod` dates pulled from each profile's actual `updated_at`, real verified-credit project IDs likewise dated from their own `updated_at` — not a template or placeholder.

## Deployment steps required

None beyond the normal PR merge and next production build — no migration (the RPC this relies on already exists and is already live), no edge function. The sitemap regenerates fresh on every future build automatically.
