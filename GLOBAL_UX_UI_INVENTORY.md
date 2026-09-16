# Global UX/UI Inventory

Section 1 of the Global Typography, UX/UI and AI-Powered Motion Overhaul. Compiled 2026-08-21 on branch `feature/activation-priority-plan`.

## Methodology — read this before the tables below

This is a **grounded, route-table-driven inventory**, not a per-page manual audit. It was built by:
1. Extracting every `<Route>` registration directly from `src/App.tsx` (174 total) — not guessed, not taken from the brief's ~20-page assumption.
2. Resolving each route to its real target component (including routes wrapped in `<ProtectedRoute>`, resolved to the actual child component).
3. Grepping for real, measurable signals: which pages already use the shared `FeaturePageHeader`/`EditorialPageHero` header system, current font-family usage, etc.

What this inventory **is not**: a per-page manual walkthrough recording primary CTA, body copy, spacing, animation timing, responsive behavior, and accessibility state for all 174 routes. That would mean genuinely opening and evaluating 174 pages — realistically many hours of work on its own — and doing it superficially would produce false confidence, which the brief explicitly warns against ("Never claim the entire project is complete unless every route, interaction and report has evidence"). Instead, **5 representative pages received the full manual treatment** (see `GLOBAL_PAGE_OVERHAUL_REPORT.md`), chosen to cover the shared-header system, a custom-layout page, an AI-heavy surface, a form-heavy surface, and the landing page. The rest of this document gives every route a real, verifiable identity (route → component → purpose inferred from naming) so future passes have a genuine map to work from, rather than nothing.

## Headline numbers

| Metric | Count |
|---|---|
| Total registered routes (`<Route path=...>` in `App.tsx`) | 174 |
| Pure redirects (`element={<Navigate .../>}`, not real pages) | 39 |
| Real, renderable pages (174 − 39) | 135 |
| Distinct page component files in `src/pages/` | 143 |
| Pages already on the shared header system (`FeaturePageHeader` + `EditorialPageHero`, both backed by the one `CinematicHeaderPlate` engine) | 18 (13 + 5) |
| Pages **not yet** on the shared header system | ~125 |

The 18/143 figure (≈13%) is the honest starting point for Section 5/11's "apply Hire Talent quality across the project" — the shared, animated, single-font-family header is currently a minority pattern, not the default. `post-opportunity` (Hire Talent) and `credits` (Verified Credits) are both already on it.

## Route table

Redirect-only routes (`-> Navigate`) are listed separately at the bottom since they carry no UI to overhaul.

### Real pages

