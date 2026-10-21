# Hardening lot for the direct Resend senders (prepared 2026-10-21)

Do this **before** `kretopia.com` is verified in Resend. Today every send from `noreply@kretopia.com` / `info@kretopia.com` is refused, which hides the weaknesses below. Once the domain is verified, the old copies running in the Lovable project `kretopia-app` start sending.

Method: shared imports of main's version checked against kretopia-app (`read_file`, 404 = missing); prod copies read for the risky functions; tables, columns, RPC and cron headers checked in production (read only). Nothing was changed in production.

## Step 1: shared files (paste each whole file, in this order)
| # | File (from `main`) | State in kretopia-app | Why |
|---|---|---|---|
| 1 | `supabase/functions/_shared/callerAuth.ts` | missing | imported by admin-guard |
| 2 | `supabase/functions/_shared/admin-guard.ts` | older copy (no callerAuth import) | only change: constant-time compare of the cron secret |
| 3 | `supabase/functions/_shared/getPaidLink.ts` | missing | needed by send-get-paid-link |
| 4 | `supabase/functions/_shared/guestVerification.ts` | missing | needed by verify-guest-opportunity |

Already present and in step with main (nothing to paste): `outboundText.ts`, `outboundBudget.ts`, `inviteSecret.ts` (copied 2026-10-21), `projectAccess.ts`, `weeklyEmail.ts`, `stripeEnv.ts`, `productFilePaths.ts`, `aiModels.ts` (prod's copy has `GEMINI_3_FLASH`, the only constant the lot needs; do not overwrite it).

## Step 2: functions (paste each whole `index.ts` from `main`, any order, after step 1)
**Must: confirmed old in production**
- `send-activity-digest`: prod says "No auth check needed" and runs with the service role; anyone with the public anon key can trigger up to 100 emails to real users per call. Main requires cron secret or admin.
- `send-get-paid-link`: prod has no project access check, no escaping, any signed-in account can send a "wants to pay you" mail with its own HTML. Main: access check, escaping, validated recipient.
- `verify-guest-opportunity`: public endpoint; `guestVerification.ts` is missing in prod, so it predates the per-address limit. Keep its Verify JWT setting as it is (public).
- `verify-brand-credit`: prod copy has the auth check but sends the brand name, address and creator name unsanitised.

**Should: main has security changes since prod's last deploy (prod copy not read)**
- `send-outreach-email` (send budget, recipient rules), `process-outreach-queue` and `process-scheduled-campaigns` (+5 lines: cron-or-admin guard; cron jobs 15 and 16 already send `x-cron-secret`, checked), `send-project-invitation` (prod equals main before PR #252).

PRs #252 and #253 (a refused send is no longer reported as sent) are already in main's version of these files.

## Not in this lot
- **Already guarded in prod (read):** `send-broadcast-email`, `send-waitlist-invite`, `process-drip-campaign` (admin or cron, only the sender address differs).
- **No hardening change since Oct 6, only `info@` to `noreply@`:** `send-weekly-digest`, `send-weekly-matches`, `send-founder-note-reminder`, `send-notification-email`, `send-user-email`.
- **Payments, need your explicit go:** `complete-product-purchase` (also needs the new `_shared/purchaseEntitlement.ts`; it changes who receives product files), `guest-wallet-session` (credit once, code attempts), `send-invoice-email` (sender address only).

## Checked in production (read only)
Tables used by the lot all exist; `create_unclaimed_profile` exists; `opportunities` has the five guest columns; `email_send_log.metadata` exists; no schema change needed. Cron: only jobs 15 (`process-outreach-queue-daily`, 09:00) and 16 (`process-scheduled-campaigns`, every 5 min) call lot functions, both send the cron secret. A Code Editor save keeps each function's Verify JWT setting.

## After pasting
1. Tell Claude which functions were pasted; it reads each back and compares with `main` (AST compare, formatting ignored).
2. Anonymous probe of `send-activity-digest` must answer 401 with its own body (it must never be run without the guard).
3. Only then verify `kretopia.com` in Resend (DNS records at Namecheap, see the backlog), and retest an invitation by email.
