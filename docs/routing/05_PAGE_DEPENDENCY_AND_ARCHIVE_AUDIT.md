# Kretopia Connect — Routing Reports

**Audit date:** 2 November 2026

**Project:** `kretopia-connect-main`

**Scope:** local React/Vite app, route and public-navigation reviews

**Evidence:** user-provided Terminal outputs from 1–2 November 2026.


> These are source-based audit reports, not production runtime tests. Historical snapshots are marked as such. No Git commit, remote push, backend update, or deployment was performed in preparing these reports.

## Initial page/module audit

The initial inventory found **159 files** under `src/pages`: **146** top-level files and **13** nested page-specific modules. Not every file is a routed screen; some are helpers or components. This snapshot predates V3 archival.

The dependency audit reviewed **38** files, finding **22** with direct imports and **16** without direct imports. Earlier preliminary filtering had flagged **42** potential review candidates; the 38-file audit is a narrower inspected subset.

**Do not classify a file as unused merely because a direct import is absent.** The original audit explicitly excluded dynamic routing and runtime access from its proof.

## Files without direct imports in the 38-file review

| # | Source file | Subsequent decision |
|---:|---|---|
| 1 | `src/pages/DailyCheckIn.tsx` | Not archived in V3; no deletion decision |
| 2 | `src/pages/FeedbackAdmin.tsx` | Archived locally in V3 (confirmed) |
| 3 | `src/pages/Guide.tsx` | Retained; Guide V2 activated |
| 4 | `src/pages/ICDBDiscovery.tsx` | Not archived in V3; no deletion decision |
| 5 | `src/pages/Landing.tsx` | Not archived in V3; no deletion decision |
| 6 | `src/pages/ListingDetail.tsx` | Not archived in V3; no deletion decision |
| 7 | `src/pages/MyPurchases.tsx` | Archived locally in V3 (confirmed) |
| 8 | `src/pages/NotFound.tsx` | Not archived in V3; no deletion decision |
| 9 | `src/pages/PartnerDirectory.tsx` | Archived locally in V3 (confirmed) |
| 10 | `src/pages/PartnerSubmit.tsx` | Archived locally in V3 (confirmed) |
| 11 | `src/pages/PurchaseSuccess.tsx` | Not archived in V3; no deletion decision |
| 12 | `src/pages/TestEmails.tsx` | Archived locally in V3 (confirmed) |
| 13 | `src/pages/ViewProfile.tsx` | Not archived in V3; no deletion decision |
| 14 | `src/pages/WaitlistAdmin.tsx` | Archived locally in V3 (confirmed) |
| 15 | `src/pages/profile/ProfileContentSections.tsx` | Not archived in V3; no deletion decision |
| 16 | `src/pages/profile/ProfileVerificationSection.tsx` | Not archived in V3; no deletion decision |

## V3 local archival (2 November)

The following six pages were confirmed absent from `src/pages` and present in the local backup directory:

```text
.local-backups/legacy-pages-v3/20261102-063832-189722/
├── FeedbackAdmin.tsx
├── MyPurchases.tsx
├── PartnerDirectory.tsx
├── PartnerSubmit.tsx
├── TestEmails.tsx
└── WaitlistAdmin.tsx
```

- `Guide.tsx` intentionally retained and later reactivated.
- `BottomNav.tsx` intentionally retained.
- Associated app routes/redirects were preserved in the source during V3.
- Post-V3 and post-Guide TypeScript validation later reported PASS.
- **This report does not authorize deletion** of other candidates, nor assume archived content is available in a Git clone: `.local-backups` is a Mac-local path and may be ignored by Git.

## Original complete 159-file list (historical)

