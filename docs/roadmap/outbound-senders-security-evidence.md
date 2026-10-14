# Outbound senders: inventory and security evidence (Phase 1, one gate)

Status: **code complete in this PR; not merged, not deployed.** No migration, policy, secret or data change. The release is a manual paste into the Lovable project `kretopia-app`.

Gate: *a function that makes Kretopia email or notify someone is triggered by a proven actor, with a bounded blast radius, and puts no unescaped request text in a mail from our own domain.* Matrix row 13 (GA AUX-05; CE p.17, p.21, p.36): "list each sender and its gate". Repository findings (code evidence); none was reproduced against production.

## 1. Inventory

Found by scanning `supabase/functions` for functions that send mail through Resend or the transactional sender, plus the `send-*`, `notify-*`, `*-reminder*` and digest names (about 50). "Read" means the gate and its effect were read in this pass; "signal" means an authentication or guard helper is present in the file and the recipient and content constraints were **not** reviewed.

| Class | Functions | Gate | Review |
|---|---|---|---|
| **Fixed in this PR** | `send-activity-digest`, `send-streak-warning`, `send-reengagement` | had none ("No auth check needed", no JWT, no secret): anyone with the public key could trigger a bulk send to up to 100 users per call. Now `requireAdminOrCron` | read |
| | `send-get-paid-link` | any signed-in user: arbitrary recipient, arbitrary project title, name and free message interpolated unescaped into a payment email from our domain; `projectId` never checked. Now money access on that project, title from the database, everything escaped and clipped | read |
| | `verify-guest-opportunity` (action `send-verification`) | public by design (guests have no account) but uncapped: unlimited verification mails to any address, company name and title unescaped. Now a plain address, 3 per address per hour counted in `opportunities` before anything is stored, escaped | read |
| Cron or admin guard | `process-drip-campaign`, `process-outreach-queue`, `process-scheduled-campaigns`, `send-broadcast-email`, `send-day2-engagement`, `send-event-reminders`, `event-reminders`, `send-founder-note-reminder`, `send-onboarding-reminders`, `send-reengagement-emails`, `send-test-emails`, `send-waitlist-invite`, `send-weekly-digest`, `send-weekly-matches`, `speed-session-recap`, `speed-session-reminders`, `stage-reminders`, `thrivefund-finalize-campaign`, `auto-outreach-watch`, `challenge-deadline-reminder`, `daily-match-digest`, `refresh-my-universe` | `requireAdminOrCron` (`x-cron-secret` or an admin session) or the Lovable cron secret | signal (2026-10-09 audit, F12) |
| Signed webhook | `auth-email-hook` | `verifyWebhookRequest` (signature and timestamp) | signal |
| Service role only | `send-notification-email` | the caller token must be the service role | signal |
| Signed-in, relationship read | `send-event-blast`, `send-event-invite` (the caller created the event), `send-credit-invite` (the caller owns the credit), `invite-to-stage` (the caller hosts the stage), `send-invoice-email` (the caller issued the invoice), `send-push-notification` (accepted project or event relationship with the target), `send-transactional-email`, `send-user-email` (the 2026-10-09 policy modules) | caller and object relationship | read |
| Signed-in, signal only | `agent-send-dm`, `merge-accounts-init`, `rsvp-speed-session`, `send-invoice-chase`, `send-outreach-draft`, `send-outreach-email`, `send-phone-otp`, `send-project-invitation`, `thrivefund-create-pledge`, `verify-brand-credit`, `notify-swipe`, `notify-speed-pool-ping`, `notify-speed-session-update`, `complete-product-purchase` | authenticated caller; recipient and content constraints not reviewed | **signal** |
| Public by design, capped | `guest-wallet-session` | email code, 5 codes per address per hour counted in `guest_wallet_email_codes` | read |
| Not a sender | `send-circle-invite` | logs and inserts into `circle_invites`, which has no migration and no consumer: nothing is sent | read |

## 2. Affected actor, object, action

- **Anyone holding the public anon key** (the three guarded functions): trigger bulk mail or in-app notifications to real users, repeatedly.
- **Any signed-in account** (`send-get-paid-link`): send a "someone wants to pay you" mail, with its own markup and links, to any address from `noreply@kretopia.com`; create an in-app payment notification for any registered user.
- **Anyone, unauthenticated** (`verify-guest-opportunity`): mail-bomb an address, and inject markup through the company name and title.

## 3. Rules now

| Function | Rule |
|---|---|
| `send-activity-digest`, `send-streak-warning`, `send-reengagement` | cron secret or admin session; otherwise 401 |
| `send-get-paid-link` | `projectId` is a UUID; the caller is the owner or an accepted collaborator or creative of that project (the tier that sees amounts: clients and guests are refused, 403); the recipient is one plain address (no list, no angle brackets, no line breaks); the title is read from the database; name and message are clipped (80 and 500) and every value is HTML-escaped; a failed access lookup answers 503 |
| `verify-guest-opportunity` | the address is one plain address; at most 3 guest posts per address per hour, counted before the file upload, the insert and the mail; a failed count answers 503; company name and title are escaped in the mail, the subject is a single clipped line |

