# Kretopia Connect — Routing Reports

**Audit date:** 2 November 2026

**Project:** `kretopia-connect-main`

**Scope:** local React/Vite app, route and public-navigation reviews

**Evidence:** user-provided Terminal outputs from 1–2 November 2026.


> These are source-based audit reports, not production runtime tests. Historical snapshots are marked as such. No Git commit, remote push, backend update, or deployment was performed in preparing these reports.

## A. Confirmed guest header configuration (2 November)

The user-provided Terminal audit of `src/components/Navbar.tsx` reported the following central navigation items. The renderer was classified `NO / NOT DETECTED` for dropdowns.

| Label | Configured path | Notes |
|---|---|---|
| Platform | `/guide` | Guide V2 route restored and statically validated |
| For Creatives | `/passport` | Interim destination: product feature/directory, not an established dedicated public landing |
| For Companies | `/talent-finder` | Interim destination: initial route inventory called this `ProtectedRoute`; guest experience untested |
| Discover | `/discover` | Initial inventory listed `Discover`; guest accessibility and tab handling untested |

Left remains official logo + wordmark + BETA, linking to `/landing`. Right retains Search, Theme Toggle, Sign in (`/auth?tab=signin`) and Join Kretopia (`/auth?tab=signup`). No visual CSS changes were requested for this navigation pass.

## B. Landing and internal links found by static source scan

> The scan selected 65 files by filename/directory heuristics, including some components not necessarily rendered on the live `/landing` route. It is a **references inventory**, not proof of visible UI.

### Hero and calls to action

| Component | Source reference | Destination found |
|---|---|---|
| `src/components/landing/KretopiaHero.tsx` | L451 | `/passport` |
| `src/components/landing/KretopiaHero.tsx` | L466 | `/auth?next=/scout&src=hero_explore` |
| `src/components/landing/LiveGigsStrip.tsx` | L106 | `/auth?tab=signup&intent=gigs&next=/opportunities` |
| `src/components/landing/LiveGigsStrip.tsx` | L123 | Auth signup with dynamic encoded target `/opportunities/${g.id}` |
| `src/components/landing/DiscoverCreativesRow.tsx` | L83 | `/auth?tab=signup` |
| `src/components/landing/ClaimYourCreditsSection.tsx` | L48 | `/auth?tab=signup` |
| `src/components/landing/ForOrganisationsSection.tsx` | L95 / L109 | `/post-opportunity`, `/auth?tab=signup&src=for_organisations` |
| `src/components/landing/kretopia/LandingBelowFold.tsx` | L92 / L133 / L162 / L187 | Signup/auth targets `/profile`, `/scout`, `/match`, `/desk` |
| `src/components/landing/kretopia/LandingBelowFold.tsx` | L219 | Signup/auth target `/circle?tab=live` |
| `src/components/landing/kretopia/VerifiedCreditsChapterSection.tsx` | L113 | `/credits` |
| `src/components/landing/kretopia/MeetKretoSection.tsx` | L152 / L258 | Auth then `/circle` |
| `src/components/landing/kretopia/InlineSignupBar.tsx` | L38 | `/auth?tab=signup&intent=inline_bar` |
| `src/components/landing/StickyMobileCTA.tsx` | L37 | `/auth?tab=signup&src=sticky_mobile` |
| `src/components/landing/ThriveFundShowcase.tsx` | L99 / L107 | `/fund`, `/fund/new` |
| `src/components/landing/PartnerBenefitsSection.tsx` | L103 / L122 / L160 | `/membership`, `/partner-directory` |

Several other examined component files included a plain `/auth` link: `AccountingSuiteSection`, `BeforeAfterSection`, `ThriveDeskShowcase`, `AIMatchingShowcase`, `WaitlistForm`, `ICDBSection`, `BottomCTASection`, `ComparisonTableSection`, `PortfolioShowcase`, `WhyCreatorsChooseSection`, `CreatorDashboardSection`, and `PostOpportunitySection`.

Some links are dynamic and cannot be enumerated from a literal scan, e.g. `PricingCard` (`ctaLink`), `ProductReelSection` (`tile.href`) and `EditorialFooter` (`link.to`).

## C. Footer references found

The general `src/components/Footer.tsx` contained:

| Label / type | Destination |
|---|---|
| Creative Passport | `/passport` |
| Subscription | `/subscription` |
| Partner Directory | `/partner-directory` |
| Partner Submit | `/partner-submit` |
| About Us | `/about` |
| Terms | `/terms` |
| Privacy | `/privacy` |
| Community Guidelines | `/community-guidelines` |
| Contact | `mailto:info@kretopia.com`, `mailto:support@kretopia.com` |
| Instagram | `https://instagram.com/kretopia` |

`src/components/landing/kretopia/EditorialFooter.tsx` also uses dynamic `link.to`, so the actual landing footer cannot be proved from the general footer's links alone.

## D. Route/access risks to validate

1. **For Companies** currently points at `/talent-finder` (classified `ProtectedRoute` in initial inventory), which is not confirmed as a public company landing. A later heuristic claimed redirect to `/`, but that claim is not reliable.
2. **For Creatives** points at `/passport` (`PassportDirectory` in initial inventory), not a dedicated explanatory landing.
3. **Platform** points at `/guide`, which is a functional guide route but may not satisfy the intended high-level platform marketing page.
4. **Discover** points at `/discover` (classified `Discover` in initial inventory); need to verify guest access and actual browsing behavior.
5. **Footer/dead link risk:** `/partner-directory` and `/partner-submit` were explicit redirects to `/` in the historical inventory; `/membership` was found in component links but not among the 180 route declarations in the initial inventory (potential missing destination).
6. **Auth intent continuity:** Confirm whether `next`, `src`, and `intent` query parameters preserve the visitor's route and tracking intent. Not validated in these source extracts.

**Source:** `Pasted text(20261102-020523).txt` and prior user-provided Navbar snippets (2 November).
