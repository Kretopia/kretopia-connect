# Mentor feedback: remediation plan

Status: internal working document, 2026-11-13. Source-level review of the repository at `main` (13f51619b). It is not a compliance assessment, a security certification or a penetration test, and it does not say Kretopia is production-ready. Production was **not** queried for this review: where a finding depends on what production actually has (applied migrations, grants), it says so and the first step is to check.

Companion documents in this folder:

| Document | What it covers |
|---|---|
| `security-review.md` | Source-level security findings, risk ratings, test plan, external audit recommendation |
| `data-protection-review.md` | Personal-data inventory, data flows, retention and deletion gaps, GDPR readiness checklist, incident-response plan template |
| `ai-agent-governance-review.md` | Agent inventory, tool and permission matrix, ingress and egress, approval and audit, action-log review process |
| `technical-design-document.md` | Architecture, data flows, security boundaries, AI governance, known limitations (internal draft) |
| `terms-and-ip-draft.md` | Draft ownership and IP explanation, draft collaboration terms outline (requires legal review) |

Earlier work this plan builds on, and does not repeat: `docs/security/SECURITY_BASELINE.md` (production catalog facts from 2026-10-19 and 20: project takeover closed, payer authority locked, transcript grants, storage, webhooks), `docs/security/RLS_TEST_PLAN.md`, `docs/security/ANON_EXECUTE_TRIAGE.md`, `docs/platform/INCIDENT_RUNBOOK.md`, `docs/platform/AUDIT_TRAIL_DESIGN.md`, `docs/platform/BACKUP_RECOVERY.md`, `docs/platform/CI_POLICY.md`.

## Summary

Much of what the mentor asked for already exists in the code: Stripe webhooks verify the raw-body signature, refuse cross-mode events and deduplicate by event id; money columns (invoice status, milestone status, wallet updates, transfers, top-ups, payment-link counters) are closed to clients; project ownership cannot be changed by a collaborator; the main agent path requires an explicit approval for every side effect and refuses unknown, disabled and locked tools; only public configuration reaches the browser.

The review found five gaps that matter most. None of them can be closed without a database migration or a change to agent behaviour, so **none is implemented here: each needs your approval** (see "Needs your approval" below).

1. **A user without a wallet row can create one with any balance** (`wallets` INSERT policy has no column restriction). Wallet balances are spendable through `wallet-transfer`.
2. **A message's receiver can rewrite it** (`messages` UPDATE policy checks only the receiver, with no column restriction), including its text and its sender.
3. **The Desk agent acts without per-action approval**: it posts AI-written messages to a project's chat, starts calls that post a join link, and edits tasks immediately. The main agent path would ask first for the same message tool.
4. **A manually recorded payment is stored exactly like a Stripe-verified one** (`status = 'paid'`), and the migration that separates them and blocks a client from inserting an already-paid invoice is marked "not applied by anyone".
5. **No self-serve account deletion or data export**, no record of which terms a user accepted, and no cookie or consent record. These are the main GDPR readiness gaps.

## Implemented now (this change)

Only changes that alter no behaviour, need no migration, no dependency and no secret:

| Item | What | Evidence / test |
|---|---|---|
| I-1 | Guard test: only allow-listed public configuration may reach the browser bundle. It scans `src/`, `public/`, `index.html` and `vite.config.ts` for non-public `import.meta.env` names, server-secret names, credential-shaped strings and any JWT whose role is not `anon`; it never prints a matched value. | `src/lib/__tests__/security/clientSecretsGuard.test.ts` (7 tests, passing) |
| I-2 | Guard test: each Stripe webhook keeps its controls in order (raw body, Stripe signature verification with its timestamp tolerance, cross-mode refusal, event-id ledger claim before acting, 4xx on a bad signature, no secret value logged). Pins existing behaviour so it cannot be dropped silently. | `src/lib/__tests__/security/stripeWebhookControls.test.ts` (17 tests, passing) |
| I-3 | Incident-response plan template (detection, containment, notification, escalation, evidence preservation, post-incident review). | `data-protection-review.md`, section 6 |
| I-4 | AI-agent action-log review process (weekly review queries, what to look for, who acts). | `ai-agent-governance-review.md`, section 7 |
| I-5 | The six documents in this folder. | this folder |

## Needs your approval (P0, not implemented)

Each of these changes data access or agent behaviour, so it was not made without you. For each one: what to approve, how to verify, how to roll back.

