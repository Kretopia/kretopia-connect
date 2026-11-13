# Kretopia: technical design document

> **Internal draft: not for external distribution.** Written 2026-11-13 from the repository. It names internal components and known gaps. An external version must leave out the gaps, file paths and component names, and be reviewed before sharing. It contains no secrets, credentials, project identifiers or host names, and none may be added.

## 1. System overview

Kretopia is a web application for creative careers: a public profile (the Passport) with Credits (records of roles on projects), discovery (Scout for work, Match for people, events), collaboration (Studio projects with roles, chat, tasks, files, calls and money) and an AI assistant (Kreto) that can propose and, with approval, carry out actions.

| Layer | Technology | Notes |
|---|---|---|
| Client | React, TypeScript, Vite; a progressive web app | Built and hosted through the Lovable editor; only public configuration in the bundle |
| API and data | Supabase: PostgreSQL with row-level security, authentication, storage, realtime | Two backends: the production ("legacy") project that holds user data, and a Lovable Cloud project for a few newer services (public web search, username sign-in links, Kreto's Cloud control and ledger). The client reaches the legacy backend through a fixed adapter |
| Server logic | About 320 Deno edge functions; about 100 shared modules | Deployed through a manual, approval-gated workflow |
| Payments | Stripe: Checkout, payment links, Connect payouts, webhooks | Card data never reaches Kretopia |
| Email | Transactional email provider; Gmail through a user's own connection for outreach | |
| Calls | Daily.co | Recordings stay in the provider's storage |
| AI | An AI gateway in front of several model providers; a web-fetching service; a voice service | Model ids centralised in one shared module |
| Monitoring | Sentry (masked; not configured in production at the last check), function logs, client error log table | |

## 2. Data flows

See `data-protection-review.md` §2 for the per-feature flows. In short: the browser talks to the database directly under row-level security for most reads and the user's own writes; anything that needs the service role (payments, cross-user effects, AI, email) goes through an edge function that authenticates the caller first; third parties receive only what each feature needs.

## 3. Authentication and authorisation

- **Authentication**: Supabase Auth (email and password, OAuth; usernames resolve to accounts only inside a dedicated server function that never returns the email, with atomic rate limiting). Sessions are bearer tokens in the browser's local storage; no cookies are used for API auth.
- **Database authorisation**: row-level security on every public table. Sensitive columns are protected by column-level grants and guard triggers (money, verification, ownership); see `security-review.md` §1.
- **Function authorisation**: each function validates the caller's token against the backend that owns the account (no fallback after a failure), then checks the specific permission: project access through a fail-closed helper (owner or accepted collaborator, unknown roles treated as the most restricted), admin functions through an admin check, cron functions through a shared secret, webhooks through signatures, public links through signed tokens, public endpoints through a rate-limiting perimeter.
- **Service role**: used only inside functions, never sent to the client (pinned by a test).

## 4. Project and company boundaries

- A **project** has one owner (`projects.created_by`), who cannot be replaced by a collaborator (database trigger). Collaborators join through invitations and become accepted members with a role: collaborator, creative, client or guest. Money visibility follows the role (owner, creative and collaborator see money; client and guest do not). Payer fields are owner-only.
- **Guests** reach a project through a share link or an invitation, with the most restricted role.
- **Company accounts** use the same project workspace with additional hiring actions; account mode is resolved from one shared query, not from separate profile reads.
- **Known boundary gap**: a SQL helper used by some policies admits pending invitees (`security-review.md` S-8).

## 5. Payment architecture

- **Money in**: Stripe Checkout (event tickets, marketplace orders, invoices, payment links, wallet top-ups); the browser never handles card data.
- **Confirmation**: only the webhook marks something paid, after signature, mode and duplicate checks; the client cannot write payment status. Issuers can record an off-platform payment manually; that record is currently stored like a verified one (gap A-4).
- **Wallet**: one balance per member; transfers between members through a function with amount validation, an idempotency key and daily and monthly limits; debit and credit through service-only database functions.
- **Money out**: Stripe Connect payouts, only for members whose connected account has payouts enabled.
- **Escrow and milestones**: a state machine with service-only transitions; commission transfers are idempotent.
- **What a buyer pays for**: a role or job on a project (milestone, invoice line, ticket), never a currency or a Credit.
- Risks and proposed controls: `security-review.md` §3.

## 6. AI and agent architecture

- **Doors**: the Kreto orchestrator (per-action risk tiers: automatic, requires approval, locked), the copilot planner and executor (whole-plan approval, registry-checked steps, one run per plan), the Desk agent in Studio (immediate for some tools: gap A-3), watchers that only draft proposals, and a read-only MCP server.
- **Tool registry**: every tool has a risk tier and a handler; unknown, disabled and locked tools are refused; the one card-charging tool is locked.
- **Approval**: an approved action needs an approval record by the same user with no later rejection or revocation; high-stakes collaborator and project deletion tools require a proven approval on every door.
- **Records**: runs, actions and approvals in `orch_*` tables; plan history in `copilot_plans` (editable by its owner: gap).
- **Data sent to model providers**: the user's prompt and the project context needed for it (tasks, chat excerpts, extracted facts, names, amounts for invoices). Untrusted content is wrapped with an injection-defence clause in several functions.
- **Cost**: per-user limits on many AI functions, a daily tier limit on the Desk agent, a Cloud ledger with reservations and receipts for Kreto, a quota for public web search.
- Full review: `ai-agent-governance-review.md`.

## 7. Security controls (summary)

Row-level security everywhere; column-level locks on money, verification and ownership; fail-closed project access in functions; signature-verified, mode-checked, deduplicated payment webhooks; constant-time secret comparison; SSRF guard on server-side fetches; origin allow-list for browser calls to functions; rate limits on public and many AI endpoints; masked error monitoring; guard tests for the client bundle and webhooks; git hooks that refuse SQL outside migrations and bulk staging. Details and gaps: `security-review.md`.

## 8. Monitoring and incident response

- Signals: function logs and error rates, client error log, Stripe webhook outcomes and disputes, agent action-log review (weekly), user reports.
- Runbooks: outages and rollback in `docs/platform/INCIDENT_RUNBOOK.md`; personal-data and security incidents in `data-protection-review.md` §6 (template).
- Kill switches: per-tool `enabled` flag in the agent registry; the public web search activation switch; function redeploys.
- Gap: Sentry is not configured in production; no alerting on payment reconciliation or AI spend.

## 9. Known limitations

1. A wallet row can be created from the browser with any balance (A-1).
2. A message's receiver can rewrite it (A-2).
3. The Desk agent acts without per-action approval for messages, calls and tasks (A-3).
4. Manually recorded payments look verified (A-4).
5. The payment event ledger fails open on a write error (A-5).
6. No self-serve data export or account deletion; no record of terms accepted; no cookie consent record.
7. Agent plan history can be edited by its owner; no idempotency keys on agent side effects; no single append-only audit log.
8. Some signed-in AI functions have no per-user limit.
9. Supply chain: lockfile not enforced in CI, no SBOM, no vulnerability scan, floating versions in some function imports.
10. The repository's migrations may not match the legacy production backend everywhere; production is the source of truth.
11. No external security audit or penetration test has been done.