| # | File |
|---:|---|
| 1 | `src/pages/About.tsx` |
| 2 | `src/pages/AcceptInvite.tsx` |
| 3 | `src/pages/Accounting.tsx` |
| 4 | `src/pages/Admin.tsx` |
| 5 | `src/pages/AdminBroadcast.tsx` |
| 6 | `src/pages/AdminDisputes.tsx` |
| 7 | `src/pages/AdminExternal.tsx` |
| 8 | `src/pages/AdminWeeklyNote.tsx` |
| 9 | `src/pages/AgentsActivity.tsx` |
| 10 | `src/pages/Ambassador.tsx` |
| 11 | `src/pages/Ambassadors.tsx` |
| 12 | `src/pages/Auth.tsx` |
| 13 | `src/pages/BookingPage.tsx` |
| 14 | `src/pages/BrandVault.tsx` |
| 15 | `src/pages/BrandVerify.tsx` |
| 16 | `src/pages/BrandWorkHome.tsx` |
| 17 | `src/pages/CallPage.tsx` |
| 18 | `src/pages/CheckIn.tsx` |
| 19 | `src/pages/CircleChatView.tsx` |
| 20 | `src/pages/CircleDetail.tsx` |
| 21 | `src/pages/Circles.tsx` |
| 22 | `src/pages/Claim.tsx` |
| 23 | `src/pages/ClaimEvent.tsx` |
| 24 | `src/pages/ClaimGig.tsx` |
| 25 | `src/pages/ClaimListing.tsx` |
| 26 | `src/pages/ClaimProfile.tsx` |
| 27 | `src/pages/ClientDetail.tsx` |
| 28 | `src/pages/Clients.tsx` |
| 29 | `src/pages/CommunityGuidelines.tsx` |
| 30 | `src/pages/CompCard.tsx` |
| 31 | `src/pages/CompCardBuilder.tsx` |
| 32 | `src/pages/CompanyOnboarding.tsx` |
| 33 | `src/pages/CopilotMemory.tsx` |
| 34 | `src/pages/CreativeCircle.tsx` |
| 35 | `src/pages/CreatorEPK.tsx` |
| 36 | `src/pages/CreatorSite.tsx` |
| 37 | `src/pages/CreatorSiteByUsername.tsx` |
| 38 | `src/pages/CreatorWorkHome.tsx` |
| 39 | `src/pages/CreditVerify.tsx` |
| 40 | `src/pages/CreditsDashboard.tsx` |
| 41 | `src/pages/CuratedStage.tsx` |
| 42 | `src/pages/DailyCheckIn.tsx` |
| 43 | `src/pages/DemoAgent.tsx` |
| 44 | `src/pages/Discover.tsx` |
| 45 | `src/pages/DisputeCredit.tsx` |
| 46 | `src/pages/DisputeManage.tsx` |
| 47 | `src/pages/EmailUnsubscribe.tsx` |
| 48 | `src/pages/EndorseSkill.tsx` |
| 49 | `src/pages/EventBackstage.tsx` |
| 50 | `src/pages/EventConfirmed.tsx` |
| 51 | `src/pages/EventCrewMode.tsx` |
| 52 | `src/pages/EventPage.tsx` |
| 53 | `src/pages/Events.tsx` |
| 54 | `src/pages/ExternalListing.tsx` |
| 55 | `src/pages/FeedbackAdmin.tsx` |
| 56 | `src/pages/FounderKitMetrics.tsx` |
| 57 | `src/pages/FounderKitOnePager.tsx` |
| 58 | `src/pages/FoundingMember.tsx` |
| 59 | `src/pages/Fund.tsx` |
| 60 | `src/pages/FundCampaign.tsx` |
| 61 | `src/pages/FundManage.tsx` |
| 62 | `src/pages/FundNew.tsx` |
| 63 | `src/pages/GuestCall.tsx` |
| 64 | `src/pages/GuestPass.tsx` |
| 65 | `src/pages/GuestPay.tsx` |
| 66 | `src/pages/GuestStudio.tsx` |
| 67 | `src/pages/Guide.tsx` |
| 68 | `src/pages/HandleResolver.tsx` |
| 69 | `src/pages/ICDBDiscovery.tsx` |
| 70 | `src/pages/ICDBProjectPage.tsx` |
| 71 | `src/pages/Inbox.tsx` |
| 72 | `src/pages/Install.tsx` |
| 73 | `src/pages/Intel.tsx` |
| 74 | `src/pages/JoinGuestStudio.tsx` |
| 75 | `src/pages/JoinWithCode.tsx` |
| 76 | `src/pages/KretoTab.tsx` |
| 77 | `src/pages/Landing.tsx` |
| 78 | `src/pages/ListingDetail.tsx` |
| 79 | `src/pages/Magazine.tsx` |
| 80 | `src/pages/MagazineArticlePage.tsx` |
| 81 | `src/pages/ManageHub.tsx` |
| 82 | `src/pages/ManageOpportunities.tsx` |
| 83 | `src/pages/Match.tsx` |
| 84 | `src/pages/Meetup.tsx` |
| 85 | `src/pages/MeetupManage.tsx` |
| 86 | `src/pages/Messages.tsx` |
| 87 | `src/pages/MyPurchases.tsx` |
| 88 | `src/pages/NearbyCreators.tsx` |
| 89 | `src/pages/NewRoomPage.tsx` |
| 90 | `src/pages/NotFound.tsx` |
| 91 | `src/pages/Notifications.tsx` |
| 92 | `src/pages/OAuthConsent.tsx` |
| 93 | `src/pages/Onboarding.tsx` |
| 94 | `src/pages/Opportunities.tsx` |
| 95 | `src/pages/OpportunityDashboard.tsx` |
| 96 | `src/pages/OpportunityDetail.tsx` |
| 97 | `src/pages/PartnerDirectory.tsx` |
| 98 | `src/pages/PartnerSubmit.tsx` |
| 99 | `src/pages/PassportDirectory.tsx` |
| 100 | `src/pages/PayInvoice.tsx` |
| 101 | `src/pages/PayLink.tsx` |
| 102 | `src/pages/PaymentCanceled.tsx` |
| 103 | `src/pages/PaymentSuccess.tsx` |
| 104 | `src/pages/PerksTab.tsx` |
| 105 | `src/pages/PersonalRoom.tsx` |
| 106 | `src/pages/Podcast.tsx` |
| 107 | `src/pages/PostOpportunity.tsx` |
| 108 | `src/pages/Privacy.tsx` |
| 109 | `src/pages/ProductionPage.tsx` |
| 110 | `src/pages/Profile.tsx` |
| 111 | `src/pages/ProjectReview.tsx` |
| 112 | `src/pages/ProjectsList.tsx` |
| 113 | `src/pages/PurchaseSuccess.tsx` |
| 114 | `src/pages/Recordings.tsx` |
| 115 | `src/pages/SalesDashboard.tsx` |
| 116 | `src/pages/Scene.tsx` |
| 117 | `src/pages/Scout.tsx` |
| 118 | `src/pages/SearchResults.tsx` |
| 119 | `src/pages/Settings.tsx` |
| 120 | `src/pages/ShareRedirects.tsx` |
| 121 | `src/pages/SharedDeck.tsx` |
| 122 | `src/pages/Shortlists.tsx` |
| 123 | `src/pages/SpeedIndex.tsx` |
| 124 | `src/pages/SpeedRecap.tsx` |
| 125 | `src/pages/SpeedSession.tsx` |
| 126 | `src/pages/Spotlight.tsx` |
| 127 | `src/pages/Stages.tsx` |
| 128 | `src/pages/StudioImport.tsx` |
| 129 | `src/pages/StudioRecap.tsx` |
| 130 | `src/pages/SubmitReview.tsx` |
| 131 | `src/pages/Subscription.tsx` |
| 132 | `src/pages/TalentFinder.tsx` |
| 133 | `src/pages/TalentManager.tsx` |
| 134 | `src/pages/Terms.tsx` |
| 135 | `src/pages/TestEmails.tsx` |
| 136 | `src/pages/ThriveDesk.tsx` |
| 137 | `src/pages/ThriveGenerate.tsx` |
| 138 | `src/pages/ThrivePay.tsx` |
| 139 | `src/pages/Unsubscribe.tsx` |
| 140 | `src/pages/VerifyOpportunity.tsx` |
| 141 | `src/pages/ViewProfile.tsx` |
| 142 | `src/pages/WaitlistAdmin.tsx` |
| 143 | `src/pages/WebsiteBuilder.tsx` |
| 144 | `src/pages/Welcome.tsx` |
| 145 | `src/pages/WorkHome.tsx` |
| 146 | `src/pages/WorkHomeSkeleton.tsx` |
| 147 | `src/pages/messages/ChatHeader.tsx` |
| 148 | `src/pages/messages/ConversationListPanel.tsx` |
| 149 | `src/pages/messages/EmptyChatState.tsx` |
| 150 | `src/pages/messages/MessageBubble.tsx` |
| 151 | `src/pages/messages/MessageComposer.tsx` |
| 152 | `src/pages/messages/MessagesEmptyState.tsx` |
| 153 | `src/pages/messages/types.ts` |
| 154 | `src/pages/messages/useChatMessages.ts` |
| 155 | `src/pages/messages/useConversations.ts` |
| 156 | `src/pages/messages/useSendMessage.ts` |
| 157 | `src/pages/profile/ProfileContentSections.tsx` |
| 158 | `src/pages/profile/ProfileDialogs.tsx` |
| 159 | `src/pages/profile/ProfileVerificationSection.tsx` |

**Evidence:** `Pasted text (2)(20261101-213027).txt` for initial file inventory; `Pasted text(20261101-223117).txt` for import checks; local V3 status output provided on 2 November.