Shared pure helpers: `_shared/outboundText.ts` (`escapeHtmlText`, `cleanRecipientEmail`, `cleanFreeText`, `singleLine`), `_shared/getPaidLink.ts`, `_shared/guestVerification.ts`. Existing guards reused unchanged: `_shared/admin-guard.ts`, `_shared/projectAccess.ts`.

## 4. Tests

`src/lib/__tests__/outboundSenders.test.ts`: 22 passing. Roles: caller with money access, accepted client or guest, no access, access lookup failed, unauthenticated; missing, malformed and non-UUID project id; 12 malformed recipient variants (list, semicolon, angle bracket, header injection, over-long, non-string); markup, control characters and length; guest address under, at and over the cap, invalid address, failed count. Wiring: each decision precedes the first read, notification, store or send in the five functions, and no unescaped `${message}`, `${recipientName}` or `<strong>${senderName}` remains. With the nine other security suites: **172 passing**. ESLint clean.

After the paste:

| Request | Expected |
|---|---|
| POST `send-activity-digest` (or the two others) with only the anon key | **401** |
| same with the `x-cron-secret` header | 200, as before |
| `send-get-paid-link` as the project owner, valid address | 200, mail with escaped text |
| `send-get-paid-link` as an accepted client, an unrelated user, or with no `projectId` | **403 / 403 / 400**, no mail, no notification |
| `send-get-paid-link` with `message = "<a href=...>"` | the mail shows the text, not a link |
| `verify-guest-opportunity` 4 times for one address within an hour | 200, 200, 200, **429** |

## 5. Remaining gaps (not addressed here)

- **Cron headers.** If a scheduled job calls one of the three newly guarded functions it must send `x-cron-secret`, or its next run answers 401. From this repository the jobs cannot be listed (`cron.job` is not in the migrations for these three); check before pasting, with the same pattern as `security/cron-secret-headers-2026-10-09.sql`.
- The "signal only" row of section 1 is the unfinished part of the inventory: recipient and content constraints of those fourteen functions were not read. `send-outreach-email` and `send-project-invitation` are the next two to read.
- `send-get-paid-link` still looks the recipient up with `listUsers()` (first page only), so the in-app notification only reaches users on that page; it also returns `notificationSent`, which tells the caller that an address has an account. Both are left as is because the caller now has money access on a project.
- Per-sender volume caps for signed-in callers exist only in `send-transactional-email`; the in-memory limiter is per instance. A durable per-user send ledger is a schema change.
- `send-credit-invite` accepts an unbounded `external_collaborators` array and an unescaped `project_name` handed to the template.

## 6. Rollback

Re-paste the previous version of the function. The `_shared` helpers can stay: nothing else imports them.

## 7. Release state (merged is not deployed)

| File | Paste order | State |
|---|---|---|
| `_shared/outboundText.ts` | first | not deployed |
| `_shared/getPaidLink.ts`, `_shared/guestVerification.ts` | after `outboundText.ts` | not deployed |
| `send-activity-digest`, `send-streak-warning`, `send-reengagement` | after the cron header check above; need `_shared/admin-guard.ts` (in place since the 2026-10-09 paste) | not deployed |
| `send-get-paid-link` | needs `_shared/projectAccess.ts` | not deployed |
| `verify-guest-opportunity` | | not deployed |

Checksums at this commit: `outboundText.ts` `ae20433c5293e79164baa06ec3e154a53d4ed02fb07dd4c9ee35a56b3d628da0`, `getPaidLink.ts` `c72b65a22fa994322c16a64a5a1307b736bd26358a69ea39982bd58ba9b109c3`, `guestVerification.ts` `52600f34eca8360b14f96e8f679d2124f9bcf2a02a3a4f4e6bfa873592ea08b3`, `send-get-paid-link` `b3ecb55cf9d25b6a31e34023989428ac195a894c57ab476f9308fed2fdf21f77`, `verify-guest-opportunity` `ea2603c80e96d96769e96a69388f0fc61585a4d1fa69df40bb1eb70e03069614`, `send-activity-digest` `9a4a549e4dbc0cea09c90ee56b34e55ccd7f9e3c29c8c5bbc1b3adb3bd139231`, `send-streak-warning` `71a8d8ad64ea5355595720735bfacc86bf063b938acef92fcacc67593078f176`, `send-reengagement` `1bd3ce6f4bcd3c43f4e64e41df871a547c5230dbb64e8cb1bbd2e567abb778c0`.
