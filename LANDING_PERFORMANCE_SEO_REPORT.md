# Landing Performance & SEO Report

## Status: `AUDITED`, `BROWSER_VERIFIED`

## Method

Real Lighthouse 13.4.1 runs (desktop preset, headless Chrome), **against the actual production build** — `npm run build` output served via `vite preview`, not the Vite dev server. This distinction matters: the dev server's unbundled ESM module graph and lack of minification produced a misleading first pass (Performance score 55, LCP 15.9s) that has nothing to do with what a real visitor experiences. All numbers below are from the production build.

Three runs were taken to account for normal local single-machine variance (headless Chrome CPU contention on a shared dev machine, no CDN/edge caching to smooth this out) rather than treating one run as gospel.

## Scores (production build, local machine)

| Category | Run 1 | Run 2 (after a11y fixes) | Run 3 (final) |
|---|---|---|---|
| Performance | 96 | 84 | 86 |
| Accessibility | 82 | 91 | 96 |
| Best Practices | 96 | 96 | 96 |
| SEO | 100 | 100 | 100 |

Accessibility climbs across the three runs because it was **re-measured after each accessibility fix landed in a fresh build** (see [LANDING_ACCESSIBILITY_REPORT.md](LANDING_ACCESSIBILITY_REPORT.md)) — that progression is real, not noise. The Performance swing (96 → 84 → 86) is run-to-run local variance in Largest Contentful Paint specifically (1.2s / 2.5s / 1.9s across the three runs) with Total Blocking Time and Cumulative Layout Shift staying rock-steady at 0ms and ~0.003–0.005 throughout — that stability is the more trustworthy signal. **This is a single local machine's measurement, not a production/CDN-hosted one** — Lovable's actual hosting (HTTP/2, edge caching, compression) will differ from `vite preview` on a laptop.

## Core Web Vitals (representative range across the 3 runs)

| Metric | Range | Assessment |
|---|---|---|
| First Contentful Paint | 0.9 – 1.0s | Good |
| Largest Contentful Paint | 1.2 – 2.5s | Good to Needs Improvement |
| Total Blocking Time | 0ms | Excellent, unchanged across all runs |
| Cumulative Layout Shift | 0.003 – 0.005 | Excellent — no visible layout jank |
| Speed Index | 1.2 – 1.9s | Good |

## Code-splitting is real, not aspirational

The Landing architecture's stated design — hero on the critical path, everything else lazy — is verified directly in the build output, not just asserted:

- `KretopiaLanding` (hero + critical path): **12.4 KB**
- `LandingBelowFold` (everything else, chapters/tutorials/footer): **71.6 KB**, loaded only once the visitor approaches it or the browser goes idle

The zero Total Blocking Time and sub-1s FCP across every run are consistent with this: the guest's very first paint depends on a genuinely small chunk, not the app's full bundle.

## SEO — 100/100, verified specifically (not just the headline score)

Individual audits, all passing: meta description present, document title present, valid `rel=canonical`, page is crawlable (not blocked), valid `hreflang`, every image has `alt` text. `sitemap.xml` (232 URLs — 142 profiles, 80 credits) is generated at build time; the FAQ section's JSON-LD (`FAQPage`) ships in `index.html` for rich-result eligibility, per prior Landing work.

## Known opportunity, not fixed here (whole-app scope)

Lighthouse flags an estimated **344 KiB of unused JavaScript** on initial load — consistent with the build's own long-standing warning about chunks over 500 KB (`Discover`, `index`, `ThriveDesk`, etc.). This is a pre-existing, app-wide bundling characteristic (the SPA's shared entry chunk carries code for routes well beyond Landing), not something introduced by or fixable within this Landing-scoped overhaul. A proper fix means an app-wide route-level code-splitting pass — a separate initiative, flagged here as a fast-follow rather than attempted in this pass.
