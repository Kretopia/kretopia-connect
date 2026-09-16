# Kretopia — Email System Hardening Audit

Scope: Phase 3 of the "Security-First Automation, Email Reliability and Stripe Payment QA" charter. Full read of all 18 email-related Supabase Edge Functions plus the shared transactional-template registry. No production email was sent, no DNS/provider config was touched. Two critical findings were fixed in-session (code only, no secrets/DNS/production-data changes); everything else is documented for prioritization.

---

## 1. Three parallel email-sending systems exist

| System | Provider | Pattern | Verdict |
|---|---|---|---|
| **`send-transactional-email` + `process-email-queue`** | Lovable-managed API (`@lovable.dev/email-js`, `LOVABLE_API_KEY`) | Async — enqueues to a `transactional_emails`/`auth_emails` Postgres queue; a separate service-role-only dispatcher (`process-email-queue`) drains it with retry, DLQ, rate-limit backoff, and a duplicate-send guard keyed on `email_send_log`. | **Good.** This is the system to standardize on. Real suppression-list check before enqueue, real `email_unsubscribe_tokens` issuance, real `email_send_log` audit trail, idempotency keys accepted from callers. |
| **`auth-email-hook`** | Same Lovable API, invoked as a genuine Supabase Auth webhook | Signature-verified (`verifyWebhookRequest` against `LOVABLE_API_KEY`, HMAC + timestamp) — Supabase Auth itself calls this on signup/magic-link/recovery/invite/email-change/reauthentication. | **Good.** Correct webhook-auth pattern; not user- or anon-key-invokable. |
| **`send-notification-email`** | Direct Resend (`resend@4.0.0`, `RESEND_API_KEY`) | Synchronous send, no queue, no retry, no DLQ, its own separate unsubscribe-token lookup (not the shared `email_unsubscribe_tokens` table), no suppression-list check, no `email_send_log` insert. | **Was critical, fixed this session** (see §2). 5 real call sites. |

A fourth, smaller system (`send-user-email`, direct Resend, `welcome`/`match`/`message`/`connection_request`/`project_invite`) also exists. **Correction (2026-08-19): the "zero call sites, dead code" claim below was wrong** — a fresh grep found 6 real, live callers (`DirectMessageDialog.tsx`, `MatchModal.tsx`, `StartProjectFromMatchDialog.tsx`, `BrowseCreators.tsx`, `useSendMessage.ts`, `agent-send-dm/index.ts`). Its auth gap (§3.1) has since been fixed, not left as a "recommend deletion" item — see the update in §3.

**Recommendation:** migrate the 5 real call sites of `send-notification-email` onto `send-transactional-email` + the modern template registry, then delete `send-notification-email`. `send-user-email` is in active use for message/connection/project-invite notifications and should stay, now that its authorization gap is fixed (§3.1) — do not delete it. Two Resend-vs-Lovable-API sending paths for the same brand is itself a deliverability risk (only one of the two sending identities may have correct SPF/DKIM/DMARC alignment with `kretopia.com` — this was not verifiable from the codebase and needs a DNS check, see §6).

---

## 2. Critical findings — fixed this session

Both were the same root cause: an edge function with **no `supabase/config.toml` entry** (so it runs on the platform default, `verify_jwt=true`) **and no in-body authorization check**. `verify_jwt=true` only proves the caller holds *a* signed JWT — the public anon key, shipped in the frontend bundle, satisfies it trivially. Functionally these were unauthenticated.

### 2a. `send-notification-email` — unauthenticated open relay (fixed, commit `8572f0f8`)

`type: 'general'` accepted fully arbitrary `notificationTitle` / `notificationMessage` / `actionUrl`, sent to an arbitrary `to` address or `recipientId`, through the real verified `info@kretopia.com` sender. This was an exploitable phishing-as-a-service and mail-bombing vector: anyone with the public anon key could send a "Kretopia"-branded email with attacker-chosen subject, body, and link to any address, or spam/enumerate any user by ID, with no consent or preference check.