| # | Finding | Proposed change | Needs | Verify first |
|---|---|---|---|---|
| A-1 | `wallets` INSERT lets a user set `balance` and `credits` on their own new row (`supabase/migrations/20250930110718_*.sql`, policy "Users can insert their own wallet"; UPDATE and DELETE were revoked in `20260823223419_*`, INSERT was not). `src/components/WalletCard.tsx:33-37` creates a missing wallet from the browser, so wallet-less users exist by design. | Migration: a `BEFORE INSERT` trigger that, for the API roles, forces `balance = 0` and `credits` to the column default; the service role and `SECURITY DEFINER` functions are unaffected, so `WalletCard` keeps working. Rollback: drop the trigger. | migration | Read-only: count wallets whose balance is not explained by `wallet_topups` and `wallet_transfers`; confirm the policy exists in production. |
| A-2 | A message's receiver can rewrite it (`20250930141941_*.sql:29-31`: `USING (auth.uid() = receiver_id)`, no `WITH CHECK`, no column grant). Text, sender and receiver can all be changed. No client code updates messages today. | Migration: limit client UPDATE to the read-state columns (column-level grant, or a trigger that rejects changes to `content`, `sender_id`, `receiver_id`, attachments). Rollback: restore the grant. | migration | Read-only: confirm the policy and grants in production (the repo's migrations may not match the legacy production backend). |
| A-3 | The Desk agent (`supabase/functions/desk-agent/index.ts`) runs `send_message_to_collaborator` (posts AI-written text to `project_messages` as the user, lines 686-700), `start_video_call` (posts a join link, 779-785), `create_task`, `mark_task_done`, `schedule_reminder` and `add_credit` immediately. The tool registry marks `send_message_to_collaborator` as `requires_approval`, which the main agent path enforces. `_shared/agentAuthority.ts` documents the gap. | Agent behaviour change: route `send_message_to_collaborator` and `start_video_call` through the existing propose, approve, execute flow (`orch_actions` and `orch_approvals`, already used by this function for `remove_collaborator`), and write an `orch_actions` row for every tool it executes. Decide whether task edits stay immediate. | agent behaviour change, deploy of one function | None: source evidence is complete. |
| A-4 | Manual and provider-verified payments are indistinguishable (`confirm_invoice_paid_manually` sets `status = 'paid'`, `20260812071205_*.sql:490`). Migration `20261015100000_invoices_provider_reference.sql` adds the provider reference and blocks a client from inserting an already-paid invoice; its header says it is not applied. | Apply that reviewed migration (it changes nothing a user sees), then show "Recorded by the issuer" next to a manually recorded payment wherever "Paid" is shown to someone else. | migration, then a small UI change | Read-only: does `invoices.stripe_payment_intent_id` exist in production? |
| A-5 | The Stripe event ledger fails open: when the ledger insert fails for any reason other than a duplicate, the handlers process the event anyway (`_shared/webhookLedger.ts`, `"unrecorded"`). A transient database error during a redelivery could process an event twice. | Payment behaviour change: answer 500 on `"unrecorded"` so Stripe retries later, except where the downstream write has its own unique key. | payment behaviour change, deploy of three functions | Check which downstream writes already have unique keys (orders, top-ups). |

## Prioritised findings

Effort: S under half a day, M one to three days, L more than three days. Owners are roles, not people: **Eng** (backend engineer), **FE** (front-end engineer), **Product** (founder or product owner), **Legal** (counsel), **Privacy** (whoever acts as privacy lead or DPO), **Sec** (security reviewer).

### P0: fix before more users or money

| ID | Finding | Evidence | Remediation | Owner | Effort | Depends on | Acceptance criteria |
|---|---|---|---|---|---|---|---|
| P0-1 | Client can create a wallet with any balance | A-1 above | A-1 | Eng | S | your approval | An API-role INSERT with `balance > 0` stores 0; `WalletCard` still creates a missing wallet; test in `RLS_TEST_PLAN.md` style |
| P0-2 | Receiver can rewrite a received message | A-2 | A-2 | Eng | S | approval, production check | Receiver UPDATE of `content` or `sender_id` fails; marking read still works |
| P0-3 | Desk agent sends messages and changes shared state without approval | A-3 | A-3 | Eng | M | approval | Every Desk side effect that sends, posts or invites appears as an `orch_actions` row; message and call tools wait for approval; tests in `src/lib/__tests__/edge` |
| P0-4 | Manual payment shown as settled like a verified one; client can insert a paid invoice if 20261015100000 is not applied | A-4 | A-4 | Eng, FE | S, then S | approval, production check | API-role INSERT of a paid invoice fails; a manually recorded invoice is labelled as such to non-issuers |
| P0-5 | No self-serve deletion or export of personal data; no documented manual procedure | No function or UI found (`data-protection-review.md` §3) | Now: a documented manual procedure for access, deletion and export requests (template in `data-protection-review.md` §5). Next: P1-8. | Privacy, Eng | S | none | Procedure written and tested once on a test account; requests answered within one month |
| P0-6 | Incident response not defined for personal-data breaches | `docs/platform/INCIDENT_RUNBOOK.md` covers outages, not breach notification | Template in `data-protection-review.md` §6 (implemented now) | Privacy, Sec | S | none | Template adopted; contacts filled in; one tabletop exercise held |