| Route | Component | Inferred purpose | Shared header? |
|---|---|---|---|
| `/` | `DefaultRoute` | Landing (guest) / Today redirect (authed) | Landing: custom hero (`KretopiaHero`); Today: custom |
| `/about` | `About` | Brand/company story | Unknown — not yet verified |
| `/accept-invite/:projectId` | `AcceptInvite` | Studio project invite acceptance | Unknown |
| `/admin` | `Admin` (via ProtectedRoute) | Admin dashboard | ✅ `FeaturePageHeader` (per GLOBAL_UX_QA.md Phase 4) |
| `/admin/disputes` | `AdminDisputes` | Dispute moderation queue | Unknown |
| `/admin/weekly-note` | `AdminWeeklyNote` | Admin broadcast/note tool | Unknown |
| `/agents` | `AgentsActivity` | Agent activity log | Unknown |
| `/ambassador` | `Ambassador` | Ambassador program (individual) | Unknown |
| `/ambassadors` | `Ambassadors` | Ambassador program (directory) | Unknown |
| `/auth` | `Auth` | Sign in / sign up | Custom (`AuthBrandingPanel` split-screen) |
| `/brand-vault` | `BrandVault` | Brand asset vault | Unknown |
| `/call/:token` | `GuestCall` | Guest video call entry | Unknown |
| `/circle` | `Circle` | Circle/matching home | Unknown |
| `/circle/:circleId` | `CircleToCrewRedirect` | Legacy circle → crew redirect | N/A (redirect component) |
| `/circle/:circleId/chat` | `CircleToCrewRedirect` | Legacy circle chat → crew redirect | N/A |
| `/circle/speed` | `SpeedIndex` | Speed Sessions index | Unknown |
| `/circle/speed/:id` | `SpeedSession` | Speed Session room | Unknown |
| `/circle/speed/:id/recap` | `SpeedRecap` | Speed Session recap | Unknown |
| `/circle/stage/:id` | `CuratedStage` | Curated Scout/Showcase stage | Unknown |
| `/claim` | `Claim` | Passport claim flow entry | Unknown |
| `/claim-event/:token` | `ClaimEvent` | Event claim via token | Unknown |
| `/claim-gig/:token` | `ClaimGig` | Gig claim via token | Unknown |
| `/claim/:claimToken` | `ClaimProfile` | Profile claim via token | Unknown |
| `/community-guidelines` | `CommunityGuidelines` | Static policy page | Unknown |
| `/comp/:userId` | `CompCard` | Model comp card (public) | Unknown |
| `/company-onboarding` | `CompanyOnboarding` (via ProtectedRoute) | Brand/company account onboarding | Unknown |
| `/creative-circle` | `CreativeCircle` (via ProtectedRoute) | Creative Circle community | Unknown |
| `/credit-verify` | `CreditVerify` | Co-Sign token confirmation (guest) | Custom (verified this session, card 2.2) |
| `/credits` | `CreditDatabase` | Verified Credits directory | ✅ `EditorialPageHero` (redesigned this session) |
| `/credits/mine` | `MyStamps` | User's own stamps/credits | Unknown |
| `/credits/project/:projectId` | `ICDBProjectPage` | Individual ICDB project | Unknown |
| `/crew/:circleId` | `CircleDetailPage` (via ProtectedRoute) | Crew/circle detail | Unknown |
| `/crew/:circleId/chat` | `CircleChatView` (via ProtectedRoute) | Crew chat | Unknown |
| `/crews` | `Circles` | Crews directory | Unknown |
| `/dashboard` | `Dashboard` (via ProtectedRoute) | Company/brand dashboard | Unknown |
| `/deck/:token` | `SharedDeck` | Shared pitch deck view | Unknown |
| `/demo/agent` | `DemoAgent` | Agent demo surface | Unknown |
| `/desk` | `WorkHome` (via ProtectedRoute) | Studio home | Unknown |
| `/desk/:id/thrive/generate` | `ThriveGenerate` (via ProtectedRoute) | AI project generation | Unknown |
| `/desk/:projectId` | `ThriveDesk` (via ProtectedRoute) | Studio project workspace | ✅ Uses `KretoAvatar` reactive states (fixed this session) |
| `/desk/:projectId/crew` | `EventCrewMode` | Event crew mode view | Unknown |
| `/desk/join/:token` | `JoinGuestStudio` | Guest studio join via token | Unknown |
| `/dispute-manage/:disputeId` | `DisputeManage` (via ProtectedRoute) | Dispute management (renders `dispute.status`, verified card 7.3) | Unknown |
| `/dispute/:creditId` | `DisputeCredit` (via ProtectedRoute) | File a credit dispute | Unknown |
| `/discover` | `Discover` | Creator discovery/swipe | Unknown |
| `/email-unsubscribe` | (Suspense-wrapped) | Email unsubscribe | Unknown |
| `/endorse` | `EndorseSkill` | Skill endorsement | Unknown |
| `/epk/:userId` | `CreatorEPK` | Public EPK (redesigned per GLOBAL_UX_QA.md Phase 9) | Custom (dominant 3D HoloCard) |
| `/event/:eventId` | `EventPage` | Event detail | Unknown |
| `/event/:eventId/confirmed` | `EventConfirmed` | Event RSVP confirmation | Unknown |
| `/event/:eventId/pass` | `GuestPass` | Event guest pass | Unknown |
| `/events/backstage` | `EventBackstage` | Event backstage/host view | Unknown |
| `/feedback-admin` | — | Feedback admin (via Navigate in some configs) | Unknown |
| `/founder-kit`, `/founder-kit/onepager` | `FounderKitOnePager` | Founder kit one-pager | Unknown |
| `/founder-kit/metrics` | `FounderKitMetrics` | Founder kit metrics | Unknown |
| `/founding-member` | `FoundingMember` (via ProtectedRoute) | Founding Circle | ✅ `FeaturePageHeader` (GLOBAL_UX_QA.md Phase 1/6) |
| `/fund` | `Fund` | Crowdfunding home | Unknown |
| `/fund/:slug` | `FundCampaign` | Individual campaign | Unknown |
| `/fund/manage` | `FundManage` (via ProtectedRoute) | Campaign management | Unknown |
| `/fund/new` | `FundNew` (via ProtectedRoute) | New campaign | Unknown |
| `/guest-pay` | `GuestPay` | Guest payment entry | Unknown |
| `/guest/:token` | `GuestStudio` | Guest studio access | Unknown |
| `/inbox` | `InboxPage` (via ProtectedRoute) | Inbox | Unknown |
| `/install` | `Install` | PWA install prompt page | Unknown |
| `/intel` | `Intel` (via ProtectedRoute) | Market/talent intel | Unknown |
| `/join/:code` | `JoinWithCode` | Join via invite code | Unknown |
| `/kreto` | `KretoTab` (via ProtectedRoute) | Kreto full-page chat | Uses `KretoAvatar` (fixed this session) |
| `/leads`, `/rolodex`, `/outreach`, `/sales` | `SalesDashboard` | Sales/CRM surfaces (4 routes, 1 component) | Unknown |
| `/magazine/:slug` | `MagazineArticlePage` | Magazine article (branding fixed per card 8.3) | Unknown |
| `/manage` | `ManageHub` (via ProtectedRoute) | Management hub | Unknown |
| `/manage-opportunities` | `ManageOpportunities` (via ProtectedRoute) | Opportunity management | Unknown |
| `/match` | `Match` | Match/collaborator discovery | Unknown |
| `/meet/:meetingId` | `CallPage` | Video call room | Unknown |
| `/meetup`, `/meetup/manage` | `Meetup`, `MeetupManage` | Meetup event pages | Unknown |
| `/messages` | `Messages` (via ProtectedRoute) | Direct messages | Unknown |
| `/nearby` | `NearbyCreators` | Nearby creators map/list | Unknown |
| `/notifications` | `NotificationsPage` (via ProtectedRoute) | Notifications | Unknown |
| `/onboarding` | `Onboarding` (via ProtectedRoute) | User onboarding | Unknown |
| `/opportunities` | `Opportunities` | Scout/gigs feed | ✅ Uses `KretoAvatar` reactive states (Scan now/Draft, fixed this session) |
| `/opportunity-dashboard` | `OpportunityDashboard` (via ProtectedRoute) | Applicant management | Unknown |
| `/opportunity/:id` | `OpportunityDetail` | Single opportunity detail | Unknown |
| `/passport` | `PassportDirectory` | Public Passport directory | Unknown |
| `/passport/:passportId` | `HandleResolver` | Passport handle resolution | N/A (resolver) |
| `/passport/comp-card` | `CompCardBuilder` (via ProtectedRoute) | Comp card builder | Unknown |
| `/pay/:slug` | `PayLink` | Payment link (KrePay) | Verified PII-clean, card 5.2 |
| `/pay/invoice/:id` | `PayInvoice` | Invoice payment | Unknown |
| `/payment-canceled`, `/payment-success`, `/purchase-success` | `PaymentCanceled`, `PaymentSuccess` | Payment result states | Unknown |
| `/perks` | `PerksTab` (via ProtectedRoute) | Perks/rewards | Unknown |
| `/post-opportunity` | `PostOpportunity` | **Hire Talent** — the reference pattern | ✅ `EditorialPageHero`; AI Smart Brief Writer; fixed cover-image/logo upload this session |
| `/privacy`, `/terms`, `/community-guidelines` | `Privacy`, `Terms`, `CommunityGuidelines` | Static legal pages | Unknown |
| `/production` | `ProductionPage` | Production tracking | Unknown |
| `/profile` | `Profile` (via ProtectedRoute) | Own Passport (editable) | ✅ Uses `CinematicHeaderPlate`-family patterns; Bug A/B fixed this session (card 2.3) |
| `/profile/:userId` | `ViewProfile` | View another user's profile | Unknown |
| `/recordings` | `Recordings` (via ProtectedRoute) | Call recordings | Unknown |
| `/review/:token` | `ProjectReview` | Project review via token | Unknown |
| `/scene` | `Scene` | Community/events scene | Unknown |
| `/scout` | `Scout` | Scout opportunity feed | ✅ `FeaturePageHeader` (GLOBAL_UX_QA.md Phase 1/6) |
| `/search` | `SearchResults` | In-app search results | Unknown |
| `/settings`, `/settings/copilot-memory` | `Settings`, `CopilotMemory` (via ProtectedRoute) | Account settings | Privacy toggles confirmed disabled (card 2.3 finding) |
| `/shortlists` | `Shortlists` (via ProtectedRoute) | Saved/shortlisted candidates | Unknown |
| `/site/:userId` | `CreatorSite` | Creator personal site | Unknown |
| `/soundstages` | `SoundStages` | Live rooms/Speed Sessions hub | ✅ `AIStageBriefGenerator` added this session |
| `/spotlight` | `Spotlight` | Featured creators | ✅ `EditorialPageHero` (per TITLE_ANIMATION_AUDIT.md) |
| `/studio/:token` | `StudioRecap` | Studio session recap | Unknown |
| `/studio/import` | `StudioImport` (via ProtectedRoute) | Studio import flow | Unknown |
| `/subscription` | `Subscription` (via ProtectedRoute) | Billing/subscription | Real money — not touched this pass |
| `/submit-review` | `SubmitReview` | Review submission | Unknown |
| `/talent-finder` | `TalentFinder` (via ProtectedRoute) | Talent search (brand-facing) | Unknown |
| `/talent-manager` | `TalentManager` (via ProtectedRoute) | Talent management | Unknown |
| `/thrivepay` | `ThrivePay` (via ProtectedRoute) | Payments dashboard | Real money — not touched this pass |
| `/unsubscribe` | `Unsubscribe` | Email unsubscribe | Unknown |
| `/verify-credit` | `BrandVerify` | Brand credit verification | Unknown |
| `/verify-opportunity` | `VerifyOpportunity` | Opportunity email verification | Unknown |
| `/website-builder` | `WebsiteBuilder` (via ProtectedRoute) | Personal site builder | Unknown |
| `/:handle/book` | `BookingPage` | Public booking page | Unknown |
| `/:handle/room` | `PersonalRoom` | Public personal room | Unknown |
| `/:username` | `CreatorSiteByUsername` | Public creator site by handle | Unknown |

