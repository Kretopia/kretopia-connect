# Edge-function lockdown: deploy guide (2026-10-09)

Production functions only change when their code is saved in the **Lovable Code Editor of the project
`kretopia-app`** (merging to GitHub does not deploy them). Verify JWT settings stay untouched by a paste.
Do the steps in this order; step 1 and 2 are what stop the open mail relay.

## Why

* `send-transactional-email` trusted every caller holding *any* valid JWT, and the public anon key is one:
  anyone could send any template to any address, with any text and links, from our sender domain.
* Eleven cron-driven functions run with the service role and had no caller check, so the public key was
  enough to trigger them (outreach queue, scheduled campaigns, reminders, challenge rotation, dispute
  auto-resolution, ...). `x-cron-secret` is the existing mechanism (`_shared/admin-guard.ts`).
* Share-link password guesses and double-clicked approvals had no brake.

## 0. Before anything: the sender file (kretopia-app only)

`send-transactional-email` now imports the sender pair from `_shared/emailSender.ts`, so pasting a newer
function can never overwrite which sender a backend may use again. **Create this file first in kretopia-app**
(it must differ from `main`, which points at kretopia.com):

```ts
export const SENDER_DOMAIN: string = 'notify.thrivein.io'
export const FROM_DOMAIN: string = 'thrivein.io'
```

When `@kretopia.com` is verified and published in Cloud > Emails, change these two lines (and nothing else).

## 1. Stop the open relay (3 files, in this order)

1. `_shared/callerAuth.ts` (new), `_shared/transactionalEmailPolicy.ts` (new)
2. `send-transactional-email/index.ts` (replace)

Then test: RSVP to a **fresh** event as a guest (idempotency keys of earlier tests are burnt) and check
`email_send_log` shows `sent`. A request with only the anon key and `templateName: "welcome"` must now answer 403.
The four templates the app sends from the browser keep working: `event-registration-confirmation`,
`application-confirmation`, `new-applicant-notification`, `application-status-update`.

## 2. Cron-driven functions (13 jobs)

1. Run `security/cron-secret-headers-2026-10-09.sql` (adds the `x-cron-secret` header to cron jobs
   11-16, 22, 28, 30, 33, 36, 41-44; all-or-nothing, never prints the secret). It is harmless before the paste.
2. Replace `_shared/admin-guard.ts` (now compares the secret in constant time and imports `callerAuth.ts`).
3. Replace these functions, then check the next scheduled run answers 200 in `net._http_response`:
   `auto-resolve-disputes`, `challenge-deadline-reminder`, `process-outreach-queue`,
   `process-scheduled-campaigns`, `speed-session-autocancel`, `speed-session-recap`,
   `speed-session-reminders`, `stage-reminders`, `generate-challenges`, `weekly-universe-scan`, `desk-daily-nudge`.
   (`auto-resolve-disputes` is also called by an admin from the Disputes page: the guard accepts an admin session.)

## 3. The rest

* `redeem-project-share/index.ts`: de-duplicates approvals, bounds field lengths, throttles password guesses.
* `universal-search/index.ts`: signed-in members only (nothing in the app calls it today).

## Rollback

Re-paste the previous version of the file from the Code Editor history (`list_edits` shows each save).
Removing the cron header is never needed: the extra header is ignored by unguarded functions.
