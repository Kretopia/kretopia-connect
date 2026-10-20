# Product corrections: report

2026-10-21, branch `feat/product-corrections`, from `main` @ `e3a622eeb`. Nothing is deployed, no migration is applied, no data was changed, no payment, Stripe, Daily key, Twilio, Gmail or OAuth code was touched, and no dependency was added. The paused platform task is recorded in `docs/platform/PAUSED_PLATFORM_ENGINEER_TASK.md` and was not resumed.

## Files
Created:
- `docs/platform/PAUSED_PLATFORM_ENGINEER_TASK.md`, `docs/product/KREPAY_PROOF_OF_PAYMENT.md`, `docs/product/PRODUCT_CORRECTIONS_BACKLOG.md`, `docs/product/PRODUCT_CORRECTIONS_REPORT.md`
- `src/components/passport/VerificationLegend.tsx`, `src/hooks/useCosignRequests.ts`, `src/lib/passport/cosignRequests.ts`
- Tests: `src/components/profile/__tests__/CoSignsSection.test.tsx`, `src/lib/passport/__tests__/cosignRequests.test.ts`, `src/pages/__tests__/CreativeCircle.invite.test.tsx`

Modified:
- Calls: `src/components/calls/CallMediaControls.tsx`, `GlobalVideoCallHost.tsx`, `PersistentCallWindow.tsx`, `src/components/project/VideoCallSheet.tsx`, `src/index.css`; tests `CallMediaControls.test.tsx`, `StudioCallLifecycle.test.tsx`
- Passport and co-signs: `src/lib/passport/creditEvidence.ts`, `src/components/profile/CoSignsSection.tsx`, `CreditVerificationPanel.tsx`, `src/components/credits/CreditsStampsPanel.tsx`; tests `creditEvidence.test.ts`, `CreditsStampsPanel.test.tsx`
- Booking: `src/components/passport/PublicPassportHero.tsx`, `src/pages/CreatorEPK.tsx`; test `PublicPassportHero.test.tsx`
- Social metrics: `src/components/profile/SocialStatsInline.tsx`; test `SocialStatsInline.test.tsx`
- Search: `src/components/Navbar.tsx`
- Settings: `src/pages/Settings.tsx`, `src/components/settings/SettingsNav.tsx`
- Creative Circle: `src/pages/CreativeCircle.tsx`

## Implemented
1. **Studio Calls, one toolbar.** Mic, camera, participants, chat, screen share, recording and leave are in the top bar of the Studio call and of the meeting call; the two footer rows are gone. Invite, mute all (host) and report/block moved into a "More call options" menu, so no action was lost and permissions are unchanged. On phones the bar takes a full-width second row inside the header; the minimize button follows the bar height. Checked in a browser with the real toolbar component, buttons and CSS on a throwaway page (not a live call), at 320 px in both themes, 375 px and 1280 px: no overflow, all eight buttons visible. Not covered: Daily's own tray inside the iframe (see the backlog).
2. **Passport verification clarity.** One legend ("What do these statuses mean?") on the Co-signs tab and the Stamps list: Self-declared, Co-signed, AI-checked, Verified, each in plain words. Verified uses the owner's sentence, followed by what is also true in the data: credits Kretopia records itself or finds on a platform are marked Verified too and each credit shows its basis. AI-checked is described as a lead, never proof or certainty, and never changes a status. The signer's history says Co-signed, not "Verified — co-signed".
3. **Credits and co-signs, proof.** Each credit card shows project, role, client or platform, year, its basis ("Co-signed by 2 collaborators", "Verified on YouTube", "Self-declared · AI-checked: possible public evidence found (not proof)") and its status. Each co-sign request shows signer, state, and the date it was asked or answered. Pending, declined and expired are visually distinct from accepted. Dates and contributor names appear where the credit row carries them; the Stamps list cannot show them (backlog).
4. **Ask for a co-sign.** The existing request flow (dialog, duplicate guard, notification to members) is now reachable from the Stamps list as well as the Co-signs tab. The requester sees Request sent / Pending / Accepted / Declined with the signer and date, and cannot send a second request while one waits (a reminder is offered instead; after a decline the button reads "Ask someone else").
5. **Bookable creative.** The public Passport shows "Available to book" and a Book link to the existing booking page when the creative has active booking hours; otherwise nothing. Never shown to the owner on their own Passport.
6. **KrePay proof of payment.** Design document only.
7. **Social metrics.** Found a real bug: the Reach card looked for `subscribers` while the YouTube sync stores `subscriberCount` as a string, so connected creators saw "No synced audience metrics yet". It now reads the real field and shows only real, non-negative counts; otherwise the existing empty state. Nothing else is synced, so nothing else is shown.
8. **Search.** The magnifying glass is back in the desktop navbar (it was hidden from the large breakpoint up) and opens the existing search sheet, whose input is kept at a readable width. Checked at 1024 px: visible, no clipping, sheet opens.
9. **Settings, browser fixes.** Defensive: the section navigation wraps instead of scrolling sideways, and the setting rows wrap and shrink their text instead of pushing the switch out. The Opera-only bug was not reproduced.
10. **Creative Circle, Invite friends.** A button at the top scrolls to the existing invite card (personal link, QR, Share, Copy), now titled Invite friends. No new provider and no invented tracking.

## Deferred on purpose
Everything in `docs/product/PRODUCT_CORRECTIONS_BACKLOG.md`, in short: hiding Daily's own tray; showing AI-checked, dates and verifier in the Stamps list (needs an RPC change); whether platform imports should keep reading Verified; exposing `bookings_enabled` publicly; engagement, reach and recent-performance metrics (not synced); reading Today's social distribution from the syncs; per-invite status on Creative Circle; email invites; KrePay build.

## Verification
- 201 test files / 2008 tests pass (CI configuration); typecheck 0 errors; `vite build` ok; ESLint errors on every changed source file unchanged from `main`.
- New tests, each with a mutation check that fails when the behaviour is removed: toolbar contents and absence of footer bars, request states, declined styling, unknown statuses dropped, YouTube field, booking card only with hours, AI note never claims verification.

## QA checklist
- [ ] Join a Studio call and a /meet call on desktop and on a phone: one bar, every control works, recording shows its state, Leave asks for confirmation, More menu has Invite (and Mute all as host, Report/Block with a peer).
- [ ] Minimize and restore the call on a phone: the minimize button does not overlap the bar.
- [ ] Credits > Stamps and Passport > Co-signs: legend opens; statuses read right; Ask for a co-sign opens the dialog; a pending request shows a reminder, not a second ask; declined shows Ask someone else.
- [ ] Accept and decline a co-sign as the signer, then check the requester's view.
- [ ] A creative with booking hours: public Passport shows Available to book and Book opens their booking page; one without: nothing; your own Passport: nothing.
- [ ] Passport Reach for a creator with a YouTube sync: the count shows; for one without: the empty state.
- [ ] Desktop navbar (signed in and signed out) at 1024, 1280 and 1440 px: search icon visible, sheet opens, nothing clipped; mobile navbar unchanged.
- [ ] Settings in Chrome, Safari, Firefox, Edge and Opera at narrow and wide widths: all sections reachable, switches visible.
- [ ] Creative Circle: Invite friends scrolls to the card; copy, share and QR work; no link shows the plain message.

## Rollback
Revert the pull request. It changes the interface and reads existing tables only: no migration, no data, no edge function, no secret. Individual commits revert on their own (calls, search, settings, social metrics, booking, Creative Circle, verification and co-signs, docs).