### Pure redirects (39 routes, no UI to overhaul)

`/accounting`, `/admin-broadcast`, `/agent`, `/analytics`, `/challenges`, `/challenges/:id`, `/checkin`, `/circles`, `/cre8`, `/credits/discover`, `/credits/hub`, `/dashboard` (dup), `/deck`, `/desk/projects`, `/directory`, `/events`, `/explore`, `/feedback-admin`, `/guide`, `/landing`, `/magazine`, `/market`, `/market/:listingId`, `/marketplace`, `/meetups`, `/my-analytics`, `/partner-directory`, `/partner-submit`, `/podcast`, `/purchases`, `/rewards`, `/rewards-shop`, `/sound-stages`, `/spark`, `/test-emails`, `/thrive-ai`, `/thrivemoney`, `/wallet`, `/waitlist-admin` — all forward to a canonical route above.

## What "Unknown" means, honestly

Every row marked "Unknown" for shared-header status has **not been opened in a browser this pass**. It's a real route pointing to a real, named component — that part is grounded and verifiable by reading `App.tsx` yourself — but whether it currently uses the shared header system, what font renders, and what its current defects are has not been individually checked. Section 2's font-system fix (one `--font-family-brand` token, cascading from `html, body`) means **every one of these 135 pages already inherits the correct single font-family by default** unless a specific component overrides it with an inline style — that part is a structural guarantee from the CSS change, not a per-page claim. What's *not* guaranteed without individual verification: heading hierarchy, animation consistency, spacing, loading/empty/error states, and accessibility per page.

## Recommended next slice

Given 125 pages don't yet use the shared header system, the highest-leverage next step (not done in this pass) would be migrating the highest-traffic 10-15 of them (Today, Studio workspace, Discover, Messages, Match, Circle) onto `FeaturePageHeader`/`EditorialPageHero`, verified live one at a time — the same discipline used for Verified Credits and Hire Talent this session, not a bulk find-and-replace.
