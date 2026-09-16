# Email and Stripe Sandbox Testing

Section 11 of the August 31 release charter. Scope: test transactional email delivery using only noe@kretopia.com/ethan@kretopia.com, and Stripe in sandbox mode only, never live. This section was held pending explicit approval throughout Sections 12–15 and only executed after that approval was given.

Compiled: 2026-08-18. Repo: `/Users/noeplantier/thrivein-new-beta`, branch `feature/activation-priority-plan`.

## 1. Stripe — not tested this pass

Before touching anything Stripe-related, asked the user directly whether the `STRIPE_SECRET_KEY` configured in this project's secrets is a test or live key — this can't be determined from the repo, since every payment edge function (`create-invoice-checkout`, `check-connect-status`, `thrivefund-release-milestone`, etc.) reads it as an opaque `Deno.env.get("STRIPE_SECRET_KEY")` with no mode indicator in code.

**Confirmed: live mode.** With no sandbox environment available to test against, running any payment-creating flow would risk a real transaction — exactly what the charter's own rule ("Stripe sandbox mode ONLY, never call live `stripe.transfers.create()`, never move real money") prohibits. Stripe testing is skipped for this pass rather than run against live keys. If sandbox testing is still wanted, it needs either a second Stripe account in test mode connected to a preview/staging environment, or Stripe's test-mode toggle applied to this project's existing account with its own separate key — neither of which this session can set up unilaterally.

## 2. Email — tested via the real password-reset flow

Confirmed with the user that accounts already exist for both noe@kretopia.com and ethan@kretopia.com, so testing used the existing password-reset flow rather than creating new accounts.

**Why this flow**: `ForgotPasswordDialog.tsx` calls `supabase.auth.resetPasswordForEmail()`, which routes through `auth-email-hook` — the one system [EMAIL_RELEASE_AUDIT.md](EMAIL_RELEASE_AUDIT.md) rated **"Good"**: a genuine, signature-verified Supabase Auth webhook, not one of the audit's flagged direct-Resend paths. Testing this exercises the real production email pipeline through a real user action, with no new data created and no state change unless the recipient actually clicks the link (which wasn't done).

**Execution**, live in the browser, guest session (via the same reversible localStorage-swap technique used throughout this engagement, auth token restored afterward):

1. `/auth?tab=signin` → Forgot Password → typed `noe@kretopia.com` (verified via DOM read before submit) → clicked "Send Reset Link" **once**. The dialog closed immediately after, which only happens on `ForgotPasswordDialog.tsx`'s success branch (`onOpenChange(false)` runs only in the `else` — no-error — path); no error toast or console error appeared.
2. Reopened the dialog fresh, typed `ethan@kretopia.com` (verified via DOM read before submit) → clicked "Send Reset Link" **once**. This time the "Check Your Email — We've sent you a password reset link. Please check your inbox." toast was directly visible in the screenshot, confirming the success path explicitly — and by the same code path, retroactively confirming the noe@ attempt succeeded the same way.

**Duplicate-send check**: each address was submitted exactly once, with the input value verified via direct DOM read immediately before each submit click, and no retry after a click that appeared to register. No third address, and no other test data, was touched.

**Not independently confirmed this pass**: actual inbox delivery (no access to either mailbox) and a server-side log pull from the Lovable Cloud dashboard confirming dispatch — the UI-level success confirmation (toast + correct closed-dialog state, one of the two directly visible) was the evidence gathered. If a definitive delivery receipt is wanted, checking the `auth-email-hook` function's logs in the Lovable Cloud dashboard, or having noe@/ethan@ confirm receipt directly, would close that gap.

## 3. Verification

No source code was changed in this section — it was a live-testing pass only. No new commits beyond this report.