**Fix:** added `authorizeSend()` — allows service-role callers (`notify-swipe`, `send-streak-warning`, confirmed via their own service-role-keyed clients), authenticated self-service (`useOnboarding.tsx` sending its own welcome email to `user.email`), or an admin role lookup against `public.user_roles` for any other recipient (`AdminBroadcast.tsx` — itself currently unrouted/unreachable in the app, but still a live code path into this endpoint that needed closing regardless). Everything else now gets 401/403. Verified: `tsc` silent, build clean, 62/62 tests pass.

### 2b. `send-push-notification` — unauthenticated push relay (fixed, commit `1e886071`)

Same missing-config.toml-entry, zero-in-body-check pattern. `userId`/`title`/`body`/`icon`/`data`/`tag` were fully caller-controlled and sent as a real Web Push notification to that user's registered device(s) via VAPID.

**Fix:** unlike 2a, self-service-only would have broken two real, legitimate cross-user flows — `SimpleProjectHeader.tsx` notifying project collaborators when a call starts, and `EventComments.tsx` notifying an event's creator/other commenters about a new comment — both trigger a push to *someone else* from an authenticated session by design. So the fix requires **any authenticated caller or service-role** (closing the fully-anonymous, no-account path) rather than restricting to self/admin. Confirmed all 4 internal callers (`notify-swipe`, `agent-send-dm`, `refresh-my-universe`, `desk-daily-nudge`) already invoke via service-role-keyed clients, so nothing broke. Verified: `tsc` silent, build clean, 62/62 tests pass.

---

## 3. Remaining findings — not fixed, documented for prioritization

### 3.1 `send-user-email` — FIXED 2026-08-19

The original entry here read: *"Authenticated (real `getUser()` check) but no ownership/event verification — any logged-in user can trigger a `match`/`message`/`connection_request`/`project_invite` email to any `recipientId`... Zero live call sites (dead code) — no active abuse surface today... deleting is simpler since nothing calls it."*

**That "zero live call sites" premise was wrong.** A fresh grep (2026-08-19, during a Trello QA reconciliation pass) found 6 real, live callers: `src/components/DirectMessageDialog.tsx`, `src/components/swipe/MatchModal.tsx`, `src/components/project/StartProjectFromMatchDialog.tsx`, `src/components/circle/BrowseCreators.tsx`, `src/pages/messages/useSendMessage.ts`, `supabase/functions/agent-send-dm/index.ts`. The function is in active production use for message/connection/project-invite notifications — it should not be deleted.

**Fixed, not deleted.** `supabase/functions/send-user-email/index.ts` now has a `requireRelationship()` check before every `match`/`message`/`connection_request`/`project_invite` send:
- `match` → requires a real row in `matches` between caller and recipient.
- `message` → requires a real row in `messages` with `sender_id = caller`.
- `connection_request` → requires a real row in `connections` with `user_id = caller`.
- `project_invite` → requires a real row in `project_collaborators` matching `project_id` + `user_id = recipient` + `invited_by = caller`, and the email now uses the DB-verified project title rather than the client-supplied one.

Also fixed in the same pass: `messagePreview` and every other user-controlled value interpolated into the HTML body is now run through a shared `escapeHtml()` (closing the injection finding in row 3 below, for this function specifically); `recipientId` is validated as a well-formed UUID before use in any query, closing a PostgREST filter-injection vector the relationship check itself would otherwise have opened via `.or()`.

