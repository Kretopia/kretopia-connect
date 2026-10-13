# Gate audit + Company Experience: execution matrix (Phase 0, refreshed after PR #152)

Read-only. No code, SQL, policy, configuration, secret or data was changed to produce this file. Supersedes the 2026-10-13 version (PR #141): same table and statuses, updated for the merged security slices and for what could be read of `kretopia-app`.

## Inputs

| Short name | Document | Reference format |
|---|---|---|
| GA | `Comprehensive_Kretopia_Gate_1_Audit_EN.docx` (11 Oct 2026; static inspection; no deployed backend, no two-user test) | finding id and section, e.g. `GA SEC-06 §3` |
| CE | `Kretopia_Company_Experience_11Oct2026_v2.pdf` (39 pages; "no authenticated runtime or code audit was performed", p.34) | page, e.g. `CE p.32` |

Both files were unchanged since the first read (sizes 78,757 and 993,165 bytes). Precedence: **GA always wins over CE** (CE p.36: passing its release checks "is the launch gate, not a promise that the design is already implemented").

## Evidence kinds

- **CODE (main)** = read in `Kretopia/kretopia-connect` at `origin/main` (`c444adb7f`, PR #152 merged).
- **CODE (kretopia-app)** = read through the Lovable connector from the project `kretopia-app` (id `8bc8181d-6585-46a0-82d6-4570d2fbb82c`, last edited 2026-10-13T05:26:45Z). It is the project production edge functions are pasted into. Reading its files shows what its code says, **not** what is running.
- **RUNTIME** = none produced. The only database reachable from this session is the Lovable cloud database of Kretopia Connect: 0 public tables. No staging, no production, no two-account test. Where a status depends on production evidence it is **BLOCKED**.

## Deployment state of the security slices (this is the first thing to read)

| Slice | PR(s) | In `main` | In `kretopia-app` (code read 2026-10-13) |
|---|---|---|---|
| E `mint-meeting-token`: denied/removed refused | #142 | yes | **no**: no status check, not even the `roomSessionLimits` import; `_shared/meetingParticipantAccess.ts` is absent (404) |
| F `get-recording-link`: canonical audience, project members only, clients only when listed | #143, #149, #151, **#152** | yes | **no**: still the `project_members` branch and "any listed participant" |
| G `daily-recording-webhook`: timestamp bound | #144 | yes | not read in this pass |
| H `book-meeting`: explicit consent | #145 | yes | not read in this pass |
| I `create-meeting`: provable project/Circle; recording fails closed | #146, **#152** | yes | **no**: no context checks, `recording_enabled !== false`, fixed 4 h expiry |
| `_shared/projectAccess.ts` | (existing, 2026-10-03) | yes | **present and equivalent** (exports `requireProjectAccess`, `ProjectAccessError`, `isUuid`; filters `status = accepted`) |

Conclusion: **nothing of E to I is in effect in production**; merged is not deployed.

## Matrix

DOCUMENT ITEM | DOMAIN | SEVERITY | REQUIRED OUTCOME | CURRENT CODE EVIDENCE | RUNTIME/TEST EVIDENCE | CANONICAL RECORD/POLICY | STATUS | BLOCKER | SMALLEST SAFE NEXT ACTION
---|---|---|---|---|---|---|---|---|---
1. Workspace/company ownership (GA PROD-07 §7; CE p.31, p.32) | Security / Company | P2 | A company is a real ownership boundary: it owns jobs, projects, usage, billing | main: `20260912130000_minimal_org_workspace_layer.sql` adds `organizations`, `organization_members`, nullable `org_id` on `profiles` and `projects`; its header states no RLS references `org_id`, no UI, billing per user. `src/` has no reference to `organization_members` | none | `organizations`, `organization_members`, `projects.org_id` (reuse) | STUB | Org semantics undecided in that header | Read-only inventory of org tables' columns, policies, grants, counts; decision record |
2. Company membership and role assignment (GA PROD-07; CE p.32) | Security / Company | P1 | One owner role at launch, scoped members, removal revokes immediately | Table exists; role column, policies, any server consumer not read; no `src/` reference; `supabase/functions` not searched | none | `organization_members` | STUB | No server-enforced role check found; CE p.32 forbids role UI before enforcement | Search functions and policies for `organization_members` |
3. Project/engagement access (GA SEC-01..04, PROD-01..03 §3, §7) | Security | P1 | One strict rule: owner or accepted collaborator; pending sees only the invitation | main and kretopia-app: `_shared/projectAccess.ts` strict (`accepted`). main: `20261009090200_*` narrows `user_has_project_access()` and freezes role on accept. `userMayActOnCall` still authorises host then participant before the project; `engagements` UNIQUE(project_id) only | Migration header cites a production check on 2026-10-09 (documentary) | `projects`, `project_collaborators`, `engagements`, `user_has_project_access` | PARTIAL | Match-participant branch and call-operator exceptions; applied state of 0200 unverified | Role-matrix test of the 8 GA §6 identities |
4. Guest/client token scope, expiry, revocation (GA SEC-08, AUX-09, M3; CE p.19, p.23, p.32) | Security | P1 | Scoped, expiring, revocable; membership change revokes | main `mint-meeting-token`: denied/removed refused (slice E) but an authenticated share-token holder still becomes a permanent attendee row; no rotation. kretopia-app: slice E absent. Other token tables exist: `project_guest_links`, `guest_studio_tokens`, `video_call_guest_tokens` (scopes not read) | none | `meetings.share_token`, `project_guest_links`, `guest_studio_tokens`, `video_call_guest_tokens` | UNSAFE | SQL half and link rotation need M-C/M-D; not deployed | Deploy slice E; approve M-C |
5. RLS across tables, storage, realtime, search (GA SEC-02, SEC-12..16; CE p.32, p.36) | Security | P1 | Deny by default, tested per role | main: `20261009090000` revokes anon/authenticated EXECUTE on ~100 definer functions (meeting helpers not mentioned); `20261009090100` closes open writes; no policy inventory; realtime and search not read | none; live policies unreadable from here | per-table policies | BLOCKED | Production policies unavailable | Execute the read-only preflights (M-A B1 to B5) |
6. Public vs private file/media access (GA SEC-15, AUX-10; CE p.10, p.32) | Security | P1 | Private by default | main: public buckets `board-assets`, `campaign-media`, `email-assets`, `event-photos`, `feedback-screenshots`, `listing-images`, `location-images`, `location-photos`, `media`, `opportunities`, `outreach-media`; private `deal-memos`, `meeting-recordings`, `payment-proofs`, `product-files`, `project-files`; per-bucket policy text not read | none | `storage.buckets` / `storage.objects` | BLOCKED | Live storage policies unavailable | Read the 5 private buckets' policies |
7. Signed URL generation/expiry/revocation (GA SEC-09, SEC-10; CE p.33) | Security | P1 | Current-access check at issuance, short expiry | main `get-recording-link`: decision from canonical records; project call only for owner/collaborator/creative, accepted client only if listed, guests/pending/removed refused, lookup failure 503 (#143, #149, #151, **#152**). kretopia-app: **old code** (any listed participant, `project_members`). `createSignedUrl` in 11 other files not reviewed | none | `call_transcripts.participants`, `project_collaborators`, `meeting_participants.status` | PARTIAL | **Not deployed**; project-calls rule has no client-visible field (needs schema) | Deploy step F (checklist); schema proposal for a client-visible field |
8. Message/conversation audience (GA SEC-11, SEC-10; CE p.11, p.7) | Security | P1 | Distribution only to the current audience | `transcribe-call`/`distributeBrief` not re-read; attachments use signed URLs | none | messages, conversations, `spark_room_members` | BLOCKED | Inventory of distribution paths not done | Read `transcribe-call` distribution |
9. Exact-version approval (GA PROD-04, M2; CE p.19, p.22, p.36) | Security / Product | P1 | Approval binds content and version; a new version invalidates it | `content_approvals`: no version column; `asset_versions`, `deliverable_versions` exist, no binding | none | `content_approvals`, `asset_versions`, `deliverable_versions` | ABSENT | Needs schema | Phase 2 proposal |
10. Approval authority and anti-forgery (GA AUX-03, SEC-03; CE p.32) | Security | P1 | Only the designated reviewer decides | `content_approvals` policy text not located by name; GA says members can UPDATE | none | `content_approvals`, `music_splits`, deal memos | BLOCKED | Effective policies unreadable | Read policies and grants |
11. Agent run/action canonical state (CE p.21, p.33) | Security / Company | P2 | One canonical run/action record | Two families: `agent_*` and `orch_actions`/`orch_approvals`; `executionGuard.ts` and `agentAuthority.ts` use `orch_*` | none | `orch_actions` + `orch_approvals` | PARTIAL | Canonical family undecided; `desk-agent-watch` stays disabled (AGENTS.md) | Decision record |
12. Agent approval, idempotency, retries, reconciliation (GA REL-03, REL-05, REL-06; CE p.21, p.33, p.36) | Security | P1 | Exact approval, idempotency key, `outcome_unknown`, reconciliation | `executionGuard.ts` fails closed; header: idempotency, `outcome_unknown`, timeouts, reconciliation NOT covered | helper level only | `orch_actions`, `orch_approvals` | PARTIAL | Idempotency and outcome states absent; payment logic out of scope | Guard role-variant tests (no behaviour change) |
13. External sends, notifications, outreach (GA AUX-05; CE p.17, p.21, p.36) | Security | P2 | Review before external action | Many senders exist (`send-outreach-email`, `process-outreach-queue`, `send-broadcast-email`, `agent-send-dm`, `auto-outreach-watch`...); per-function gating not read | none | outreach queue tables | BLOCKED | Inventory not done | List each sender and its gate |
14. Payment, invoice, payout, provider truth (GA PROD-05, M4; CE p.18, p.36) | Security / Money | P1 | Manual attestation distinct from provider-confirmed | `invoice-report-bank-transfer`, `bank_transfer_reported_at`; `stripeSignature.ts` tolerance; UI/state distinction not verified | none | invoices, wallet, Stripe webhooks | PARTIAL | Payment transitions need their own approved slice | Map every writer of the paid state (docs only) |
15. Booking/calendar conflict, consent (GA REL-09, REL-10, UX-04; CE p.34) | Security / Reliability | P1 | No double booking; time zone respected; explicit consent | main `book-meeting`: recording only for `record_consent === true` (slice H); `create-meeting`: recording and transcription only for `recording_enabled === true` AND `record_consent === true` (**#152**). Overlap and time-zone logic not re-read. kretopia-app `create-meeting`: old default ON; `book-meeting` not read | none | `meetings` | PARTIAL | **Not deployed**; callers must send `record_consent` (StartMeetingDialog does not); unconditional `enable_recording: "cloud"` in 4 room creators | Review the callers (list in PR #152); consent rule for the 4 creators |
16. Daily call room, recording, transcript, guest access (GA SEC-04..10, REL-01..08, UX-02..05) | Security / Reliability | P1 | Audience-scoped tokens and stores, revocation honoured, consent explicit | main: token half fixed (E), recording link (F), webhook freshness (G), consent (H, #152). Not fixed: `is_meeting_member` and participant self-update (SQL), link rotation, replay ledger. kretopia-app: E, F absent | none | `meetings`, `meeting_participants`, transcripts, `meeting-recordings` bucket | PARTIAL | **Not deployed**; SQL half needs M-A to M-D | Deploy E, F; M-A preflight |
17. Search/retrieval/AI context permission (GA SEC-12; CE p.21, p.32) | Security | P1 | Retrieval bound to the caller and the active company | main: `20261009090000` revokes anon EXECUTE on `match_copilot_memories`, `touch_copilot_memory`; bodies and company scoping not read | documentary | copilot memory tables | BLOCKED | Live grants and bodies unavailable | Read the live definitions |
18. Service-role actor validation (GA SEC-05, SEC-04, REL-14) | Security | P1 | Every service-role function validates the actor | main: helpers `require-user.ts`, `callerAuth.ts`, `admin-guard.ts`, `projectAccess.ts`, `agentAuthority.ts`, `escrowAuth.ts`; `create-meeting` now checks `project_id` and `circle_id` (#146); `conversation_id`, `event_id` unchecked (no canonical table found); direct writes to `meetings` bypass the function check (SQL, M-E) | none | helpers above | PARTIAL | Bypass via direct insert; adoption inventory not done | M-E proposal; adoption inventory |
19. Cron/webhook secrets, signature, replay (GA REL-04, AUX-06) | Security | P2 | Secrets, signatures, bounded freshness, ledger | main: `daily-recording-webhook` timestamp window 900 s for the timestamped signature (G); raw-body signature still accepted and unbounded; no event ledger; `cron-auth.ts`; Stripe tolerance in `stripeSignature.ts` | none | secrets (never read) | PARTIAL | Not deployed; ledger absent | Deploy G; log review for the raw-body form |
20. Logging, audit receipts, outcome (GA REL-06, UX-06; CE p.22) | Security | P2 | Durable receipt per side effect | `import_audit_log`, `orch_approvals`; no general receipt | none | `orch_approvals`, `import_audit_log` | PARTIAL | No receipt table | Decision record |
21. Company workspace switcher (CE p.11, p.34) | Company | n/a | Always show the acting context | Account mode exists (`ModeThemeSync`); no company switch UI | none | `organization_members` (unused) | STUB | Rows 1-2 | None |
22. Company home / Today (CE p.14) | Company | n/a | Decisions to make, no invented activity | `BrandWorkHome.tsx` / `CreatorWorkHome.tsx` exist per account type, not company-scoped | none | existing Today sources | PARTIAL | Rows 1-3 | After rows 1-3 |
23. Company Work / rooms / ownership labels (CE p.19, p.20) | Company | n/a | Rooms point to canonical Engagement/Project | `projects` + `engagements` canonical; `org_id` nullable, unused | none | `projects`, `engagements` | PARTIAL | Engagement not mandatory (GA PROD-01) | After rows 1-3 |
24. Team / member management (CE p.32) | Company | n/a | Scoped, revocable invitations | No UI, no server enforcement | none | `organization_members` | ABSENT | Rows 1-2 | None |
25. Role-specific views and actions (CE p.32) | Company | n/a | Owner / member / guest / partner matrix | Not enforced; project roles exist (owner, collaborator, creative, client, guest) | none | `project_collaborators.role` | ABSENT | Rows 2-3 | None |
26. Company Library/Vault (CE p.19, p.31) | Company | n/a | Linking never widens access | Vault exists personal/brand; no org ownership | none | `project-files`, `asset_versions` | PARTIAL | Rows 3, 6, 7 | After rows 6-7 |
27. Company Inbox / messages (CE p.11, p.17, p.23) | Company | n/a | Company inbox; human sender named | Personal messages only | none | messages tables | ABSENT | Row 8 | None |
28. Company Calendar / bookings (CE p.7, p.19) | Company | n/a | Capacity per company | `book-meeting` and availability per user | none | `meetings` | PARTIAL | Row 15 | After row 15 |
29. Company Clients / leads (CE p.7, p.20) | Company | n/a | Leads only for agencies | `Clients` page at user level | none | client tables | PARTIAL | Row 1 | After rows 1-3 |
30. Company Money / billing (CE p.24-26, p.32, p.33) | Company | n/a | Company plan, seats, pooled quotas | Subscription per user (`profiles.subscription_tier`); caps per user (`aiLimits.ts`) | none | `profiles.subscription_tier` | ABSENT | Row 14; billing needs its own slice | None |
31. Company-level Kreto scope (CE p.21, p.25, p.33) | Company | n/a | Declared scope, approval-gated actions | Kreto per user; guard exists | none | `orch_*` | ABSENT | Rows 11-12, 17 | None |
32. Company settings, identity, governance (CE p.7-10) | Company | n/a | Public tabs, explicit publication | `profile_business` fields; `organizations` inert | none | `profile_business`, `organizations` | PARTIAL | Row 1 | After row 1 |
33. Onboarding / create / join (CE p.12, p.13) | Company | n/a | Three entry paths; domain never grants ownership | No UI to create an organization (migration header) | none | `organizations` | ABSENT | Rows 1-2, 24 | None |
34. Data migration / legacy (CE p.31, p.34) | Company | n/a | Existing data keeps working | `org_id` nullable; backfill undefined | none | `projects.org_id`, `profiles.org_id` | PARTIAL | Product decision | Backfill proposal (not run) |
35. Mobile and responsive boundaries (CE p.23) | Company | n/a | Home / Jobs / Studio / Inbox / More, same permissions | Company mobile navigation absent | none | n/a | ABSENT | Rows 21-27 | None |

## Mapping of the merged changes (no duplication, no regression)

| PR | Gate | Rows | Regression guard |
|---|---|---|---|
| #142 | GA SEC-06 token half | 4, 16 | `meetingParticipantAccess.test.ts` (11) |
| #143 | GA SEC-09 | 7, 16 | `recordingAccess.test.ts` |
| #144 | GA REL-04 | 19, 16 | `webhookFreshness.test.ts` (17) |
| #145 | GA UX-04 (booking) | 15 | `recordingConsent.test.ts` (15) |
| #146 | GA SEC-05 partial | 18 | `meetingContextAccess.test.ts` (8) |
| #149 | Owner decision 2 | 7 | project call: members only |
| #151 | Owner decision: clients | 7 | superseded for clients by #152 |
| **#152** | Corrective | 7, 15 | `recordingAccess.test.ts` (31): a client sees a project call only if listed; guest, pending, denied, removed denied; `create-meeting` recording needs `recording_enabled === true` and `record_consent === true` |

Rule to keep: a later slice must not re-widen the project-call rule (any new role or field for recordings goes through `decideRecordingAccess` and its test), and must not reintroduce a default-ON recording flag.

## Conflicts between the documents

| Topic | CE says | GA / repository shows | Wins |
|---|---|---|---|
| Revocation | Removed users and revoked links lose access immediately (p.32, p.36) | Meeting tokens ignored denied/removed; links persist as attendee rows (SEC-06, SEC-08); slice E fixes the token half, **not deployed**; SQL half open | GA: precondition for company rollout |
| Project guests | Reviewers see only assigned work (p.19, p.32) | Pending invitees had broad SQL access (SEC-02) until `20261009090200`; call-operator exceptions remain (SEC-04) | GA |
| Clients and recordings | Client reviewers see assigned work (p.19, p.32) | Rule now: a client sees a project call only if listed (#152); no client-visible field exists | GA / the owner's rule |
| Engagement | Studio carries accepted terms (p.18, p.19) | Engagement not mandatory (PROD-01) | GA |
| Approvals | Name the asset and version (p.19) | No version binding (PROD-04) | GA: no visual-only approval screen |
| Paid state | Self-reported payment is not settlement (p.18) | Manual and provider-confirmed conflated (PROD-05) | GA; CE wording is the target |
| Usage pooling | Company-pooled quotas (p.25) | Caps and subscription per user | Repository: own billing slice |
| Switch | The personal/business switch exists (p.34) | An account mode exists; a company workspace does not | Repository |
| Corpus age | n/a | GA's corpus predates parts of `main` (`accept-call-action-item` exists; `20261009*` migrations); a migration's presence is not proof it was applied | Verify per item |

## What this pass did not do

No production or staging access, no migration or policy applied, no secret read, no authenticated session. `book-meeting` and `daily-recording-webhook` in `kretopia-app` were not read. Rows marked BLOCKED are blocked by missing runtime evidence, not by a finding. Nothing here claims a gap is closed in production.
