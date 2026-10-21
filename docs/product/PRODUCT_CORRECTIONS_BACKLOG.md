# Product corrections: backlog

Items found while doing the product corrections of 2026-10-21 that need a product decision, a backend or database change, or information the code could not give. None of them was faked or worked around in the interface.

## Calls
- **Daily's own tray inside the iframe cannot be hidden from the app.** The app now has one toolbar of its own (the top bar). Daily Prebuilt draws its own control tray inside the iframe, and `daily-js` 0.89 has options to show or hide the leave button, the fullscreen button, the local video and the participants bar, but none for the tray. Whether that tray is visible today could not be checked here (it needs a real call). To have exactly one toolbar on screen, either move the call UI to Daily's call-object mode with fully custom video tiles (large), or accept the tray and keep ours. Decision needed.
- The Studio call frame is created with `showFullscreenButton: true`; the meeting frame with `false`. Decide whether Studio should match.

## Passport: verification and co-signs
- **Almost none of the 80 credits marked Verified in production is collaborator-confirmed**: by source they are YouTube 38, web-verified 34, Spotify 5, web scan 2 and manual 1; at most one has a named verifier and none has a collaborator endorsement. The interface now says honestly what Verified covers and shows each credit's basis. Whether imported credits should keep reading Verified, or read "Found on YouTube", is a product decision that changes counts on the Passport, in Today and in ranking.
- **The Credits dashboard list comes from the `search_my_credits` RPC, which returns no `ai_confidence`, no start or end date and no verifier name.** The AI-checked note, a period and a "confirmed by" name therefore appear where the credit row has them (the Passport and public Passport) and not in the Stamps list. Adding them needs an RPC change, which is a database change.
- The AI check (`verify-credit`) writes `credit_ai_verifications` and `credits.ai_confidence` but never `verification_status`. `discover-creators` counts `ai_confidence >= 0.7` as good as Verified; align it if AI-checked should never rank like Verified.
- Co-sign requests have an `expired` state in the table's check constraint but no job ever sets it; the interface only shows it if a row has it.
- A co-sign request sent by email link (no account) shows the name the requester typed; there is no read of whether the link was opened.

## Booking
- `profiles.bookings_enabled` is not in `public_profiles_safe`, so the public Passport shows "Available to book" when the creative has an active booking window. A creative who switched booking off but left windows active would still show the button, and `book-meeting` would then refuse the booking. `BookingPage` itself does not check the flag either. Fixes: expose the flag in the public view (a migration), or deactivate windows when booking is switched off.

## Social metrics
- Only YouTube has a stored audience number (`subscriberCount`, as a string), and for 5 of the 6 YouTube connections the sync stored none. No engagement, reach or recent-performance numbers are synced for any platform. Getting them needs new sync work or new provider scopes, which the brief ruled out.
- Reach is shown on the owner's Passport only. Whether it should be public (`connected_platforms_public` carries the same `platform_data`) is a product decision.
- The Today dashboard's "social distribution" reads the profile's own counters (`youtube_subscribers`, `instagram_followers`, ...), which AGENTS.md says not to use for Reach because they go stale. It should read the connected-platform syncs.
- `ProfilePreviewDialog` shows hard-coded follower numbers for the demo profile only; fine as long as demo mode is clearly a demo.

## Settings
- **The Opera-only bug was not reproduced.** Without the exact version and a screenshot, the changes are defensive: the section navigation wraps instead of scrolling sideways (a horizontal scroll can hide sections without any cue, and, suspected, Opera's sidebar narrows the viewport), and the setting rows wrap and shrink their text instead of pushing the switch out. Suspected causes also worth checking with the reporter: Opera's built-in ad or cookie-dialog blocker hiding an element by its class or id (no Settings class or id matches the usual filter words), and Opera's text-size or zoom settings. Ask for the Opera version, whether Opera GX, and a screenshot.

## Creative Circle
- `InviteCodesCard` (per-code usage and QR) is mounted nowhere. Per-invite status exists in the `invites` table (`current_uses`, `max_uses`, `used_at`); showing it on the Creative Circle page is a small follow-up.
- There is no email invite for friends (only for circles via `send-circle-invite`). Link, QR, native share and copy are what exists; adding email would need a sender decision.

## KrePay proof of payment
- Design only: `docs/product/KREPAY_PROOF_OF_PAYMENT.md`, with five open questions at its end (default reviewer, retention, whether a bare reference can reach Verified, whether `manual_bank_transfers.status` already has the four values, scope of currencies).

## Projects
- ~~**Archiving a project does not work.**~~ Fixed 2026-10-21 (M12): the database check now allows `archived`, which the project settings menu, the older settings component and the server archive tool already wrote.
