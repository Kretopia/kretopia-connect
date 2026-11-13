# Data protection review

Status: internal working document, 2026-11-13. A source-level inventory, not a legal assessment. It does not state that Kretopia complies with the GDPR or any other law. Table and bucket names come from the repository's migrations and code; production was not queried, and the legacy production backend may differ from the migrations in places. Verify the inventory against production before relying on it.

## 1. Personal-data inventory

"Shown to" is the widest audience in the code. "Deletion" says whether a user can remove the data themselves today.

| Category | Where it is stored | Collected from | Shown to | Leaves Kretopia to | Deletion by the user today |
|---|---|---|---|---|---|
| Account: email, password hash, sign-in metadata | authentication service (`auth.users`) | sign-up, OAuth | the user | email provider (transactional email) | No self-serve account deletion |
| Username and login links | `profiles.username`; `username_login_links` (Cloud) | sign-up | public (handle) | none | No |
| Profile and Passport: name, role, bio, location, photo, links, skills, rates | `profiles` and split tables; public view `public_profiles_safe`; bucket `avatars`, `portfolio`, `media` | the user, imports from public sources | public Passport (`/epk/:id`), search, Match | AI gateway when enriching or ranking | Edit only; no full erasure |
| Imported public footprint (sources found on the web, unverified) | Passport import tables; `import-uploads` bucket | public web search, Firecrawl, platform connections | the user until they publish | Firecrawl, AI gateway, the connected platforms | Partly (drafts are user-keyed) |
| Credits (roles on projects) and their verification | `credits`, co-sign tables | the user, collaborators | public Passport when published | none | Yes for own credits |
| Direct messages | `messages` | users | sender and receiver | email notifications (excerpts) | No |
| Project chat, tasks, notes, files, deliverables | `project_messages`, `project_tasks`, `project_notes`, `project_files`; buckets `project-files`, `board-assets` | project members | project members by role | AI gateway (Desk agent, Studio Brain extraction) | Owner deletes the project; no per-user erasure |
| Studio Brain facts and entities | `studio_facts`, `studio_entities` | AI extraction from briefs, drops and documents | project members | AI gateway | With the project |
| Kreto conversations, memory and attachments | `agent_project_context`, `thrive_memory`, Kreto attachment tables (Cloud, private originals) | the user | the user | AI gateway | Attachments: daily cleanup of expired files; memory: no user control found |
| Agent runs and approvals | `orch_runs`, `orch_actions`, `orch_approvals`, `copilot_plans`, `agent_proposals` | agents, the user | the user | none | Plans: yes (owner can delete); runs and actions: no |
| Calls: recordings and transcripts | Daily.co storage; `call_transcripts`; bucket `meeting-recordings` | call participants | host or project members (host-only for meeting, event and stage calls) | Daily.co, transcription (AI) | No; recordings purge planned (90-day placeholder) but not deployed |
| Event RSVPs, including guests without an account: name, email, check-in token | `jam_participants`, `guest_rsvps` | members and guests | host; attendee list per host setting (members who hid themselves are hidden) | email provider | Cancel RSVP; no erasure of the guest row |
| Event photos and comments | `event-photos` bucket, comment tables | attendees | public or attendees | none | Partly |
| Payments: invoices (client name and email), payment links, orders, top-ups, transfers, payouts, bank details | `invoices`, `payment_links`, `orders`, `wallet_*`, `creator_payout_methods`, `creator_payouts`; buckets `payment-proofs`, `dispute-evidence`, `deal-memos` | the user, clients, Stripe webhooks | the parties | Stripe (card data never touches Kretopia) | No (and legal retention obligations apply to accounting records) |
| Identity verification (onboarding, currently not enforced) | verification tables and functions (`verify-profile` and related) | the user | the user, admins | the verification provider, if enabled | No |
| Outreach and sponsor leads (third parties' contact data) | `sponsor_leads`, `outreach_drafts`, `user_email_settings` (Gmail connection) | public web, the user | the user | Google (Gmail send), AI gateway | Partly |
| Newsletter and unsubscribes | `newsletter_subscribers`, `email_unsubscribes` | visitors | admins | email provider | Unsubscribe only |
| Analytics and error logs | `analytics_events`, `event_analytics_events`, `client_error_logs`, Sentry (masked; not configured in production at the last check) | the app | admins | Sentry | No; no retention limit |
| Notifications | `notifications` | the system | the user | push service (VAPID) | Read state only |

Third parties that receive personal data (processors to cover with agreements): Stripe (payments, Connect payouts), Resend (transactional email), Daily.co (video, recordings), Sentry (errors, masked), the Lovable AI gateway and the model providers behind it, Firecrawl (web fetching), Google (Gmail and Calendar, when a user connects them), ElevenLabs (voice), Supabase (database, storage, functions; two projects), Lovable (hosting and editor).

## 2. Data flows

1. **Sign-up and profile.** Browser → authentication service → `profiles` (trigger creates the wallet). Passport enrichment and public-presence search send the name and links the user gives to the AI gateway and Firecrawl; results are staged as unverified until the user confirms.
2. **Public Passport.** `public_profiles_safe` (a view that leaves out private columns) → public pages, search, Match, the MCP server (read-only, the caller's own token).
3. **Messaging.** Browser → `messages` (RLS: sender must be the caller) → notification and email to the receiver.
4. **Studio projects.** Members write chat, tasks, notes and files under RLS by role; the Desk agent and Studio Brain send project text to the AI gateway; extracted facts return to `studio_facts`.
5. **Events.** Members RSVP through a database function; guests through `reserve_event_guest_rsvp` or `guest_rsvp_upsert`; a confirmation email with a pass link goes out through the email function, which re-reads event details server-side.
6. **Payments.** Browser → checkout or payment-link functions → Stripe Checkout (Kretopia never sees card data) → Stripe webhook (signature, mode and dedupe checks) → orders, invoices, wallet ledger → payouts through Stripe Connect.
7. **Calls.** Browser ↔ Daily.co; recordings stay in Daily's storage; transcripts are produced by AI and stored in `call_transcripts`.
8. **Agents.** User intent → planner (AI gateway) → proposed actions → approval (main path) → execution through functions with the service role → results recorded in `orch_*` tables.
9. **Errors and analytics.** Browser → `client_error_logs`, `analytics_events`; Sentry when configured (text and inputs masked, media blocked, no network bodies).

## 3. Retention and deletion gaps

| Gap | Evidence | Proposed rule (for Product and Legal to decide) |
|---|---|---|
| No self-serve account deletion | No function or UI found | Deletion request → 30-day grace → delete or anonymise every row in §1, storage objects and processor copies; keep accounting records for their legal period, detached from the profile |
| No self-serve data export | No function or UI found | Export of the user's own rows and files as JSON and a zip |
| Recordings have a placeholder retention and no purge running | `_shared/recordingRetention.ts`; `SECURITY_BASELINE.md` §2 | Decide a retention period, then deploy the purge |
| Analytics, error logs and intake tables grow without limit | `SECURITY_BASELINE.md` §1 | 13 months for analytics, 90 days for error logs |
| Kreto memory has no user control | `thrive_memory` | Show it, let the user delete it, and expire it |
| Guest RSVP rows (name, email) are never removed | `guest_rsvps`, `jam_participants` guest columns | Remove guest identity some months after the event |
| Third parties' data in outreach and sponsor leads | `sponsor_leads`, `outreach_drafts` | Lawful basis and retention to decide; honour objections |
| Backups | `docs/platform/BACKUP_RECOVERY.md`; two `database_export_*` buckets kept on purpose | Document backup retention; deleted data ages out of backups |

## 4. GDPR readiness checklist

Not a statement of compliance: a list of what is in place, partly in place, or missing, as far as the code shows.

| Item | State | Note |
|---|---|---|
| Privacy notice | Partly | `/privacy` page exists; check it lists every purpose, processor, transfer and retention period in §1 to §3 |
| Lawful basis per purpose | Missing (not documented) | Likely: contract (account, projects, payments, events), legitimate interest (security, fraud, product analytics, public-profile discovery: needs a balancing test), consent (marketing email, optional enrichment from the web, Gmail connection), legal obligation (accounting) |
| Record of processing activities | Missing | §1 and §2 are a starting point |
| Data processing agreements | Unknown | Needed with every processor in §1; Kretopia is itself a processor for data hosts put in projects, so a customer-facing DPA is needed for business clients |
| International transfers | Unknown | Several processors are outside the EU; check transfer mechanisms |
| Data-subject requests (access, rectification, erasure, portability, objection) | Missing as a feature | Manual procedure in §5 until P1-8 is built |
| Consent records (terms, privacy, marketing) | Missing | No stored acceptance; see remediation plan P1-7 |
| Cookies and similar technologies | Partly | No consent banner. The app stores its session in local storage (strictly necessary) and Sentry when configured; confirm nothing else sets non-essential trackers before deciding a banner is not needed |
| Security of processing | Partly | RLS on every public table; money and trust columns locked; see `security-review.md` |
| Breach notification process | Template added | §6 |
| DPIA | Missing | Recommended for: AI matching and ranking of people, public-presence search on named people, face or identity verification if it is ever enforced (biometric data is special-category data), call recording and transcription |
| Children | Unknown | Set a minimum age in the terms and check it at sign-up |
| Data minimisation in AI calls | Partly | Prompt isolation exists (`_shared/promptIsolation.ts`); see `ai-agent-governance-review.md` §3 for what is sent |

## 5. Manual data-subject request procedure (until self-serve exists)

1. Receive the request at the privacy contact address; log it with the date (one month to answer, extendable by two for complex requests).
2. Verify identity: the request must come from the account's email, or be confirmed by a sign-in.
3. Access or export: query every table in §1 by the user's id and email (including guest rows by email), list storage objects under the user's prefix, and ask processors (Stripe, Daily.co, the email provider) for what they hold. Deliver as JSON and files.
4. Erasure: delete or anonymise rows in §1; delete storage objects; ask processors to delete; keep accounting records that the law requires, detached from the profile; record what was kept and why.
5. Reply, and record the request, what was done and when. Keep the log itself for the period the law requires.

## 6. Incident-response plan template

Fill the bracketed fields before adopting it. It complements `docs/platform/INCIDENT_RUNBOOK.md` (outages and rollback) with what a personal-data or security incident needs.

### 6.1 Roles

| Role | Who | Backup |
|---|---|---|
| Incident lead (decides, owns the timeline) | [name] | [name] |
| Technical lead (contains, investigates) | [name] | [name] |
| Privacy lead (assesses risk to people, notifies the authority) | [name] | [name] |
| Communications (users, partners, press) | [name] | [name] |
| External: counsel, forensic support, the supervisory authority's contact | [contacts] | |

### 6.2 Severity

| Level | Examples | First response |
|---|---|---|
| SEV-1 | A leaked service-role key, Stripe secret or database export; unauthorised access to private messages, files, payments or identity data; money moved without authority | Immediately, any hour |
| SEV-2 | A policy or function exposing private data to the wrong signed-in users; an agent acting outside its approval; a processor reports a breach affecting us | Within 2 hours |
| SEV-3 | A vulnerability with no evidence of use; a misdirected email to one person | Next working day |

### 6.3 Detection

Sources to watch: function error rates and logs; Stripe webhook failures and disputes; the agent action-log review (`ai-agent-governance-review.md` §7); user reports; processor notifications; secret-scanning alerts; unusual database activity (bulk reads, new admin roles); the security inbox.

On a signal: open an incident record ([where]) with the time detected, the reporter and the first facts. The 72-hour clock for notifying the supervisory authority runs from when Kretopia becomes aware of a personal-data breach.

### 6.4 Containment (first hour)

- Revoke or rotate the exposed secret (names in `SECURITY_BASELINE.md` §5; never paste a value into chat, tickets or logs). A rotated service-role key needs every function redeployed.
- Disable the affected function or feature (the deploy workflow, or the function's own kill switch where one exists, such as the public web search activation switch).
- Pause payouts and agent execution if money or agent actions are involved (disable the relevant tools in `orch_tool_registry`).
- Block the abusing accounts or addresses.
- Do not delete anything that may be evidence.

### 6.5 Evidence preservation

- Export the relevant logs (functions, database, authentication, Stripe events, Daily webhooks) before they rotate.
- Snapshot the affected rows (read-only queries; record each query run).
- Record every action taken, by whom, at what time, in the incident record.
- Keep evidence access-controlled and keep it for [period].

### 6.6 Assessment and notification

- Which data, how many people, which countries, how sensitive (payment, identity, messages, special categories), whether it was encrypted, whether it was actually accessed.
- Supervisory authority: notify within 72 hours of awareness unless the breach is unlikely to result in a risk to people; if the facts are incomplete, notify with what is known and complete later. Record the reasoning whatever the decision.
- People affected: inform them without undue delay when the risk to them is high, in plain language: what happened, what data, what we did, what they can do, who to contact.
- Business clients: if Kretopia processes their data as a processor, notify them as the DPA requires.
- Processors involved: coordinate with them.
- Stripe or the card schemes, if payment data is involved.

### 6.7 Escalation

SEV-1 to the founder at once; counsel within [hours]; the privacy lead decides notification within 48 hours so the 72-hour limit can be met.

### 6.8 Recovery

Fix the root cause in a reviewed change (migration or function), redeploy, verify with a test that would have caught it, then lift the containment.

### 6.9 Post-incident review (within two weeks)

Timeline; root cause; what worked; what did not; actions with owners and dates; whether the inventory, this plan or the threat model need updating. Blameless, written, kept with the incident record.

### 6.10 Record template

```
Incident ID:
Detected (UTC):            Reported by:
Severity:                  Incident lead:
Summary:
Data and people affected:
Containment actions (time, who, what):
Evidence collected (what, where):
Notification decision (authority / people / clients / processors), with reasoning and times:
Root cause:
Fix (link to the reviewed change):
Follow-up actions (owner, date):
Closed (UTC):
```
