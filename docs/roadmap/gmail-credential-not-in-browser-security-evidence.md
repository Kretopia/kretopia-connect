# The browser no longer loads the stored Gmail app password: security evidence (frontend, one gate)

Status: **code complete in this PR; not merged, not published.** Frontend only: no SQL, no policy, no secret, no data change. It takes effect on the next frontend publish.

Gate: *a credential is not transported to a place that does not need it.* Follows `outbound-senders-third-pass-security-evidence.md` section 2 and is the "can ship immediately" frontend step of `proposal-gmail-credential-storage.md`.

## 1. Finding (repository evidence, not reproduced in production)

`GmailSettings.tsx` and `useOutreachData.ts` read the user's own row of `user_email_settings` with `select("*")`. That row holds `gmail_app_password` in plaintext. So on every visit to the outreach screens the app password was delivered to the browser and kept in the React Query cache, where any script running in the page (an injected script, a hostile extension, a debug tool) could read it. The UI never uses the value: it only sends a new password to `send-outreach-email` when connecting.

## 2. Change

- `src/lib/outreach/emailSettingsColumns.ts` (new): `EMAIL_SETTINGS_COLUMNS`, an explicit column list without the credential.
- `GmailSettings.tsx` and `useOutreachData.ts` select that list instead of `"*"`.
- `src/lib/__tests__/emailSettingsColumns.test.ts`: 3 tests. The list names no password, secret or token; **no client file under `src/` reads `user_email_settings` with `select("*")`, an empty select, or a select that names the password** (a scan of the source tree, so a future reader fails the suite); the two readers use the shared list.

No behaviour changes for the user: the screens use `gmail_email`, `is_configured`, `provider` and the timestamps.

## 3. Remaining gap (not addressed here)

The credential is still **readable by its owner through the data API**: the policy "Users manage own email settings" is `FOR ALL` on `user_id = auth.uid()`, so a direct request by the owner returns it. Closing that is the column-level privilege step and the encryption of the value, both in `proposal-gmail-credential-storage.md` (approval-gated, SQL and a new secret). This PR only stops the application itself from pulling the secret into the browser.

## 4. Tests

Role view (client code): any screen that loads the settings, the connect form (writes only), disconnect (writes only). Run: the new suite, 3 passing. ESLint reports only the `as any` already present in the two files; this change adds none. Not run: a browser session against a real backend.

## 5. Rollback

Revert the commit. Nothing else depends on the constant.

## 6. Release state

| Item | State |
|---|---|
| frontend change | merged is not published: it takes effect on the next frontend publish |
| credential at rest and its API readability | unchanged (proposal) |