### P1: within the next month

| ID | Finding | Evidence | Remediation | Owner | Effort | Depends on | Acceptance criteria |
|---|---|---|---|---|---|---|---|
| P1-1 | Webhook ledger fails open | A-5 | A-5 | Eng | S | approval | A forced ledger error answers 500 and nothing is processed |
| P1-2 | Signed-in AI functions without a per-user limit: 8 with no limiter or credit check at all, 31 more to verify | `generate-ice-breakers`, `generate-opportunity-image`, `get-onboarding-matches`, `import-suggest`, `process-partner-submission`, `route-studio-post`, `speed-icebreakers`, `weekly-recap` | Adopt `_shared/aiPerimeter.ts` `requireAiCaller` (as in `compose-magazine-article`) | Eng | M | deploys | Each AI function has a per-user limit and a test in `aiPerimeterHandlers.test.ts` |
| P1-3 | Agent run history is editable and deletable by its owner | `copilot_plans` policies allow UPDATE and DELETE (`20260502152223_*.sql:22-34`) | Append-only action log (`audit_events`, designed in `docs/platform/AUDIT_TRAIL_DESIGN.md`); stop treating `copilot_plans` as the record | Eng | M | migration, approval | Every executed agent action has an immutable row with run id, actor, target, input summary, result, status, error |
| P1-4 | Agent side effects have no idempotency key, no "outcome unknown" state and no retry bookkeeping | `_shared/executionGuard.ts` header; `docs/roadmap/kreto-execution-mvp.md` | Add per-action idempotency keys and an `outcome_unknown` status; reconcile through the existing `reconcile_stale_orch_runs` | Eng | L | P1-3 | A retried send never sends twice |
| P1-5 | Supply chain: CI runs `npm install` (lockfile not enforced), three lockfiles, no vulnerability scan, no SBOM, edge functions import floating versions (`esm.sh/...@2`) | `.github/workflows/ci.yml`; `package-lock.json`, `bun.lock`, `bun.lockb` | SBOM plan and process in `security-review.md` §5: `npm ci`, one lockfile, `npm audit` and an SBOM in CI, pinned function imports | Eng | M | approval for CI changes | CI fails on a lockfile drift and on a critical advisory; SBOM attached to each release |
| P1-6 | 25 functions return raw `error.message` to callers | grep in `security-review.md` §2 | Return `safeError` (`_shared/guard.ts`) as functions are touched | Eng | M | none | No database or provider error text in client responses |
| P1-7 | Terms acceptance is not recorded | Only `EmailSaveStep.tsx:224` ("By continuing you agree") and a marketplace checkbox (`CreateListingDialog.tsx:377`) | Record terms and privacy versions accepted at sign-up and at collaboration invitations; needs final legal text | Legal, Eng | M | legal text | Each account has the version and time of acceptance |
| P1-8 | Self-serve data export and account deletion | P0-5 | Server-side export (JSON of the user's own rows and files) and deletion with a grace period, covering storage buckets and processors | Eng, Privacy | L | P0-5 procedure | Deletion removes or anonymises every row in the inventory; export reproduces it |
| P1-9 | Privacy notice and processor list | `/privacy` exists; processors found: Stripe, Resend, Daily.co, Sentry, Lovable AI gateway (model providers behind it), Firecrawl, Google APIs, ElevenLabs, Supabase | Check the notice names every processor, purpose and transfer; sign DPAs | Legal, Privacy | M | none | Notice and DPA register match `data-protection-review.md` §2 |
| P1-10 | `user_has_project_access()` admits pending invitees | `_shared/projectAccess.ts` header | List RLS policies that call it; switch the ones on private data to an accepted-only predicate | Eng | M | migration | A pending invitee reads nothing private |
| P1-11 | Account enumeration and other public service-role functions | `SECURITY_BASELINE.md` §4 (`lookup-auth-providers`) | Review each public function's response, as listed there | Sec | M | none | Each returns only what its token entitles |

### P2: backlog

| ID | Finding | Evidence | Remediation |
|---|---|---|---|
| P2-1 | Users can insert arbitrary rows into their own `transactions` history | `20250930110718_*.sql:47-49`; displayed by `WalletCard.tsx:54`, `ThrivePay.tsx:252`; server never trusts it | Revoke client INSERT (migration) |
| P2-2 | Two meanings of "credits" | `wallets.credits` (an unused integer, 10 at sign-up, no server spend found) versus Credits (portfolio role credits, `credits` table) | Retire or rename `wallets.credits`; product copy says Credits are roles on projects (see `terms-and-ip-draft.md`) |
| P2-3 | Welcome DM from a circle sends as the room creator and is rejected by RLS | `src/pages/CircleChatView.tsx:277` | Send it from a service function or drop it; not a security hole (RLS refuses it) |
| P2-4 | Two functions still allow any origin (`public-digital-presence`, `auth-email-hook`); the other 294 use the origin allow-list in `_shared/guard.ts` `corsFor` | `security-review.md` S-15 | Move both to `corsFor`; keep bearer-only auth |
| P2-5 | Public intake tables have no size cap | `SECURITY_BASELINE.md` §1 | Rate limit or cap as planned there |
| P2-6 | Cached recording links are bearer URLs | `SECURITY_BASELINE.md` §2 | Shorten or stop caching |

## The other mentor questions

**Substack overlap.** Some overlap in mechanics, none in product. Kretopia has an editorial magazine (Spotlight › Magazine, `/magazine/:slug`, with AI-assisted composing in `compose-magazine-article`), admin-only broadcast and weekly digest emails, event hosts' emails to their own attendees (`send-event-blast`), and a newsletter sign-up table. It has no writer-owned subscriber lists, no paid subscriptions to a writer, and no publishing tool for members. Substack sells publishing and paid subscriptions to an audience; Kretopia sells proof of creative work (Passport, Credits), collaboration (Studio projects with roles, files and payments) and opportunities (Scout, Match, events). Recommendation: keep the magazine editorial and platform-run; do not add member newsletters or paid subscriptions. Position Kretopia as "where creative work gets made and credited", not "where writers publish".

**Credits, collaboration and payments.** What a client pays for is a role or a job on a project (a milestone, an invoice, a ticket), recorded with its own status. Credits are not a currency: a Credit is a record that someone did a role on a project, verified or self-reported (`credits` table, guarded by `guard_credit_verification_escalation`). The wallet holds money in a single balance for payouts and transfers between members. The risks (money laundering through transfers, sanctions screening, fraud, duplicate payments, currency mixing, reconciliation) and the proposed server-side controls are in `security-review.md` §3. No payment flow was enabled or changed.

**Ownership and IP.** The model: the project host (`projects.created_by`) owns the project and its settings; collaborators, clients and guests have roles through accepted `project_collaborators` rows; ownership cannot be taken by a collaborator (trigger `trg_guard_project_created_by`, `SECURITY_BASELINE.md`), payer authority is owner-only (M6). Draft product language that the host keeps project ownership unless agreed otherwise, and that contributors keep their pre-existing work, is in `terms-and-ip-draft.md`, marked for legal review. It was not added to the product: legal wording should not ship before review.

**VoIP (MagicJack or similar).** No concrete need found. Kretopia's calls are in-browser video and audio rooms (Daily.co: project calls, meetings, stages, speed sessions), with recordings and transcripts. Nothing in the product places calls to phone numbers, receives them, or needs a phone line. A consumer VoIP line such as MagicJack is a home phone service with no developer API suited to embedding. Recommendation: do not integrate. If a need appears (for example calling a guest who has no app), evaluate a programmable telephony API instead, with its own consent and recording rules.

**External security audit.** This review reads source code only. Before scaling up (more users, live payouts, enterprise clients), commission an external security audit and penetration test of the web app, the functions, the database policies and the payment flows. This review does not replace one (`security-review.md` §6).

## Out of scope

Building a newsletter product; any VoIP integration; changing payment providers; enabling payouts, new payment flows, external messaging or autonomous agent actions; broad schema migrations; deleting hidden or legacy code; final legal text or legal advice; certification claims (GDPR, SOC 2 or other); live penetration testing.
