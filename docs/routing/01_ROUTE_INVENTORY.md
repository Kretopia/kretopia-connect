# Kretopia Connect — Routing Reports

**Audit date:** 2 November 2026

**Project:** `kretopia-connect-main`

**Scope:** local React/Vite app, route and public-navigation reviews

**Evidence:** user-provided Terminal outputs from 1–2 November 2026.


> These are source-based audit reports, not production runtime tests. Historical snapshots are marked as such. No Git commit, remote push, backend update, or deployment was performed in preparing these reports.

## Summary of 1 November snapshot

- **180** JSX route declarations in `src/App.tsx`
- **53** routes classified as `ProtectedRoute` by the initial extractor
- **41** routes classified as explicit `<Navigate>` redirects by the initial extractor
- **86** other route declarations (including direct components, exceptional paths, wildcard)
- **159** files under `src/pages` in the initial snapshot (146 top-level plus 13 nested files)
- Additional routing-related source files: `src/lib/routePrefetch.ts`, `src/lib/stagesRoutes.ts`.

**Historical snapshot warning:** This table is not a current source-of-truth export. For example, `/guide` was `REDIRECT → /` at this point and has since been changed to render `<Guide />`. Six historical page files were archived after this snapshot.

## Route-by-route inventory — source snapshot

| # | Path | Component / routing result |
|---:|---|---|
| 1 | `/` | `DefaultRoute` |
| 2 | `/landing` | `Welcome` |
| 3 | `/auth` | `Auth` |
| 4 | `/.lovable/oauth/consent` | `OAuthConsent` |
| 5 | `/claim` | `Claim` |
| 6 | `/agents` | `AgentsActivity` |
| 7 | `/demo/agent` | `DemoAgent` |
| 8 | `/founder-kit` | `FounderKitOnePager` |
| 9 | `/founder-kit/onepager` | `FounderKitOnePager` |
| 10 | `/founder-kit/metrics` | `FounderKitMetrics` |
| 11 | `/onboarding` | `ProtectedRoute` |
| 12 | `/unboarding` | `REDIRECT → /onboarding` |
| 13 | `/founding-member` | `ProtectedRoute` |
| 14 | `/company-onboarding` | `ProtectedRoute` |
| 15 | `/circle` | `Stages` |
| 16 | `/circle/speed` | `Stages` |
| 17 | `/circle/speed/:id` | `Stages` |
| 18 | `/circle/speed/:id/recap` | `Stages` |
| 19 | `/circle/stage/:id` | `Stages` |
| 20 | `/crews` | `Circles` |
| 21 | `/crew/:circleId` | `ProtectedRoute` |
| 22 | `/crew/:circleId/chat` | `ProtectedRoute` |
| 23 | `/circles` | `REDIRECT → /crews` |
| 24 | `/circle/:circleId` | `ProtectedRoute` |
| 25 | `/circle/:circleId/chat` | `ProtectedRoute` |
| 26 | `/profile` | `ProtectedRoute` |
| 27 | `/profile/edit` | `REDIRECT → /profile?edit=true` |
| 28 | `/dashboard` | `REDIRECT → /` |
| 29 | `/profile/:userId` | `CreatorEPK` |
| 30 | `/dispute/:creditId` | `ProtectedRoute` |
| 31 | `/dispute-manage/:disputeId` | `ProtectedRoute` |
| 32 | `/epk/:userId` | `CreatorEPK` |
| 33 | `/comp/:userId` | `CompCard` |
| 34 | `/passport` | `PassportDirectory` |
| 35 | `/passport/comp-card` | `ProtectedRoute` |
| 36 | `/passport/:passportId` | `HandleResolver` |
| 37 | `/:handle/room` | `PersonalRoom` |
| 38 | `/:handle/book` | `BookingPage` |
| 39 | `/site/:userId` | `CreatorSite` |
| 40 | `/website-builder` | `ProtectedRoute` |
| 41 | `/messages` | `ProtectedRoute` |
| 42 | `/settings` | `ProtectedRoute` |
| 43 | `/settings/copilot-memory` | `ProtectedRoute` |
| 44 | `/my-analytics` | `REDIRECT → /profile` |
| 45 | `/guide` | `REDIRECT → /` |
| 46 | `/desk` | `ProtectedRoute` |
| 47 | `/desk/new-room` | `ProtectedRoute` |
| 48 | `/desk/projects` | `REDIRECT → /desk` |
| 49 | `/studio/import` | `ProtectedRoute` |
| 50 | `/shortlists` | `ProtectedRoute` |
| 51 | `/desk/:projectId` | `ProtectedRoute` |
| 52 | `/desk/:id/thrive/generate` | `ProtectedRoute` |
| 53 | `/thrive/generate` | `ProtectedRoute` |
| 54 | `/brand-vault` | `ProtectedRoute` |
| 55 | `/deck/:token` | `SharedDeck` |
| 56 | `/studio/:token` | `StudioRecap` |
| 57 | `/manage` | `ProtectedRoute` |
| 58 | `/clients` | `ProtectedRoute` |
| 59 | `/recordings` | `ProtectedRoute` |
| 60 | `/clients/:clientId` | `ProtectedRoute` |
| 61 | `/fund` | `Fund` |
| 62 | `/fund/new` | `ProtectedRoute` |
| 63 | `/fund/manage` | `ProtectedRoute` |
| 64 | `/fund/:slug` | `FundCampaign` |
| 65 | `/subscription` | `ProtectedRoute` |
| 66 | `/thrivepay` | `ProtectedRoute` |
| 67 | `/guest-pay` | `GuestPay` |
| 68 | `/wallet` | `REDIRECT → /thrivepay` |
| 69 | `/purchases` | `REDIRECT → /thrivepay` |
| 70 | `/accounting` | `REDIRECT → /thrivepay?tab=earnings` |
| 71 | `/thrivemoney` | `REDIRECT → /thrivepay?tab=earnings` |
| 72 | `/purchase-success` | `PaymentSuccess` |
| 73 | `/payment-success` | `PaymentSuccess` |
| 74 | `/payment-canceled` | `PaymentCanceled` |
| 75 | `/pay/invoice/:id` | `PayInvoice` |
| 76 | `/pay/:slug` | `PayLink` |
| 77 | `/agent` | `REDIRECT → /circle` |
| 78 | `/sales` | `ProtectedRoute` |
| 79 | `/leads` | `ProtectedRoute` |
| 80 | `/rolodex` | `ProtectedRoute` |
| 81 | `/outreach` | `ProtectedRoute` |
| 82 | `/thrive-ai` | `REDIRECT → /circle` |
| 83 | `/challenges` | `REDIRECT → /` |
| 84 | `/challenges/:id` | `REDIRECT → /` |
| 85 | `/market` | `REDIRECT → /opportunities` |
| 86 | `/market/:listingId` | `REDIRECT → /opportunities` |
| 87 | `/talent-manager` | `ProtectedRoute` |
| 88 | `/creative-circle` | `ProtectedRoute` |
| 89 | `/ambassadors` | `Ambassadors` |
| 90 | `/ambassador` | `ProtectedRoute` |
| 91 | `/checkin` | `REDIRECT → /` |
| 92 | `/nearby` | `NearbyCreators` |
| 93 | `/events/backstage` | `Stages` |
| 94 | `/events` | `REDIRECT → /meetup` |
| 95 | `/desk/:projectId/crew` | `EventCrewMode` |
| 96 | `/scene` | `Scene` |
| 97 | `/explore` | `REDIRECT → /nearby` |
| 98 | `/magazine/:slug` | `MagazineArticlePage` |
| 99 | `/magazine` | `REDIRECT → /spotlight?tab=magazine` |
| 100 | `/podcast` | `REDIRECT → /spotlight?tab=podcast` |
| 101 | `/spotlight` | `Spotlight` |
| 102 | `/install` | `Install` |
| 103 | `/call/:token` | `GuestCall` |
| 104 | `/meet/:meetingId` | `CallPage` |
| 105 | `/guest/:token` | `GuestStudio` |
| 106 | `/review/:token` | `ProjectReview` |
| 107 | `/join/:code` | `JoinWithCode` |
| 108 | `/accept-invite/:projectId` | `AcceptInvite` |
| 109 | `/desk/join/:token` | `JoinGuestStudio` |
| 110 | `/admin` | `ProtectedRoute` |
| 111 | `/admin/weekly-note` | `ProtectedRoute` |
| 112 | `/admin/external` | `ProtectedRoute` |
| 113 | `/admin/disputes` | `ProtectedRoute` |
| 114 | `/analytics` | `REDIRECT → /admin` |
| 115 | `/admin-broadcast` | `REDIRECT → /admin` |
| 116 | `/waitlist-admin` | `REDIRECT → /admin` |
| 117 | `/test-emails` | `REDIRECT → /admin` |
| 118 | `/feedback-admin` | `REDIRECT → /admin` |
| 119 | `/deck` | `REDIRECT → /` |
| 120 | `/terms` | `Terms` |
| 121 | `/privacy` | `Privacy` |
| 122 | `/community-guidelines` | `CommunityGuidelines` |
| 123 | `/about` | `About` |
| 124 | `/unsubscribe` | `Unsubscribe` |
| 125 | `/email-unsubscribe` | `Suspense` |
| 126 | `/share/gig/:id` | `ShareGigRedirect` |
| 127 | `/share/profile/:id` | `ShareProfileRedirect` |
| 128 | `/share/event/:id` | `ShareEventRedirect` |
| 129 | `/share/magazine/:slug` | `ShareMagazineRedirect` |
| 130 | `/share/fund/:slug` | `ShareCampaignRedirect` |
| 131 | `/partner-directory` | `REDIRECT → /` |
| 132 | `/partner-submit` | `REDIRECT → /` |
| 133 | `/opportunity/:id` | `OpportunityDetail` |
| 134 | `/opportunity-dashboard` | `ProtectedRoute` |
| 135 | `/manage-opportunities` | `ProtectedRoute` |
| 136 | `/talent-finder` | `ProtectedRoute` |
| 137 | `/rewards` | `REDIRECT → /` |
| 138 | `/rewards-shop` | `REDIRECT → /` |
| 139 | `/credits` | `CreditsDashboard` |
| 140 | `/credits/mine` | `REDIRECT → /credits` |
| 141 | `/credits/hub` | `REDIRECT → /credits` |
| 142 | `/credits/project/:projectId` | `ICDBProjectPage` |
| 143 | `/credits/discover` | `REDIRECT → /search` |
| 144 | `/verify-credit` | `BrandVerify` |
| 145 | `/search` | `SearchResults` |
| 146 | `/directory` | `REDIRECT → /search` |
| 147 | `/discover` | `Discover` |
| 148 | `/match` | `Match` |
| 149 | `/soundstages` | `Stages` |
| 150 | `/sound-stages` | `REDIRECT → /soundstages` |
| 151 | `/opportunities` | `Opportunities` |
| 152 | `/scout` | `ProtectedRoute` |
| 153 | `/event/:eventId` | `EventPage` |
| 154 | `/event/:eventId/confirmed` | `EventConfirmed` |
| 155 | `/event/:eventId/pass` | `GuestPass` |
| 156 | `/meetup` | `Meetup` |
| 157 | `/meetup/manage` | `MeetupManage` |
| 158 | `/meetups` | `REDIRECT → /meetup` |
| 159 | `/endorse` | `EndorseSkill` |
| 160 | `/submit-review` | `SubmitReview` |
| 161 | `/claim/:claimToken` | `ClaimProfile` |
| 162 | `/listing/:id` | `ExternalListing` |
| 163 | `/claim-listing/:id/:token` | `ProtectedRoute` |
| 164 | `/claim-listing/:id` | `ProtectedRoute` |
| 165 | `/post-opportunity` | `PostOpportunity` |
| 166 | `/claim-gig/:token` | `ClaimGig` |
| 167 | `/claim-event/:token` | `ClaimEvent` |
| 168 | `/verify-opportunity` | `VerifyOpportunity` |
| 169 | `/credit-verify` | `CreditVerify` |
| 170 | `/kreto` | `ProtectedRoute` |
| 171 | `/perks` | `ProtectedRoute` |
| 172 | `/production` | `ProductionPage` |
| 173 | `/notifications` | `ProtectedRoute` |
| 174 | `/inbox` | `ProtectedRoute` |
| 175 | `/intel` | `ProtectedRoute` |
| 176 | `/spark` | `REDIRECT → /` |
| 177 | `/cre8` | `REDIRECT → /` |
| 178 | `/marketplace` | `REDIRECT → /opportunities` |
| 179 | `/:username` | `CreatorSiteByUsername` |
| 180 | `*` | `CatchAllRedirect` |

## Source of extraction

Terminal output: `Pasted text (2)(20261101-213027).txt` — `KRETOPIA CONNECT — COMPLETE PAGE INVENTORY`. The audit printed "READ ONLY — NO NETWORK — NO MODIFICATIONS".