| # | Function | Finding | Severity | Status |
|---|---|---|---|---|
| 2 | `send-reengagement-emails` | No cron/admin gate (no config.toml entry, no in-body check) — but blast radius is bounded: self-selects real dormant users from the DB (caller can't choose targets or content), weekly idempotency key per user, 30/day cap. | Low | Not fixed. Should still get a `requireAdminOrCron`-style guard as defense in depth, consistent with `send-broadcast-email` which already has one. Not urgent given the bounded impact. |
| 3 | `send-invoice-email` | Real ownership check (`invoice.issued_by === user.id`) is present and correct — **not an auth bug**. But `invoice.notes`, `brand_name`, `recipient_name`, and line-item `description` are interpolated into the email HTML without escaping. Since the issuer already owns/controls that data, this is self-inflicted HTML injection into an email they choose to send, not a privilege escalation — but worth closing. | Low (hardening) | Not fixed. `send-user-email`'s instance of this same pattern is now fixed (see 3.1); this one remains open. |
| 4 | `send-notification-email` / `send-user-email` templates | Accent colors (`#4338CA` indigo, `#8B5CF6` violet, `#D9FF00` lime on the `'general'` type) don't match the established `#FF2DA1` pink brand accent used everywhere else in the product. | Low (branding) | Not fixed. Cosmetic; folds into the "migrate onto the modern template registry" recommendation in §1 rather than a standalone fix. |

**Verified clean, no action needed:** `auth-email-hook`, `handle-email-suppression`, `handle-email-unsubscribe` (real webhook-signature or capability-token models, all correctly scoped), `preview-transactional-email` (gated by `LOVABLE_API_KEY`), `send-broadcast-email` (already uses `requireAdminOrCron`), `notify-speed-pool-ping` / `notify-speed-session-update` (real host-or-admin ownership check, fixed template content, targets derived from real RSVP rows, not caller input), `draft-outreach-email` / `send-outreach-email` (real cron-secret-or-authenticated-user check).

---

## 4. Template coverage gap — payment-adjacent emails are on the weaker path

The modern registry (`supabase/functions/_shared/transactional-email-templates/registry.ts`) has 19 templates: `welcome`, `universe-scan-findings`, `re-engagement`, `application-confirmation`, `application-status-update`, `new-applicant-notification`, `event-registration-confirmation`, `onboarding-reminder`, `event-reminder`, `thrivefund-pledge-confirmed`, `thrivefund-campaign-funded`, `thrivefund-campaign-failed`, `event-blast`, `event-invite`, `day2-engagement`, `speed-session-recap`, `speed-session-reminder`, `speed-session-rsvp-confirmed`, `credit-chain-invite`, `curated-stage-invite`.

Notably **absent** from this list — and therefore not covered by the queue/retry/suppression/audit-log safety net — are several categories the charter explicitly lists as required test cases: **milestone approved, payment required/received, invoice, payout, review request**, and **Co-Sign requested/completed**. Invoice email currently runs through the older, direct-Resend `send-invoice-email` (ownership-checked but no suppression/audit/retry). Milestone, payment, payout, and review-request emails were not found wired to any of the 18 audited functions at all — either they aren't sent as email today, or they're triggered from a path not covered by an edge function name in this audit (worth a follow-up grep of `notifications` table inserts / DB triggers, which fire in-app notifications and, per `useSwipeActions.ts`'s comment about `on_match_created`/`notify_on_match_with_email`, sometimes email too, directly from Postgres triggers rather than an edge function).

**Recommendation:** treat "does every payment-lifecycle event have a queue-backed, suppression-checked, audited email" as its own follow-up — this is the least-covered, highest-stakes gap found in this audit, and is closely related to Phase 5/6's Stripe work.

---

## 5. Notification preferences — enforcement is inconsistent by system

- `send-transactional-email`: checks the shared `suppressed_emails` table before enqueueing (fail-closed).
- `send-user-email`: checks `notification_preferences` (`email_messages`/`email_matches`/`email_opportunities`) per category before sending — correctly implemented, and in active production use (§3.1).
- `send-notification-email`: **no preference check of any kind** — fetches an unsubscribe token to print in the footer, but never gates sending on it. This means a user who unsubscribed via the shared system could still receive email through this path. This is a reliability/compliance gap independent of the auth fix in §2a — the auth fix stops *unauthorized* senders; it doesn't add a preference check for the *legitimate* remaining call sites (`useOnboarding.tsx` welcome email, `notify-swipe`/`send-streak-warning` server-side sends). Worth a follow-up.
- `notify-speed-pool-ping` / `notify-speed-session-update`: these write to the in-app `notifications` table only (no email sent directly from these two functions), so preference-check scope doesn't apply the same way.

---

## 6. Branding / sender configuration — confirmed correct, one open question

`SENDER_DOMAIN = "notify.thrivein.io"` (technical sending subdomain) vs `FROM_DOMAIN = "kretopia.com"` (display domain) is intentional and consistent across `auth-email-hook` and `send-transactional-email`, both with explicit code comments warning not to change it without re-verifying DNS. `SITE_NAME = "Kretopia"` is correct everywhere checked (the earlier "ThriveIN" branding issue from a prior audit pass is confirmed fixed). No `thrivein.io`/`thrivein.app` fallback URLs were found in any of the 18 functions read.

**Open question, needs a manual DNS check (out of scope for this audit — requires provider dashboard access):** with two parallel sending paths — Lovable's managed API and a direct Resend account — do *both* have correct SPF/DKIM/DMARC alignment for `kretopia.com`, or only one? If only the Lovable-managed path is properly authenticated, mail sent via `send-notification-email`/`send-invoice-email`/`send-user-email`'s direct-Resend path may be landing in spam or failing DMARC even when it doesn't get suppressed — a deliverability risk independent of the auth findings above. Flagging this as a manual action item rather than guessing at DNS state.

---

## 7. Phase 4 (controlled email tests) — blocked, documented rather than skipped

The charter requested a small controlled test send (one welcome/verification email to `noe@kretopia.com`, one product-event email to `ethan@kretopia.com`). This remains blocked on two independent grounds, neither of which is a permission question:

1. **Capability**: dispatching a real transactional email requires either an authenticated session with a working `enqueue_email` RPC call through `send-transactional-email`, or a service-role JWT to invoke `process-email-queue`'s dispatcher directly. Neither is available in this session — the browser's auth session is not reliably present, and no service-role credential is held here.
2. **Policy**: the one function that could technically fire test emails at a lower privilege bar, `send-test-emails`, is itself disqualified — it unconditionally fires **8 unrelated hardcoded email categories** in one call (`welcome`, `opportunity`, `match`, `application`, `re-engagement`, `weekly-digest`, `activity-digest`, `streak-warning`) via the older `send-notification-email` path, directly violating this charter's own "do not send multiple categories without explicit test purpose" instruction, and its test payloads contain stale `thrivein.io` URLs. It also requires admin-or-cron auth this session doesn't have.

No test email was sent. `EMAIL_TEST_REPORT.md` is not being created since there is nothing real to report — creating it with placeholder/blocked content would violate the charter's own "do not claim email delivery without provider evidence" rule.

---

## 8. Summary status

| Item | Status |
|---|---|
| `send-notification-email` open relay | **Fixed** — commit `8572f0f8`, verified locally (tsc/build/tests) |
| `send-push-notification` open relay | **Fixed** — commit `1e886071`, verified locally (tsc/build/tests) |
| `send-user-email` auth gap | **Fixed 2026-08-19** — was miscategorized as dead code; has 6 real live callers. Added `requireRelationship()` ownership checks, `escapeHtml()` on all interpolated values, UUID validation on `recipientId`. |
| `send-reengagement-emails` missing cron gate | Documented, not fixed — low urgency |
| HTML-escaping gap in older templates | Documented, not fixed — recommend one shared follow-up pass |
| Off-brand colors in older templates | Documented, not fixed — folds into system consolidation |
| Payment-lifecycle email coverage gap | Documented — needs its own follow-up, ties into Phase 5/6 |
| Notification-preference enforcement gap in `send-notification-email` | Documented, not fixed |
| Dual sending-provider DNS/deliverability question | Documented — requires manual DNS/dashboard check, cannot verify from code |
| Controlled test send (Phase 4) | Blocked — capability + policy reasons documented, no email sent, no report fabricated |
