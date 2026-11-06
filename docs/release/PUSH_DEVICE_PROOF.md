# Proof that a push notification reaches a real phone

**Status: not proven.** Everything below the server is code that has tests; what has not been observed is a notification on a physical device. This page is how a person produces that proof in about fifteen minutes, with accounts and devices they are authorised to use. It never uses another person's account and sends no message to a real user.

## What counts as evidence
| Evidence | What it proves | What it does NOT prove |
|---|---|---|
| The test button says "The push service accepted the test for N of M devices" (or the function log says `Successfully sent: N/M`) | Apple's, Google's or Mozilla's push service took the message for those devices | That a phone showed anything |
| A screenshot or photo of the notification on the lock screen | The device received and showed it | That the link opens the right page |
| The tap opens the expected page, with the app signed in as the right account | The deep link works | – |

Only the second and third rows are proof of delivery. "Accepted" alone is never reported as delivered.

## 0. Before the test (blockers if any is missing)
1. **The function that is deployed is the current one.** Production runs the copy of `send-push-notification` pasted into the Lovable project `kretopia-app`, not `main`. Compare it with `supabase/functions/send-push-notification/index.ts`, `_shared/webPush.ts` and `_shared/pushEndpoint.ts` on `main` (pull request #316 changed all three). If they differ, paste the shared files first, then the function.
2. **Secrets exist on that backend** (names only, never values in a chat): `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`. The function answers "VAPID keys not configured" otherwise.
3. **The app was built with the same public key.** `vite.config.ts` uses `VITE_VAPID_PUBLIC_KEY` when it is set and otherwise the public key written in that file; either way it must be the public half of the server's `VAPID_PRIVATE_KEY`. A mismatch is the one case where the phone subscribes without error but the push service refuses every message (403).
4. **A test account you may use, signed in on two devices**: the phone you test, and a laptop (or a second phone) to press the button from.
5. **iPhone or iPad:** iOS 16.4 or later, Safari, then Share > Add to Home Screen, and open the app from that icon. Notifications cannot be turned on from a Safari tab. The app's `/install` page walks through it.
6. **Android:** Chrome. Install the app or use it in the browser; both receive notifications.

## 1. Subscribe the phone
1. On the phone, open the installed app, sign in as the test account, go to Settings > Notifications.
2. Turn **Push Notifications** on and allow the prompt. The app asks only after this tap.
3. The switch must stay on after reloading the app. If it turns itself off, the server did not store the subscription: stop here, nothing will arrive.

## 2. Send the test
1. **Lock the phone** and put it down. Keep the app installed but closed.
2. On the laptop, signed in as the same account, open Settings > Notifications and press **Send a test notification**.
3. Read the line under the button. Record what it says ("accepted for N of M devices", "refused", "no device registered" or "couldn't reach").

## 3. Observe
1. Within a minute the lock screen should show **Kretopia test notification** / "If you can read this, notifications reach this device." Photograph it.
2. Tap it. The app must open on Settings. Screenshot that.
3. Press the button again: the earlier test is replaced, not stacked (same tag).

Nothing appeared:
- "accepted" but no notification: check the phone's Settings > Notifications for the app, Focus or Do Not Disturb, and (iPhone) that the app was opened from the Home Screen icon.
- "refused for all devices": turn notifications off and on again on the phone; if it persists, the VAPID keys in steps 0.2 and 0.3 do not match.
- "no device registered": step 1 did not complete.

## 4. The Co-Sign notification, with two authorised accounts
Account A (requester) and account B (recipient, subscribed as in step 1, phone locked).
1. A opens a credit and asks B to co-sign through the member picker (not a link).
2. B's phone shows "A asked you to co-sign a credit" and nothing else: no project name, no token. Photograph it.
3. B taps it: the app opens **that request** (`/credit-verify?token=…`), signed in as B. B confirms; the page announces success only after re-reading the stored answer.
4. A third account C opening the same link sees "This request is for another account" and nothing changes. (This needs migration `20261106100000_cosign_recipient_authority.sql` applied.)

## 5. What to hand back
The line from step 2.3, the lock-screen photo, the screenshot after the tap, the phone model and OS version, and the date. With those, delivery on that device can be called **verified end to end, on that device**. Production verification is a separate claim: it needs the same run against the production backend with a production test account.
