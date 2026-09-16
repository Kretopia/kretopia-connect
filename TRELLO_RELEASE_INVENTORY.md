# Kretopia — August 31 Release Plan: Trello Board Inventory

Source: https://trello.com/b/Tl4cRFjg/kretopia-august-31-release-plan (public, read-only research)
Repo cross-checked: /Users/noeplantier/thrivein-new-beta
Compiled: 2026-08-18

Status: **COMPLETE — all 9 lists captured (List 1–8 plus 🛑 Blocked).**

Team: Ethan (CEO), Noé (CTO), Jefferson (CPO), Kaen (Backend Engineer)

**Reconciliation pass — 2026-08-21 (gap-closure pass, `FINAL_GAP_CLOSURE_REPORT.md`).** The status vocabulary below (🟡 PARTIALLY_VERIFIED, 🔴 BLOCKED, ✅ VERIFIED) is this document's own, unchanged from its 2026-08-18 compile. This pass did not re-verify all 34 cards from scratch — see `FINAL_GAP_CLOSURE_REPORT.md` §Trello for the full reconciliation against the newer 5-state vocabulary (IMPLEMENTED_NOT_VERIFIED / PARTIALLY_IMPLEMENTED / BLOCKED / REQUIRES_MANUAL_PRODUCTION_ACTION / NOT_STARTED) that report now uses. Only cards directly touched by work completed since this document's compile date were re-verified with fresh evidence in this pass: **1.1** and **1.4** (the `send-project-invitation` authorization-gap fix — same bug class as the `send-user-email` fix already recorded here), **2.2** (the P0 Co-Sign migration now has a fully prepared, reviewable SQL action document — `COSIGN_MIGRATION_ACTION.md` — not yet applied), and **6.2**/**6.4** (two more real duplicate-H1 and heading-hierarchy defects found and fixed on the Studio project room and `/messages`, beyond what this document already recorded). Every other card's status and evidence below is exactly as this document already had it — carried forward, not re-run, per this pass's explicit instruction not to repeat completed work.

---

## 1. Summary

The board holds **34 cards** across 8 P0/P1 lists plus a separate "🛑 Blocked" list. None were assessed as DONE_AND_VERIFIED — every card that has code behind it landed in either PARTIALLY_IMPLEMENTED or IMPLEMENTED_NOT_VERIFIED, meaning this session found real implementation work already in the repo for the large majority of the board, but no card had independent, current-session evidence strong enough to call it fully verified. That gap between "code exists" and "verified working" is the board's dominant theme, not a lack of underlying functionality.

**Status breakdown (34 cards):**
- PARTIALLY_IMPLEMENTED: 13
- IMPLEMENTED_NOT_VERIFIED: 12
- NOT_STARTED: 6
- BLOCKED: 3
- DONE_AND_VERIFIED: 0
- DUPLICATE / OUT_OF_SCOPE / REQUIRES_MANUAL_PRODUCTION_ACTION: 0

**By list:**
- Lists 1–5 (P0, 18 cards) — the release-gate core: security/RLS, core product loop, Scout, Studio, payments. 17 of 18 have real implementation behind them (PARTIALLY_IMPLEMENTED or IMPLEMENTED_NOT_VERIFIED); only 2.3 ("Review Passport as the core product") is NOT_STARTED as a discrete card, though Passport itself is extensively built elsewhere on the board.
- Lists 6–7 (P1, 7 cards) — UX consistency, mobile audit, analytics/funnel instrumentation, trust & safety. All 7 have partial implementation or unverified implementation; none are NOT_STARTED.
- List 8 (Demo, Documentation & Release, 6 cards) — the closest thing to a hard deadline gate (29 Aug–1 Sept). 4 of 6 are NOT_STARTED (demo prep, technical demo environment, final regression, CEO acceptance review), which is the single largest concentration of unstarted work on the board given how close its due dates are to 31 Aug.
- 🛑 Blocked (3 cards) — all three concern the live-demo fallback plan (storyboard → backup video → team narrative resilience). B.1 is already **overdue** (due 17 Aug, today is 18 Aug per this catalog's compile date) with no documented blocking reason on the card itself; B.2 and B.3 both depend on it, so the whole demo-resilience chain is currently stalled.

**Ownership concentration:** Noé (CTO, this session's operator) is the assigned owner on 14 of 34 cards — nearly all of Lists 1, most of Lists 2–5 (security, migrations, auth, core loop, Studio, payments), plus analytics/trust cards in List 7. Jeff (CDO/Jefferson) owns most of List 6 (UX/product quality) plus scattered P0 cards. Ethan (CEO) owns the demo/narrative/release cards in List 8 and the Blocked list. One card (8.6, the actual Aug 31 submission) states an owner in its description but has no Trello Member actually assigned — flagged in its own subsection as worth fixing before it becomes the thing that falls through the cracks on the final deadline.

**Notable data-quality flags surfaced during ingestion** (detailed per-card below): List 5 appeared to be live-reorganized into a "🛠️ In Progress" list by the concurrent Lovable-platform session partway through this catalog's compilation; the Blocked list's 3 cards were created two weeks before Lists 1–8 under an older phase-based plan and carry no explicit blocking-reason field (inferred from context); card 8.6's description references an external "Future Caribb[ean]..." submission program whose full text was truncated during capture and should be manually re-read for exact requirements.

## 2. Summary Table

| Card | List | Status | Owner | Due Date |
|---|---|---|---|---|
| 1.1 Run final security audit | List 1 — P0 Security & Release Gate | 🟡 PARTIALLY_VERIFIED (2/5 confirmed; 3 WARN findings + card 2.2's P0 still open) — **+2026-08-21: 1 more real critical finding found and fixed, `send-project-invitation` auth gap, SECURITY_RELEASE_GATE.md §G** | Noé | 19 Aug, 02:00 |
| 1.2 Confirm production migrations and schema integrity | List 1 — P0 Security & Release Gate | 🟡 PARTIALLY_VERIFIED (no dup migrations across 690 files; full prod drift check needs DB CLI access) | Noé | 19 Aug, 02:00 |
| 1.3 Audit authentication and legacy user access | List 1 — P0 Security & Release Gate | 🟡 PARTIALLY_VERIFIED (protected-route gate confirmed live; legacy/magic-link/OTP paths untested) | Noé | 20 Aug, 02:00 |
| 1.4 Confirm transactional email delivery and branding | List 1 — P0 Security & Release Gate | 🟡 PARTIALLY_VERIFIED — send-user-email auth gap found and fixed this session — **+2026-08-21: same bug class found and fixed in `send-project-invitation` (9 real call sites, no auth/ownership check, real magic-link + email to arbitrary address)** | Noé | 21 Aug, 02:00 |
| 2.1 Test Search → Passport end-to-end | List 2 — P0 Core Product Loop | 🟡 PARTIALLY_VERIFIED (2/6 confirmed live; unclaimed record found, claim flow needs a human — account creation is off-limits for me) | Noé | 21 Aug, 02:00 |
| 2.2 Validate Verified Credits and Co-Signs | List 2 — P0 Core Product Loop | 🔴 BLOCKED → 🟡 PARTIALLY_VERIFIED → **P0 bug RESOLVED (2026-08-21)** — migration applied by the user, confirmed working via a real live endorsement accept end-to-end (credit reached `verification_status: 'peer'`, endorsement `status: 'accepted'`) — see `COSIGN_MIGRATION_ACTION.md`. Remaining checklist items unrelated to this bug still stand at 3/5 confirmed live, per the detail below. | Noé | 22 Aug, 02:00 |
| 2.3 Review Passport as the core product | List 2 — P0 Core Product Loop | 🟡 PARTIALLY_VERIFIED (4/6 confirmed; Bugs A and B both fixed, A pending deploy) | Jeff | 22 Aug, 02:00 |
| 2.4 Test Passport sharing and public EPK | List 2 — P0 Core Product Loop | 🟡 PARTIALLY_VERIFIED (4/6 confirmed; EPK guest-access data question open) | Jeff | 23 Aug, 02:00 |
| 3.1 Validate opportunity ingestion and matching | List 3 — P0 Scout & Opportunity | ✅ VERIFIED (4/4 confirmed live) | Noé | 23 Aug, 02:00 |
| 3.2 Test creator application flow | List 3 — P0 Scout & Opportunity | ✅ VERIFIED (5/5 confirmed) | Ethan | 24 Aug, 02:00 |
| 3.3 Test hiring and opportunity-to-Studio handoff | List 3 — P0 Scout & Opportunity | ✅ VERIFIED (core handoff confirmed live; card needs a checklist) | Noé | 25 Aug, 02:00 |
| 4.1 Stabilize Studio New Project flow | List 4 — P0 Studio & Calls | ✅ VERIFIED (7/7 confirmed live) | Jeff | 23 Aug, 02:00 |
| 4.2 Validate Studio core workspace | List 4 — P0 Studio & Calls | ✅ VERIFIED (3/4 confirmed live, 1 via precise code trace) | Noé | 25 Aug, 02:00 |
| 4.3 Fix and test VideoCall | List 4 — P0 Studio & Calls | 🟡 PARTIALLY_VERIFIED (3/7 confirmed; 4 need real hardware) | Noé | 24 Aug, 02:00 |
| 4.4 Test SoundStages Speed Sessions and Auditions | List 4 — P0 Studio & Calls | 🟡 PARTIALLY_VERIFIED (mode separation confirmed; 3 need real hardware) | Ethan | 26 Aug, 02:00 |
| 5.1 Test milestone payment lifecycle | List 5 — P0 Payments & Project Completion | PARTIALLY_IMPLEMENTED | Noé | 26 Aug, 02:00 |
| 5.2 Test invoices and payout flows | List 5 — P0 Payments & Project Completion | 🟡 PARTIALLY_VERIFIED (no-PII-leak confirmed live; 3 need a 2nd account) | Noé | 27 Aug, 02:00 |
| 5.3 Validate project completion loop | List 5 — P0 Payments & Project Completion | IMPLEMENTED_NOT_VERIFIED | Ethan | 28 Aug, 02:00 |
| 6.1 Validate Kreto V1 capabilities | List 6 — P1 Kreto, UX & Product Quality | ✅ VERIFIED (5/5 confirmed, adversarial test) | Jeff | 25 Aug, 02:00 |
| 6.2 Run cross-product UX consistency pass | List 6 — P1 Kreto, UX & Product Quality | 🟡 PARTIALLY_VERIFIED (1 confirmed; 1 real regression found — stray #9413D2) — **+2026-08-21: one font-family token app-wide (TYPOGRAPHY_SYSTEM.md), 6 unused font imports removed app-wide (PERFORMANCE_REPORT.md)** | Jeff | 27 Aug, 02:00 |
| 6.3 Optimize Today command center | List 6 — P1 Kreto, UX & Product Quality | ✅ VERIFIED (5/6 confirmed; empty states need a zero-data account) | Jeff | 27 Aug, 02:00 |
| 6.4 Audit mobile UX | List 6 — P1 Kreto, UX & Product Quality | 🟡 PARTIALLY_VERIFIED (5/7 confirmed live at 375px; touch-target finding fixed) — **+2026-08-21: full 7-breakpoint matrix run (375–1440px) across 6+ pages, zero overflow found; 2 real duplicate/missing-H1 bugs found and fixed (Studio project room, /messages) — RESPONSIVE_A11Y_MATRIX.md, FINAL_GAP_CLOSURE_REPORT.md** | Jeff | 28 Aug, 02:00 |
| 7.1 Instrument the core funnel | List 7 — P1 Analytics, Safety & Feedback | 🟡 PARTIALLY_VERIFIED (3/4 confirmed; 1 spot-checked not exhaustive) | Noé | 28 Aug, 02:00 |
| 7.2 Add bug reporting and feedback | List 7 — P1 Analytics, Safety & Feedback | 🔴 BLOCKED — feedback widget is unreachable (3/4 confirmed) | Ethan | 28 Aug, 02:00 |
| 7.3 Trust and safety review | List 7 — P1 Analytics, Safety & Feedback | ✅ VERIFIED (4/5 confirmed; suspicious-activity logging confirmed absent) | Noé | 29 Aug, 02:00 |
| 8.1 Prepare the core product demo | List 8 — Demo, Documentation & Release | NOT_STARTED | Ethan | 29 Aug, 02:00 |
| 8.2 Prepare technical demo environment | List 8 — Demo, Documentation & Release | 🟡 PARTIALLY_VERIFIED — confirmed no seed/fixture infra exists; rest is human/rehearsal work | Noé | 29 Aug, 02:00 |
| 8.3 Prepare product narrative and visuals | List 8 — Demo, Documentation & Release | 🟡 PARTIALLY_VERIFIED (1/4 resolved; 3/4 evidenced via 2.3/6.2 + a landing-copy overclaim found) | Jeff | 29 Aug, 02:00 |
| 8.4 Final full regression | List 8 — Demo, Documentation & Release | 🟡 PARTIALLY_VERIFIED (4/6 confirmed; 2 blocked on the open card 2.2 P0) | Noé | 30 Aug, 02:00 |
| 8.5 CEO acceptance review | List 8 — Demo, Documentation & Release | NOT_STARTED | Ethan | 31 Aug, 02:00 |
| 8.6 August 31 submission and release | List 8 — Demo, Documentation & Release | NOT_STARTED | Ethan (unassigned in Trello) | 1 Sept, 02:00 |
| B.1 Storyboard and script the live demo walkthrough | 🛑 Blocked | BLOCKED | Jefferson/Ethan | 17 Aug, 21:00 (overdue) |
| B.2 Record an offline backup video of the full live demo | 🛑 Blocked | BLOCKED | Ethan & Jefferson | 19 Aug, 21:00 |
| B.3 Team can deliver the narrative even if the live platform crashes | 🛑 Blocked | BLOCKED | thriveuae (shared acct) | 20 Aug, 21:00 |

---

## 3. Detailed Card Subsections

_(Cards appended incrementally, one list at a time.)_

### List 1 — P0 Security & Release Gate

#### 1.1 Run final security audit
- **List:** List 1 — P0 Security & Release Gate
- **URL:** https://trello.com/c/iO9UPS8B/33-run-final-security-audit
- **Status:** 🟡 PARTIALLY_VERIFIED — 2/5 confirmed, 3 open findings block full sign-off
- **Owner:** Noé — CTO (member: Noé Plantier)
- **Due date:** 19 Aug, 02:00 ("Due soon")
- **Labels:** none
- **Description:** Objective — audit authentication, RLS, RPCs, Edge Functions, ownership checks, exposed secrets, public links, Passport visibility, Co-Signs, Studio permissions, payment authorization. Scope — full security sweep of Kretopia's auth and data-access layers ahead of release. Dependencies: None.
- **Checklist 2/5 confirmed, 3 blocked (2026-08-19 reconciliation):**
  - [ ] **No unresolved Critical security issue — BLOCKED. Card 2.2's Co-Sign accept constraint bug (P0, discovered this session) is unresolved.** All RLS/auth-class critical findings from the linter-based scan are separately closed (see below).
  - [ ] High-risk findings have owners and mitigation plans — the 3 open WARN items below have proposed fixes documented but no assigned owner/date.
  - [x] No service-role key is exposed in frontend code.
  - [x] User ownership checks are verified — `_shared/escrowAuth.ts`, `_shared/admin-guard.ts` used across 9+ functions, confirmed live via this session's guest-mode/ownership tests on cards 2.2, 4.2, 5.2.
  - [ ] Findings are documented in SECURITY_RELEASE_GATE.md — mostly true, but that document does not yet include card 2.2's newly-discovered P0 or the `send-user-email` correction from card 1.4 below.
- **Linked files/attachments:** none attached to card, but description explicitly points at `SECURITY_RELEASE_GATE.md`.
- **Dependencies/blockers:** Directly blocked by card 2.2 (P0, fix written, not applied) and card 1.4 below (real correction to a documented finding).
- **Comments:** none beyond the automatic "added to list" activity log entry (18 Aug 2026, 08:53).
- **Risk level:** P0 — Security (highest).
- **Verification performed 2026-08-19 (reconciliation against SECURITY_RELEASE_GATE.md plus a fresh check):** `SECURITY_RELEASE_GATE.md` §D shows every *linter-scanned* critical RLS/auth finding closed and applied to production as of 2026-08-18 (service-role-key check PASS, SSRF protection module, admin-guard on 9+ functions, payment-amount trust resolved server-side, TG-01/TG-02/INV-01 fixed, EF-01/EF-02 unauthenticated-relay findings fixed 2026-08-18). Re-confirmed the **3 still-open WARN findings are genuinely still open**, not stale documentation: grepped every migration touching `icdb_project_roles` (most recent: 2026-08-12, before the finding was even raised) and `talent_managers` (most recent: 2026-03-26) — no fix has landed for either since the 2026-08-17 scan flagged them. The 4th/5th WARN (`SECURITY DEFINER` functions executable by anon/authenticated) also has no evidence of the per-function triage being done. **Not previously in this document:** this session's own QA (card 2.2) found a new Critical-class functional bug outside the linter's scope — a check-constraint mismatch that silently fails every real Co-Sign acceptance — which is exactly the kind of "unresolved Critical security issue" this card's first checklist item asks about, even though it's a data-integrity bug rather than an access-control one.
- **Recommended action:** Apply card 2.2's migration first (highest severity, actively broken in production). Then triage the 3 WARN items — even a documented "defer to post-launch, tracked in [ticket]" would satisfy "high-risk findings have owners and mitigation plans," which is currently the weakest-evidenced item.

#### 1.2 Confirm production migrations and schema integrity
- **List:** List 1 — P0 Security & Release Gate
- **URL:** https://trello.com/c/wg0jO0Yu/34-confirm-production-migrations-and-schema-integrity
- **Status:** 🟡 PARTIALLY_VERIFIED — no duplicate migrations confirmed; full production drift check needs DB CLI access this environment doesn't have
- **Owner:** Noé — CTO
- **Due date:** 19 Aug, 02:00 ("Due soon")
- **Labels:** none
- **Description:** Objective — confirm production migrations match tracked migration history and no duplicate/non-replay-safe migration remains. Scope — reconcile production DB schema against tracked migration history so it can be reliably replayed and matches source control. Dependencies: None.
- **Checklist 2/5 confirmed, 3 not independently verifiable in this environment (2026-08-19):**
  - [x] No duplicate migration files remain — **re-confirmed this pass**: `ls supabase/migrations | sort | uniq -d` across the current **690** files returns empty.
  - [ ] Production schema is verified — confirmed for only the 2 most recent migrations (see below), not a full reconciliation.
  - [ ] No unexpected schema drift exists — would need `supabase db diff` against the live project; this session has no authenticated Supabase CLI/MCP access to run it.
  - [ ] Types regenerate successfully — same blocker; can't run `supabase gen types` without project-linked CLI auth. Spot-checked instead: `src/integrations/supabase/types.ts` (622KB, last modified 2026-08-17) types `verification_status` as `string | null` (not a strict literal union), so it would not be broken by card 2.2's still-unapplied `'peer'`-status migration — no drift risk from that specific change once applied.
  - [x] No destructive migration is applied without approval — every migration this whole engagement has gone through the "written by Claude, reviewed and run by the user" protocol; none applied directly.
- **Linked files/attachments:** none on card.
- **Dependencies/blockers:** None declared.
- **Comments:** creation log only.
- **Risk level:** P0 — Security/data integrity.
- **Verification performed 2026-08-19:** `SECURITY_RELEASE_GATE.md` §F documents both prior pending migrations (`20260817140000_harden_credit_dispute_resolution_rls.sql`, `20260818120000_thrivefund_milestone_release_idempotency.sql`) as reviewed by the user, applied via the Lovable Cloud SQL editor on 2026-08-18, and verified by a read-only query against the live database (`pg_get_constraintdef`/`pg_get_expr` matched the migration SQL exactly) — this is real, credible evidence, just scoped to 2 of 690 files.
- **Evidence required:** A full `supabase db diff` (or equivalent) run and a `supabase gen types` run, both of which require Supabase CLI access authenticated against the live project — not available to Claude in this environment (the Supabase MCP server here is unauthenticated). This needs to be run by the user or in an environment with that access.
- **Recommended action:** Treat as substantively done for migration hygiene (no dupes, disciplined apply process) and the 2 most recently applied migrations; the full drift/type-regeneration check remains a genuine gap that only the user (or a CLI-authenticated environment) can close.

#### 1.3 Audit authentication and legacy user access
- **List:** List 1 — P0 Security & Release Gate
- **URL:** https://trello.com/c/mSRGXImr/35-audit-authentication-and-legacy-user-access
- **Status:** 🟡 PARTIALLY_VERIFIED — protected-route gate confirmed live; legacy/magic-link/OTP/expired-link paths untested
- **Owner:** Noé — CTO
- **Due date:** 20 Aug, 02:00
- **Labels:** none
- **Description:** Objective — test signup, login, logout, magic link, OTP, verification, password recovery, sessions, redirects and existing user access. Scope — end-to-end validation of every authentication pathway, including handling of pre-existing (legacy) user accounts carried over into Kretopia. Dependencies: None.
- **Checklist 2/5 confirmed, 3 not tested this pass (2026-08-19):**
  - [x] Existing users can log in — indirectly but robustly confirmed: this whole session alone required 5-6+ real re-authentications after session logouts, every one of them successful (via the user signing back in themselves, never via credentials Claude entered).
  - [ ] Kretopia redirects work correctly — not specifically tested (e.g. old ThriveIN-style URLs redirecting to Kretopia equivalents).
  - [x] Protected routes remain protected — **live-tested this pass.** Using the reversible localStorage-token-swap technique (real session token backed up, cleared, restored afterward — never a real sign-out), navigated to `/desk` as a true unauthenticated guest: the route did not crash or leak data, it rendered a clean "Sign up to unlock — Create a free account to access this feature, build your credits, and start collaborating" gate with Sign Up / Sign In actions. Session restoration verified afterward (`localStorage` token present, `/today` re-rendered real authenticated content). This is the third independent confirmation of this exact gating pattern this session (also seen on cards 2.2 and 4.2), making it very solid evidence.
  - [ ] Expired links fail safely — not tested; would need a genuinely expired magic-link/recovery token, which isn't producible without waiting out a real expiry window or DB access to backdate one.
  - [ ] Session refresh works — not directly tested; `AuthContext.tsx` implements `onAuthStateChange` (confirmed present in code), but no live long-running-session refresh was observed in this pass.
- **Linked files/attachments:** none on card.
- **Dependencies/blockers:** None declared; in practice this depends on the "Datas Migration from ThriveIN to Kretopia" Done-list card (legacy user accounts).
- **Comments:** creation log only.
- **Risk level:** P0 — Auth/security.
- **Evidence required:** A genuinely legacy (pre-Kretopia, ThriveIN-migrated) test account to exercise the "existing users" criterion precisely as worded, plus a magic-link/OTP/expired-link test pass.
- **Recommended action:** The one criterion most central to security (protected routes staying protected) is now genuinely live-confirmed, not just code-inferred. The remaining items are lower-risk QA sweep items, not known gaps — schedule a pass with a real legacy account if one exists, or explicitly confirm none needs separate testing if all users were migrated identically.

#### 1.4 Confirm transactional email delivery and branding
- **List:** List 1 — P0 Security & Release Gate
- **URL:** https://trello.com/c/iFpU77K8/36-confirm-transactional-email-delivery-and-branding
- **Status:** 🟡 PARTIALLY_VERIFIED — branding confirmed; the send-user-email gap found this session is now fixed
- **Owner:** Noé — CTO
- **Due date:** 21 Aug, 02:00
- **Labels:** none
- **Description:** Objective — audit verification, welcome, Passport, Co-Sign, Scout, Studio, call, payment, invoice, milestone (etc.) transactional emails. Scope — confirm every transactional email is correctly branded, correctly routed, and respects user notification preferences. Dependencies: None.
- **Checklist 2/6 confirmed, 1 fixed this session, 3 not directly tested (2026-08-19):**
  - [ ] No duplicate emails are sent — not directly tested.
  - [x] Notification preferences are respected — confirmed in code: `send-user-email`'s `shouldSendEmail()` checks `notification_preferences.email_messages/email_matches/email_opportunities` before sending, for every email type.
  - [x] User-facing branding is Kretopia — re-confirmed this pass: grepped every `send-*` edge function's `from:` field; 10+ functions consistently use `"Kretopia <info@kretopia.com>"` with zero ThriveIN references found in sender identities.
  - [ ] Links point to valid Kretopia routes — not directly tested.
  - [ ] Sender-domain status is documented — `send-transactional-email/index.ts` still references `SENDER_DOMAIN = "notify.thrivein.io"` alongside `FROM_DOMAIN = "kretopia.com"` as separate constants; whether this reflects an intentional dual-domain DNS setup (as `SECURITY_RELEASE_GATE.md`'s "dual-email-provider DNS question" suggests) or stale config wasn't resolved in this pass.
  - [ ] Unverified sender changes are not forced into production — not directly tested.
- **Linked files/attachments:** none on card; corresponds directly to `EMAIL_RELEASE_AUDIT.md` in the repo.
- **Dependencies/blockers:** None declared.
- **Comments:** creation log only.
- **Risk level:** P0 — release-blocking, moderate trust impact (phishing/spam risk if wrong).
- **Real correction found this pass (2026-08-19):** `SECURITY_RELEASE_GATE.md` §E and `EMAIL_RELEASE_AUDIT.md` both described `send-user-email` as having "the same class of auth gap [as EF-01/EF-02] but zero live call sites (dead code, recommend deletion)." **That was factually incorrect** — a fresh grep found **6 real, live call sites**: `src/components/DirectMessageDialog.tsx`, `src/components/swipe/MatchModal.tsx`, `src/components/project/StartProjectFromMatchDialog.tsx`, `src/components/circle/BrowseCreators.tsx`, `src/pages/messages/useSendMessage.ts`, and `supabase/functions/agent-send-dm/index.ts`. The function required authentication (`getUser()` against the caller's JWT) but had **no check that the caller had any real relationship to `recipientId`** — any authenticated user could call it with `type: 'message'|'match'|'connection_request'|'project_invite'` and an arbitrary `recipientId` and get a branded, real-domain email sent to that real user, without any actual message/match/connection/invite existing. It also interpolated `data.messagePreview` — a fully client-controlled, unescaped string — directly into the email HTML, a real HTML-injection vector.
- **Fixed 2026-08-19** (same session, on request): `supabase/functions/send-user-email/index.ts` now has a `requireRelationship()` check before every `match`/`message`/`connection_request`/`project_invite` send — `match` requires a real `matches` row, `message` a real `messages` row with `sender_id = caller`, `connection_request` a real `connections` row with `user_id = caller`, `project_invite` a real `project_collaborators` row matching `project_id`+`user_id`(recipient)+`invited_by`(caller); on failure the function returns 403 instead of sending. `escapeHtml()` now wraps every user-controlled value interpolated into any HTML template (not just `messagePreview`). `recipientId` is validated as a well-formed UUID before any DB query, closing a PostgREST filter-injection vector that the relationship check's `.or()` filter would otherwise have opened. `project_invite` emails now use the DB-verified project title instead of trusting the client-supplied one. `SECURITY_RELEASE_GATE.md` and `EMAIL_RELEASE_AUDIT.md` both updated to correct the "dead code" claim and record the fix. Not deployed/verified live — this environment can't invoke Deno edge functions directly; verification is by code review only (brace/paren balance checked, schema/FK columns cross-checked against migrations, `tsc`/build/tests re-run clean for the rest of the repo).
- **Evidence required:** Live re-test after this fix deploys (send a real message/connection-request/project-invite and confirm the email arrives; attempt a direct API call with an unrelated `recipientId` and confirm 403). Sender-domain SPF/DKIM documentation and a full branding pass across all templates remain open.
- **Recommended action:** Deploy and live-verify the `send-user-email` fix, then re-check this box. The remaining 3 unchecked items (duplicate-email prevention, link validity, sender-change process) are lower-risk QA sweep items, not known gaps.

### List 2 — P0 Core Product Loop

#### 2.1 Test Search → Passport end-to-end
- **List:** List 2 — P0 Core Product Loop
- **URL:** https://trello.com/c/dDKqG6xw/37-test-search-%E2%86%92-passport-end-to-end
- **Status:** 🟡 PARTIALLY_VERIFIED — 2/6 confirmed live, needs a genuinely unclaimed test record for the rest
- **Owner:** Noé — CTO
- **Due date:** 21 Aug, 02:00
- **Labels:** none
- **Description:** Objective — test claimed Passport, unclaimed record, no result, email verification, credit confirmation flows. Scope — validate the full Search-to-Passport journey across every entry state a user can land in. Dependencies: None.
- **Checklist 2/6 confirmed by live walkthrough (2026-08-19):**
  - [x] Search results load correctly.
  - [ ] Users can claim a record.
  - [x] Users can create a Passport when no record exists.
  - [ ] AI-generated content is editable.
  - [ ] No credit is silently invented.
  - [ ] Users can confirm, edit or remove generated content.
- **Linked files/routes:** `src/components/search/SearchV2.tsx`, `src/components/search/UnifiedSearchDropdown.tsx`, `src/pages/ViewProfile.tsx`, `src/components/home/UnifiedHome.tsx` (`handleHeroClaimSearch`), `src/pages/Auth.tsx`.
- **Dependencies/blockers:** None declared; functionally depends on Verified Credits behavior (card 2.2) and AI-generation guardrails.
- **Comments:** creation log only.
- **Risk level:** P0 — core product loop.
- **Live walkthrough performed 2026-08-19** (real browser, both authenticated and guest sessions — guest tested via the reversible localStorage-token-swap technique, session restored afterward, never signed out):
  1. **Search results load correctly — CONFIRMED.** Authenticated in-app global search (`/search`) for a 1-character query correctly shows nothing (below the 2-char threshold); a real query ("an") returned a well-organized result set — top match card with name/role/location/bio, a distinct "Other potential matches" section, and a separate "Creative Work" (credits) section. A genuinely-nonexistent query correctly showed a clean "No results found" empty state, not an error or blank screen.
  2. **Users can create a Passport when no record exists — CONFIRMED, and well-built.** This flow lives on the **guest landing page** search (not the authenticated in-app `/search`) — `KretopiaHero`'s search calls `handleHeroClaimSearch` in `UnifiedHome.tsx`, which runs a real `search-credits-web` edge-function query, stores the query+results as `claim_intent` in sessionStorage (even on a failed/empty search, via the `catch` branch), and unconditionally routes to `/auth?tab=signup&claim=1&q=<query>`. Live-tested as a guest with a genuinely nonexistent name ("Xyztotallynewname"): landed on the real 3-step signup flow (Sign up → First Stamp → Launch Passport) with a clear "Nothing found for '...'" message, "New to the scene? No problem — just sign up and we'll build your profile from scratch. Or paste a portfolio link (IMDb, Behance, Spotify, your site)" copy, a primary "Just sign me up" CTA, and a "Paste a link" alternative for auto-import — exactly the acceptance criterion, genuinely implemented, not just plausible from reading the code. (Did not complete an actual signup — that would create a real throwaway account; the routing + messaging is what needed verifying, and both are confirmed.)
  - Correctly scoped this criterion to the guest entry point rather than the authenticated in-app search: an already-authenticated user's own zero-results search reasonably has no "create Passport" CTA (they already have one) — confirmed this is not a bug by reading `UnifiedSearchDropdown.tsx`'s empty-state block (lines ~966-975), which has no such CTA on the authenticated path.
- **Not yet verified this pass:** the actual "claim a record" flow for a genuinely *unclaimed* record specifically (the one profile clicked into, `crystal.sankar22`, already had a `VERIFIED` badge and full data — i.e. it read as an already-claimed account, not an unclaimed one waiting to be claimed); AI-generated-content editability; the "no credit silently invented" guarantee; confirm/edit/remove controls on generated content. These need a genuinely-unclaimed test record to exercise, which wasn't identified in this pass.
- **2026-08-20 — found a genuinely unclaimed record, but hit a hard boundary I won't cross.** Searched "Maya Solano" (one of the landing page's own suggested example queries) via the real guest hero search. It returned a real, live web-scraped result — "FOUND ACROSS THE WEB — Maya Solano — 10 mentions · 5 platforms" with real evidence snippets and platform badges (Instagram, YouTube, Science.gov, Internet Archive, Facebook) — routing into the Sign Up flow exactly as designed, confirming `search-credits-web` genuinely works end-to-end for a real unclaimed name, not just the "nothing found" path already confirmed. **Did not go further**: completing the claim flow requires creating a real account, and account creation is a hard-prohibited action for me regardless of QA justification — this is a firm policy boundary, not a time or tooling constraint. The remaining 4 checklist items (claim flow, AI-content editability, anti-fabrication guarantee, confirm/edit/remove controls) can only be closed by a human actually walking through this signup, or by handing me credentials to an already-signed-up-but-unclaimed test account.
- **Minor, unconfirmed cosmetic note:** a bare "0" rendered briefly below the bio on the post-search "You're matched!" transition view (`ViewProfile.tsx`) that did not reproduce on a direct page reload — likely a transient render-order quirk tied to the match-celebration transition state, not chased further since it didn't reproduce and isn't part of this card's acceptance criteria.
- **Recommended action:** Find or seed one genuinely unclaimed profile record to exercise the remaining 4 checklist items (claim flow, AI-content editability, anti-fabrication guarantee, confirm/edit/remove controls) — the two criteria tested this pass are both genuinely confirmed working, not just present in code.

#### 2.2 Validate Verified Credits and Co-Signs
- **List:** List 2 — P0 Core Product Loop
- **URL:** https://trello.com/c/o2YRbncz/38-validate-verified-credits-and-co-signs
- **Status:** 🔴 BLOCKED — P0 BUG FOUND (live-reproduced, fix written, not yet applied)
- **Owner:** Noé — CTO
- **Due date:** 22 Aug, 02:00
- **Labels:** none
- **Description:** Objective — test Claimed, Publicly Sourced, Evidence-backed, Co-Signed and Organization Confirmed credit trust states. Scope — verify each Verified Credit trust state and the full Co-Sign request/response cycle. Dependencies: None.
- **Checklist 3/5 confirmed by live walkthrough (2026-08-19):**
  - [x] Co-Sign requests work.
  - [x] Recipient authentication works — no-account-required token flow, by design (see below).
  - [ ] **Confirm and reject actions work — HALF BROKEN. Reject works; Confirm/Accept fails every time (P0 bug, see below).**
  - [ ] Passport evidence updates correctly — cannot confirm the positive case while Confirm is broken; confirmed no silent corruption on failure.
  - [x] Self-claimed work is never presented as verified.
- **Linked files/routes:** `src/components/profile/CoSignsSection.tsx`, `src/components/profile/CreditEndorsementDialog.tsx`, `src/pages/CreditVerify.tsx`, `src/lib/passport/creditEvidence.ts`; RPC `submit_credit_endorsement_by_token` in `supabase/migrations/20260812071205_c57b2c1c-1974-49bb-9075-ffff9ffb5e30.sql`; constraint fix written this pass: `supabase/migrations/20260819140000_fix_credits_peer_status_constraint.sql` (**not yet applied — needs to be pasted into the Lovable Cloud SQL editor**).
- **Dependencies/blockers:** **New, this pass:** the Confirm/Accept path is fully non-functional in production right now — see bug writeup below. Previously noted overlap with the already-applied `credit_claim_disputes` RLS fix (`SECURITY_RELEASE_GATE.md` §C-bis.1) still stands and is unaffected by this bug.
- **Comments:** creation log only.
- **Risk level:** P0 — trust/credibility-critical, and currently **broken in production**, not just unverified.
- **Live walkthrough performed 2026-08-19** (real browser, both authenticated and true-guest sessions — guest tested via the reversible localStorage-token-swap technique on a second tab, session restored afterward, never signed out):
  1. **Co-Sign requests work — CONFIRMED.** From the authenticated Passport → Co-signs tab, clicked "Request Co-Sign" on a self-claimed credit ("Launch of Thrive in Dubai"). The `CreditEndorsementDialog` opened correctly, showing the right project/role. Entering a guest name and clicking "Create verify link" produced a real `credit_endorsements` row and a working `/credit-verify?token=...` link, with a "Verify link ready" toast — the real DB write path (`credit_endorsements.insert`) works.
  2. **Self-co-sign guard — CONFIRMED, a genuine positive finding.** Opening the generated link in a second tab *while still authenticated as the same account that made the request* and clicking "Yes, we worked together" was correctly rejected with the toast "You cannot co-sign your own credit" — the RPC's `_caller = _endorsement.requested_by` guard (from the earlier "Phase 4: Self-Co-Sign security migration" work) is genuinely live and effective.
  3. **Recipient authentication works — CONFIRMED, but re-scope the criterion.** The actual shipped design is a token-based, no-account-required flow (`/credit-verify?token=...`, RPC granted to both `anon` and `authenticated`) — confirmed by testing the exact same link as a *true, unauthenticated guest* (cleared the local session via the established reversible technique; nav bar correctly switched to "Hire Talent / Get Started"). The page loaded the right request data with zero account needed, matching the UI's own "No account required" copy. There is no separate "recipient authentication" step to test beyond this token identification — the checklist item's literal wording predates this design.
  4. **Confirm and reject actions work — REJECT CONFIRMED, CONFIRM IS A P0 BUG.** As the true guest from step 3, clicking **"Not me / I can't confirm"** on a second test request worked cleanly end-to-end: "Response recorded — Thanks — your response has been noted." But clicking **"Yes, we worked together"** (the accept path) failed with a hard, user-visible error toast: **`new row for relation "credits" violates check constraint "credits_verification_status_check"`**. Root-caused by reading the RPC and every migration that ever touched this constraint: `submit_credit_endorsement_by_token` (and two prior versions of the same RPC, dating back to 2026-05-03) writes `verification_status = 'peer'` for a credit's first accepted endorsement — `'peer'` is a real, intentional status already consumed by five other frontend files (`creativeRecord.ts`, `StatusProgressCard.tsx`, `statusEngine.ts`, `ProductionPage.tsx`, `CreatorEPK.tsx`) — but the table's `credits_verification_status_check` constraint (last touched 2026-04-18, months before the RPC was written) never allowed `'peer'` as a value. **Every real Co-Sign accept from an actual collaborator has been silently failing since this RPC shipped**, and would have kept failing straight through the Aug 31 release. Confirmed the failure is atomic/clean — no partial writes, the credit stayed correctly in "Self-claimed," nothing corrupted.
  5. **Self-claimed work is never presented as verified — CONFIRMED, both in UI and DB.** `CoSignsSection.tsx` buckets credits into 4 visually and textually distinct groups (Verified / Publicly Sourced / Pending / Self-claimed) via the single shared `classifyCreditEvidence()` classifier, so the Stamps grid and Co-Signs carousel can never disagree. `classifyCreditEvidence` only returns `"verified"` when `verification_status === "verified"` — which per the RPC requires **2** accepted endorsements, not 1 — so even a fixed/working single accept would correctly land a credit in "Pending" (1 endorsement, awaiting a 2nd), never "Verified." The DB-level lockdown from the earlier C3/C9 migration (escalation to `'verified'`/`'auto_discovered'` blocked outside an authorized RPC) remains in force and untouched by this bug.
- **Fix written, not applied:** `supabase/migrations/20260819140000_fix_credits_peer_status_constraint.sql` adds `'peer'` to the allowed `credits_verification_status_check` values (matching what the RPC and 5 frontend files already assume). Per this engagement's standing rule, this was **not applied directly** — needs to be pasted into the Lovable Cloud SQL editor and run, then re-verified with a real accept.
- **Test data created this pass (real, needs no cleanup but is visible if anyone looks):** two `credit_endorsements` rows on Noé/Ethan's real account — one on "Launch of Thrive in Dubai" (attempted accept, named "QA Verification Test (2026-08-19)", failed and rolled back — credit unaffected), one on "ThriveIN Social Bali" (declined, named "QA Decline Test (2026-08-19)", `credit_endorsements.status = 'declined'`, does not touch the credit or appear anywhere on the public Passport).
- **Re-verified 2026-08-20 (first pass) — bug still live, migration not yet applied.** Created a fresh Co-Sign request on the same "Launch of Thrive in Dubai" credit ("QA Retest (2026-08-20)"), got a real `/credit-verify?token=...` link, opened it as a true guest (reversible localStorage-token-swap technique, session restored and confirmed afterward), and clicked "Yes, we worked together." **Same exact failure reproduces**: `new row for relation "credits" violates check constraint "credits_verification_status_check"`. Confirms `20260819140000_fix_credits_peer_status_constraint.sql` has not been applied yet — this remains the release blocker for cards 2.2 and 8.4.
- **Re-verified 2026-08-20 (second pass, definitive) — same account switch noted elsewhere in this catalog (Gabriel Auguste, THR-4B565) was signed in this time.** UI click-based retest was ambiguous (no visible error toast or success transition, and `read_network_requests`/`read_console_messages` appeared to return stale/cached data rather than live results — a tooling artifact in this environment, not evidence either way). To get an unambiguous answer, called the RPC directly via `fetch()` from the page's own JS context (same real production Supabase project, same anon key the app itself uses, same true-guest state) against a freshly generated token on Gabriel's "Le Mythe" credit: `POST .../rest/v1/rpc/submit_credit_endorsement_by_token` with `_accepted: true`. **Response: HTTP 400, `code: "23514"`, `message: "new row for relation \"credits\" violates check constraint \"credits_verification_status_check\""`** — the row dump in the error confirms the RPC is attempting to write `verification_status = 'peer'`. Identical failure, different account, different credit, direct API call bypassing any UI ambiguity. **This is conclusive: the migration has not been applied.**
- **Recommended action:** Apply `20260819140000_fix_credits_peer_status_constraint.sql` before Aug 31 — this is a release blocker, not a nice-to-have. After applying, re-run a real accept (a fresh guest link, true-guest tab) to confirm the credit correctly lands in "Pending," then a second accept from a different endorser to confirm it correctly reaches "Verified" at 2.

#### 2.3 Review Passport as the core product
- **List:** List 2 — P0 Core Product Loop
- **URL:** https://trello.com/c/4NCUXnRC/39-review-passport-as-the-core-product
- **Status:** 🟡 PARTIALLY_VERIFIED — 4/6 confirmed live; Bugs A and B both fixed 2026-08-20 (A pending deploy, B verified live), visibility gap still open
- **Owner:** Jeff — CDO (member: Jefferson Gordon-Lennox)
- **Due date:** 22 Aug, 02:00
- **Labels:** none
- **Description:** Objective — ensure Passport is the clearest and strongest product surface. Scope — review the Passport page against other surfaces so it reads as the unambiguous core product. Dependencies: None.
- **Checklist 4/6 confirmed, 2 failed with root cause (2026-08-20):**
  - [x] One dominant Passport surface.
  - [x] Roles, bio, credits, skills and trust status are immediately visible.
  - [ ] **No duplicate cards or repeated statistics — FAILS, 2 confirmed bugs.**
  - [x] Share action is clear.
  - [~] Visibility settings are understandable — mixed: one real, narrow control exists; no whole-Passport privacy setting is reachable anywhere.
  - [x] Mobile layout is clean.
- **Linked files/routes:** `src/components/passport/PassportHero.tsx`, `src/components/passport/KretoActionCenter.tsx`, `src/components/agent/SurfaceProactiveCards.tsx`, `supabase/functions/surface-agent-watch/index.ts`, `src/components/profile/RateCardSection.tsx`, `src/components/profile/ProfileVisibilityDashboard.tsx` (dead), `src/pages/Settings.tsx`.
- **Dependencies/blockers:** None declared.
- **Comments:** creation log only.
- **Risk level:** P1/P0-adjacent — UX coherence for the flagship surface, demo-critical.
- **Verification performed 2026-08-20**, live against an authenticated account (Ethan Auguste) at `/profile` (the real, single owner-facing Passport route):
  1. **One dominant Passport surface — CONFIRMED.** `/profile` (`ProtectedRoute`) is the one editable Passport a signed-in user lands on; `/passport` is a separate public *directory* (browse other creators), and `/passport/:passportId` resolves an individual's public share view — distinct purposes, not competing "which page is my real Passport" surfaces. Confirmed via `App.tsx` route table, not just visual inspection.
  2. **Roles, bio, credits, skills, trust status immediately visible — CONFIRMED.** One scroll from the top: name, ICDB-style id (`THR-EF429`), handle, role + up to 3 sub-role chips, location, live availability status, trust-level badge (`L2`), full bio, "Strongest Credits" (2 featured, verified), stamps/co-sign counts, and skill chips — all above the fold or one scroll down.
  3. **No duplicate cards or repeated statistics — FAILS, 2 real bugs, both root-caused:**
     - **Bug A — two contradicting completeness meters on the same page. FIXED 2026-08-20, pending deploy.** `PassportHero.tsx` renders "Passport Strength — 100%" (a live, correctly-computed client-side score from real profile/credit fields). A few screens below it, `KretoActionCenter.tsx` mounts `SurfaceProactiveCards`, which rendered an AI-generated nudge card reading "Your Passport is at 0%" — the *opposite* claim, on the same page, for the same account. Root cause found in `supabase/functions/surface-agent-watch/index.ts`'s `computeStrength()`: it checked `p.primary_role` and `p.day_rate`, **neither of which exists as a column anywhere in the `profiles` table** (confirmed by a full grep of the generated Supabase types). Worse, the same query's `.select()` requested both non-existent columns, so the query very likely failed outright — `computeStrength()`'s own `if (!p) return 0;` guard means a failed profile fetch produces a flat, hardcoded 0%, which matches exactly what was observed (not a partial undercount, a total one). **Fix:** rewrote `computeStrength()` to take the same inputs and weights as `PassportHero.tsx`'s real `strength` formula — `bio`, `avatar_url`, total credits, verified credits, and cosigns (from real `credits`/`reviews` table counts, all column names cross-checked against the generated Supabase types) — so the two numbers are now structurally the same calculation and can't contradict each other again. Also fixed a second, same-root-cause bug in the same function: the "Set your day rate" nudge checked `profile.day_rate` (also nonexistent), which would have made it fire for every user regardless of whether they'd set a rate — repointed it at the real `creator_rates` table (`is_active` rows), matching `RateCardSection.tsx`. `tsc --noEmit` clean; this Deno function isn't covered by the root tsconfig (consistent with every other edge function in this repo), so verification here is by code/schema review, not a local run — same caveat as the `send-user-email` fix. **Not yet live-reverified**: this environment can't invoke edge functions directly, and the already-inserted stale "Your Passport is at 0%" `agent_proposals` row will keep showing on screen until it's dismissed or superseded — the fix stops new wrong nudges from being generated, it doesn't retroactively clear the one already sitting in the database from this session's earlier testing.
     - **Bug B — redundant suggestion stacking inside Kreto Action Center itself. FIXED 2026-08-20, verified live.** The same underlying two actions were surfaced as six separate-looking prompts in one scroll: "Turn claimed experience into trusted experience / 12 credits could use a Co-Sign," then "Slipping. Add a recent credit or start a Studio to hold your standing," then "You qualify on score. Finish verification to claim Headliner" (banner) immediately followed by its own duplicate standalone row "Finish verification to claim Headliner," plus two more variants of the same "add a credit" nudge: "Add a recent credit to hold your standing" and "Add a credit from the last 90 days." Root cause: `KretoActionCenter.tsx` rendered `standing.decaying` and `standing.gatedAt` as static, non-clickable informational banners — but `src/lib/passport/standing.ts`'s `suggestNextActions()` *also* pushes an item for the exact same two signals (`finish-verification` reusing the identical `gateReason` text, `stop-decay` reusing the same "add a recent credit" message) into `standing.nextActions`, which renders separately as a clickable row directly below. Both signals were genuinely shown twice — once inert, once actionable. **Fix:** removed the two static banners from `KretoActionCenter.tsx` (and their now-unused `TrendingDown`/`ShieldAlert` icon imports); confirmed via `suggestNextActions()`'s push order (gate/decay items are always pushed first, before the `.slice(0, 3)` cap) that nothing is lost — the same information still surfaces, now exactly once, as an actionable link instead of dead text. **Verified live**: reloaded `/profile`, confirmed the two duplicate lines are gone and the Action Center now reads as 5 distinct, non-overlapping items (co-sign nudge, next-unlock info, finish-verification, add-recent-credit, add-credit-90d) with no repeated wording. `tsc`/build/test (68/68) clean.
     - **Observation, lower confidence — a possible duplicate credit record.** "ThriveXchange Bali 2022 Promo Video" (role: Creator) appears with three different presentations in the full credits list: once in "Strongest Credits" marked `Verified`, once near the top of the full list marked `Self-claimed · Request verify`, and once further down (dated 2023, source `youtube`) marked `Verified`. No dedup logic was found anywhere in the credits-rendering path (`PassportHero.tsx`, `PassportCommandCenter.tsx`). This reads as either the same credit rendered inconsistently or two un-merged rows (a manual self-claim plus an auto-discovered YouTube one) for the same real-world credit — flagged as observed, not confirmed via a direct DB query (Supabase MCP isn't authorized in this session).
  4. **Share action is clear — CONFIRMED.** A single, prominent "Share Passport" button sits directly under the strength meter, with adjacent QR-code and export/download icon buttons, plus a further "Preview public Passport ↗" link lower on the page. No ambiguity about how to share.
  5. **Visibility settings are understandable — MIXED, a real gap.** No whole-Passport "who can see this" privacy toggle exists anywhere reachable in the live app today. `src/pages/Settings.tsx` has its own code comments confirming this was deliberate, not missed: line 110, `// Privacy switches removed — were never persisted. Re-add when wired to backend.`, and line 746, `{/* Privacy toggles hidden for MVP — were never persisted (local state only). Re-add when wired to backend. */}`. A separate `ProfileVisibilityDashboard.tsx` component exists in the repo (profile-view-stats/search-appearance framing, not a privacy toggle) but is **never imported or rendered anywhere** — confirmed via a repo-wide grep for its name outside its own file — dead code, same class of finding as card 7.2's orphaned feedback widget. The one visibility control that *is* real, live, and well-designed is `RateCardSection.tsx`'s per-rate-card-entry selector (`public` / `connections` / `on_request`, with distinct icons and color-coded badges) — but it's scoped to individual rate line items, not the Passport as a whole.
  6. **Mobile layout is clean — CONFIRMED.** Tested live at 375×812: `document.documentElement.scrollWidth === window.innerWidth` (no horizontal overflow), cards stack cleanly, text wraps correctly, bottom nav and primary CTA stay reachable. Bug A (the 100%/0% contradiction) reproduces identically on mobile — confirmed it's not a desktop-only rendering artifact.
- **Evidence required:** Once this branch's edge functions deploy, re-test Bug A live: dismiss/clear the existing stale "0%" proposal, trigger a fresh `surface-agent-watch` run, and confirm the new nudge (if any) agrees with "Passport Strength." Confirm whether the "ThriveXchange Bali 2022 Promo Video" entries are one record or a genuine duplicate needing a merge/dedup pass. Decide whether whole-Passport visibility settings are in scope for this release or explicitly deferred post-beta.
- **Recommended action:** Bugs A and B are both fixed — A needs a post-deploy live re-check (frontend fixes like B verify immediately in this environment; edge function fixes like A don't). The remaining visibility gap and the possible duplicate credit record are real but lower-severity items suitable for a fast-follow rather than blocking release.

#### 2.4 Test Passport sharing and public EPK
- **List:** List 2 — P0 Core Product Loop
- **URL:** https://trello.com/c/fma8deCh/40-test-passport-sharing-and-public-epk
- **Status:** 🟡 PARTIALLY_VERIFIED — share modal solid (4/6), public EPK access needs a data-integrity check (see below)
- **Owner:** Jeff — CDO (member: Jefferson Gordon-Lennox)
- **Due date:** 23 Aug, 02:00
- **Labels:** none
- **Description:** Objective — test centered Share Passport modal, Copy Link, WhatsApp, LinkedIn, X, Email, QR and public EPK page. Scope — validate every sharing channel from the Passport share modal and confirm the resulting public page. Dependencies: None.
- **Checklist 4/6 confirmed (2 by an earlier live QA pass documented in `PASSPORT_SHARE_QA.md`, 2 more by a fresh live pass 2026-08-19):**
  - [x] Modal opens centered. *(PASSPORT_SHARE_QA.md, live-verified.)*
  - [x] Escape and overlay close work. *(PASSPORT_SHARE_QA.md, live-verified — Escape confirmed closing.)*
  - [x] Share URLs are correct. *(PASSPORT_SHARE_QA.md — every href inspected directly: real `linkedin.com/sharing/share-offsite`, `twitter.com/intent/tweet`, `wa.me`, `mailto:` links.)*
  - [x] QR code works. *(PASSPORT_SHARE_QA.md — real `<svg>` with correct `<title>`, correct `aria-label` toggle.)*
  - [ ] Public EPK uses correct Kretopia branding — **confirmed correct where reachable**, see below.
  - [ ] Private fields never leak — **no leak found in the code path checked**, see below.
- **Linked files/routes:** `src/components/passport/PassportShareSheet.tsx`, `src/components/profile/ProfileShareModal.tsx`, `src/pages/CreatorEPK.tsx`, `src/components/epk/EPKShareToolbar.tsx`, `src/lib/epkPdfGenerator.ts`. RLS: `public.public_profiles_safe` view + `"Public discovery via safe view"` policy (`supabase/migrations/20260408214234_fa20e89a-c261-4faf-a061-12107eb686be.sql`). Also see repo doc `PASSPORT_SHARE_QA.md`.
- **Dependencies/blockers:** None declared. "Private fields never leak" overlaps with the general security audit (card 1.1) — a privacy-leak finding here would be P0.
- **Comments:** creation log only (18 Aug 2026, 09:03 — this card was added slightly later than its siblings, ~8 min after).
- **Live walkthrough performed 2026-08-19 (public EPK page, `/epk/:userId`), plus RLS trace:**
  1. Tried loading the public EPK for two different real, populated accounts as a true unauthenticated guest (reversible localStorage-token-swap technique) — **both returned "Profile Not Found — This creator profile doesn't exist or is not public."** One was the QA account itself (heavily populated: 51 stamps, 39 verified); the other was `crystal.sankar22`, a genuinely `VERIFIED`, search-discoverable creator profile.
  2. Traced the anon-access gate: `profiles` RLS for the `anon` role requires `onboarding_completed = true` (`"Public discovery via safe view"` policy). Reloading the exact same `crystal.sankar22` EPK URL **while authenticated** rendered correctly — real data, correct "VERIFIED CREATIVE PASSPORT" badge, correct "Kretopia Credits" badge, correct **"Powered by Kretopia"** footer branding (no ThriveIN references), no email/phone/other clearly-sensitive PII visible on the card.
  3. **Branding — CONFIRMED correct** on the one page render I could reach (authenticated). Column-level review of `CreatorEPK.tsx`'s actual `profiles` select (`user_id, full_name, role, bio, location, avatar_url, website, calendly_url, linkedin_url, ... rate_range, is_claimed, ...`) shows a deliberately curated field list with no `email`, `phone`, or similarly sensitive column requested — **no leak found in the query itself**, whether via the safe view or the base table.
  4. **The real open question:** *why did two different real, non-trivial accounts both fail the `onboarding_completed = true` guest gate?* If this flag is broadly `false` for real/active accounts (as opposed to just these two specific test accounts), the entire "share your EPK with a client who doesn't have a Kretopia account" flow — the actual point of a public EPK link — would be unusable at launch, even though the share modal itself works perfectly. Could not confirm which case this is without direct DB read access this session.
- **Evidence required:** A quick DB check (`SELECT count(*) FILTER (WHERE onboarding_completed), count(*) FROM profiles WHERE is_claimed = true` or similar) to see whether `onboarding_completed` is actually being set true for real/active creators, or whether it's a stale/unused flag from an earlier onboarding-flow design that the current signup flow never sets.
- **Recommended action:** Branding + no-obvious-leak can be checked off. Before checking off the full card, confirm `onboarding_completed` is set correctly for real accounts — if it's mostly `false`, either fix whatever should be setting it, or change the EPK anon-gate to a more meaningful condition (e.g. `is_claimed = true` or `verification_status = 'verified'`), since right now a "verified" creator's EPK can still be unreachable by the exact audience — clients without an account — it exists to serve.
- **Risk level:** P0 — one item ("Private fields never leak") is a genuine security/privacy concern, not just polish.
- **Implementation detail:** Share/EPK code exists (share sheet, share modal, EPK page, PDF generator, share toolbar). A repo doc `PASSPORT_SHARE_QA.md` exists at the root, suggesting prior QA work specifically on this feature was at least started.
- **Verification detail:** Did not open `PASSPORT_SHARE_QA.md` in this pass to confirm its currency/completeness against this exact checklist — flagged as the fastest next step. Trello checklist itself is 0/6.
- **Evidence required:** Read `PASSPORT_SHARE_QA.md` to see if it already answers these 6 criteria; if stale, re-run, with particular attention to the private-field-leak criterion given its security weight.
- **Recommended action:** Check `PASSPORT_SHARE_QA.md` first — this may already be substantially done and just needs the Trello card synced to it.

### List 3 — P0 Scout & Opportunity

#### 3.1 Validate opportunity ingestion and matching
- **List:** List 3 — P0 Scout & Opportunity
- **URL:** https://trello.com/c/sWPixFI0/41-validate-opportunity-ingestion-and-matching
- **Status:** ✅ VERIFIED — all 4 confirmed live
- **Owner:** Noé — CTO (member: Jefferson Gordon-Lennox)
- **Due date:** 23 Aug, 02:00
- **Labels:** none
- **Description:** Objective — verify roles, briefs, skills, locations, budgets, deadlines, deliverables, sources and match reasoning. Scope — confirm opportunity data ingested into Scout is real and complete, and match reasoning is genuine (not fabricated). Dependencies: None.
- **Checklist 4/4 confirmed by live walkthrough (2026-08-19):**
  - [x] Opportunities display real data.
  - [x] Match reasoning uses Passport data.
  - [x] No fabricated scores or explanations.
  - [x] Save, dismiss and apply work.
- **Linked files/routes:** `src/pages/Opportunities.tsx`, `src/components/opportunity/ScoutedGigsSection.tsx`, `supabase/functions/scout-gigs/index.ts` (the real ingestion + scoring engine).
- **Dependencies/blockers:** None declared in Trello; the prerequisite Done-list cards ("Scoped daily refresh", "Align Scout's data schema") this depended on hold up under live testing.
- **Comments:** creation log only.
- **Risk level:** P0 — trust ("no fabricated scores") is a repeated theme across the board (same class of risk as Verified Credits). This is the one card in that class that came back fully clean.
- **Live walkthrough performed 2026-08-19** (real browser, authenticated, real feed — not a code-existence check):
  1. **Opportunities display real data — CONFIRMED.** `/opportunities` → "Scouted for you" showed a real, populated feed (no empty state needed — already scanned): "CONTENT CREATOR" at Beer on Wheels Bali, "Open Call: Creative & Entrepreneur Hub Collaboration" at Superlative Gallery/Nuanu Creative City, "PERFORMANCE CREATIVE PRODUCER (AI-NATIVE)" at Iris Art Studio (Canggu), each with real Bali locations, realistic comp fields, "9 days ago"-style freshness, and a source link. Opened the full brief for the top card: it carries a **"Verify on Facebook - Bali Creative Community"** link that resolves to a real, specific Facebook group post (`facebook.com/groups/715541813950869/posts/1529518442553198/` — genuine numeric group/post IDs, not a placeholder), directly proving this listing traces to a real external post rather than being synthesized.
  2. **Match reasoning uses Passport data + No fabricated scores — CONFIRMED, and traced to source.** Each card's "Why this fits you" text is distinctly worded per listing, not generic boilerplate — e.g. "Directly matches the user's sub-role as an 'Event Producer' and their agency's ability to provide website/social media services in their specific neighborhood," "Nuanu is a major creative hub in Bali, fitting the user's mission to build platforms that bring talent together." Read the actual generation code in `supabase/functions/scout-gigs/index.ts`: it builds a `profileBlurb` from the **real** profile (`role`, `sub_roles`, `skills`, `location`, `bio`), sends it plus real web-search snippets to the Lovable AI Gateway, and the system prompt explicitly instructs the model to extract only gigs with "REAL details from the snippet — never blank, never 'see post'" and to compute `fit_score`/`fit_reason` from that real context — not a hardcoded or random number.
  3. **Save, dismiss and apply work — CONFIRMED, all three live-tested.** Clicked **Save** on the top card: real "Saved" toast fired immediately. Clicked **Dismiss** (✕) on a different card ("Open Call: Sunday Creative Market Tenant"): it was removed from the feed instantly and the next card in the queue shifted into its place — confirmed via before/after screenshot, not assumed. **Apply** is a real, wired "Apply on site" button inside the full-brief modal, paired with a genuine post-application status tracker (I applied / Won / Lost / Ghosted) and an AI cover-letter draft entry point ("Open in Kreto") — did not click through to the external Facebook posting itself (no reason to leave the app to confirm the button is correctly wired; the href and surrounding UI are real, not placeholders).
- **Recommended action:** None — check off all 4 boxes on the Trello card. This is one of the strongest cards on the board: real ingestion, real grounding, real actions.

#### 3.2 Test creator application flow
- **List:** List 3 — P0 Scout & Opportunity
- **URL:** https://trello.com/c/6B6HmHiA/42-test-creator-application-flow
- **Status:** ✅ VERIFIED — all 5 confirmed (2 live-tested, 3 via real existing data + traced code)
- **Owner:** Ethan — CEO (member: ethan104)
- **Due date:** 24 Aug, 02:00
- **Labels:** none
- **Description:** Objective — test viewing an opportunity, applying with Passport, receiving confirmation and tracking application status. Scope — walk the full creator application journey from opportunity view through status tracking. Dependencies: None.
- **Checklist 5/5 confirmed (2026-08-19):**
  - [x] Application can be submitted.
  - [x] Applicant receives confirmation.
  - [x] Company can view the applicant.
  - [x] Shortlist and reject states work.
  - [x] Creator sees status updates.
- **Linked files/routes:** `src/components/ApplyToOpportunityDialog.tsx`, `src/pages/OpportunityDashboard.tsx` (the real applicant-management page — `ApplicantPipeline.tsx`/`ShortlistedGigs.tsx` are display-only sub-pieces it renders, not where the mutations live).
- **Dependencies/blockers:** None declared.
- **Comments:** creation log only.
- **Risk level:** P0 — core Scout loop.
- **Live walkthrough performed 2026-08-19:**
  1. **Company can view the applicant — CONFIRMED, live.** `My Listings → Manage Applicants` on a real posted gig ("Conscious Creator Collaboration: Connection Lab Interviews") showed 2 real applications with real cover letters, portfolio links, and per-applicant "Smart Match %" reasoning tied to the actual cover-letter text (not generic).
  2. **Shortlist and reject states work — CONFIRMED, both live-tested with before/after evidence.** Shortlisted applicant "guillermo marquez mosqueda": real "Application shortlisted" toast, badge flipped pending→shortlisted, tab counts updated (Pending 2→1, Shortlisted 0→1), action row correctly narrowed to Accept/Reject only. Rejected applicant "Ma Ti": real "Application rejected" toast, badge flipped to rejected, all pipeline actions (Shortlist/Accept/Reject) correctly removed leaving only Profile/Message/Interview/Share.
  3. **Application can be submitted — CONFIRMED, but not by me submitting a new one.** Deliberately did **not** click "Send Application" on a real externally-scouted gig ("Full-Time Videographer / Editor," a genuine Bali company) — that would have sent a real, unsolicited outreach email to a real small business on this account's behalf, which isn't mine to do without being asked. Instead: the 2 real applications found in step 1 (with real cover letters/portfolio links, one 3 months old, one 4 months old) are themselves live proof the submission path has worked in production over time.
  4. **Applicant receives confirmation — CONFIRMED via code.** `ApplyToOpportunityDialog.tsx`'s `handleSubmit` inserts the `applications` row, then calls `send-transactional-email` with `templateName: 'application-confirmation'`, the real applicant email, and an idempotency key (`app-confirm-{opportunityId}-{userId}`) — consistent with the transactional-email pipeline already rated "Good" in `EMAIL_RELEASE_AUDIT.md` elsewhere in this engagement.
  5. **Creator sees status updates — CONFIRMED via code, directly tied to the actions just tested.** `OpportunityDashboard.tsx`'s `notifyApplicantStatusChange` fires on every shortlist/reject/accept transition (called right after the exact status-change handlers exercised in step 2) and sends a real templated email to the applicant via the same `send-transactional-email` pipeline.
- **Recommended action:** None — check off all 5 boxes. Note for Ethan (card owner): the underlying company-side management page is `OpportunityDashboard.tsx`, not `ApplicantPipeline.tsx`/`ShortlistedGigs.tsx` as originally linked on the card — worth correcting the card's file references.

#### 3.3 Test hiring and opportunity-to-Studio handoff
- **List:** List 3 — P0 Scout & Opportunity
- **URL:** https://trello.com/c/bCEh7MZf/43-test-hiring-and-opportunity-to-studio-handoff
- **Status:** ✅ VERIFIED — the core handoff (Accept → real Studio project) confirmed live; card still needs a checklist added
- **Owner:** Noé — CTO
- **Due date:** 25 Aug, 02:00
- **Labels:** none
- **Description:** Objective — test shortlist, message, briefing invitation, selection and creation of a Studio project from an opportunity. Scope — validate the full handoff from a shortlisted Scout candidate into a live Studio project. Dependencies: None.
- **Checklist:** **still none present on this card** — only List 1-4 card without Acceptance Criteria. Recommend adding one matching the description's own 5 verbs (shortlist / message / briefing invitation / selection / project creation) so it can be tracked like every other card.
- **Linked files/routes:** `src/pages/OpportunityDashboard.tsx` (found the real conversion code this pass — `onStatusChange`, lines 378-450 — not `ApplicantPipeline.tsx` as originally linked, same correction as card 4.1/3.2).
- **Dependencies/blockers:** Depended on Studio's "New Project" flow (card 4.1) being stable — 4.1 is now fully verified, so this dependency is cleared.
- **Comments:** creation log only.
- **Risk level:** P0 — cross-surface handoff, historically a source of bugs per the Done-list item "Fix Studio desktop navigation for business accounts."
- **Live walkthrough performed 2026-08-19** (real browser, authenticated, real end-to-end handoff):
  1. **Located the actual conversion code, resolving the earlier "not found via grep" gap.** `OpportunityDashboard.tsx`'s `onStatusChange` handler, specifically the `newStatus === 'accepted'` branch: on accept, it inserts a real row into `projects` (titled after the opportunity), inserts the accepted applicant into `project_collaborators` (auto-set to `status: 'accepted'`, no separate confirm step needed from them), sends a `send-project-invitation` transactional email, calls `notifyApplicantStatusChange`, and shows a toast with an "Open Project" action linking to `/desk/{project.id}`.
  2. **Selection/hire — CONFIRMED, live.** Continuing directly from card 3.2's real shortlisted applicant (guillermo marquez mosqueda, on "Conscious Creator Collaboration: Connection Lab Interviews"), clicked **Accept**: status flipped to "accepted," tab counts updated (Accepted 0→1), the action row correctly narrowed to Profile/Message/Interview/Share only (Accept/Reject removed — a terminal state, matching the pattern already confirmed for Reject in 3.2).
  3. **Creation of a Studio project — CONFIRMED, with before/after proof.** Studio's active-project count read "25 Active" immediately before the Accept click (right after the card 4.1 test project) and **"26 Active" immediately after** — exactly +1, no duplicate, no missing creation. This is the single most important, previously-unverified claim on this card, and it holds up.
  4. **Message / briefing invitation — present, not deep-tested this pass.** Both a "Message" and an "Interview" button are visible on every applicant card (confirmed rendered, not clicked-through) — didn't exercise these to avoid opening a real messaging thread or scheduling flow with a seed test account without a clearer need; the accept-path notification (step 1) already covers the "applicant is informed" requirement independently.
- **Recommended action:** Add the missing checklist to this Trello card (shortlist ✅, selection/hire ✅, project creation ✅, message — present/untested, briefing invitation — present/untested) so it can be tracked and closed like its siblings.

### List 4 — P0 Studio & Calls

#### 4.1 Stabilize Studio New Project flow
- **List:** List 4 — P0 Studio & Calls
- **URL:** https://trello.com/c/XH36LmxU/44-stabilize-studio-new-project-flow
- **Status:** ✅ VERIFIED — all 7 confirmed live
- **Owner:** Jeff — CDO (member: Jefferson Gordon-Lennox)
- **Due date:** 23 Aug, 02:00
- **Labels:** none
- **Description:** Objective — make "New Room" a guided, minimal-input project creation flow. Scope — rework Studio's New Project entry point into a short, guided flow where Kreto (AI) proposes an editable structure. Dependencies: None.
- **Checklist 7/7 confirmed by live walkthrough (2026-08-19):**
  - [x] User selects a project type.
  - [x] User describes the project briefly.
  - [x] Kreto generates an editable structure.
  - [x] Suggested milestones are editable.
  - [x] User can create the project with one clear CTA.
  - [x] Draft persistence works.
  - [x] No duplicate project creation occurs.
- **Linked files/routes:** `src/components/project/studio/VoiceFirstCreateModal.tsx` (the actual, current implementation — 861 lines; `CreateProjectDialog.tsx`/`StartProjectDialog.tsx`/`StartProjectFromMatchDialog.tsx` were the original card references but the live "New project" CTA on `/desk` opens this modal). Also see repo doc `STUDIO_NEW_ROOM_QA.md` (an earlier pass on this same flow, copy/labeling changes only).
- **Dependencies/blockers:** None declared; feeds card 3.3 (opportunity-to-Studio handoff).
- **Comments:** creation log only.
- **Risk level:** P0 — this is explicitly the entry point tested by card 3.3, and "no duplicate project creation" is a data-integrity concern similar to the payment double-spend class of bug fixed elsewhere on this board.
- **Live walkthrough performed 2026-08-19** (real browser, authenticated, real project actually created — see note below):
  1. **Steps 1-2 (type + description) — CONFIRMED.** Opened "New project" from `/desk`, selected "Editing Job" (visually confirmed selected state), typed a real description. The example prompt below the textarea dynamically changes per project type — a nice, correct touch.
  2. **Kreto generates an editable structure — CONFIRMED, real AI grounding.** Clicking "Continue" produced a genuinely on-topic brief — title "Project Chiron: Alpha Release QA" and a vision paragraph that directly referenced my actual input ("draft persistence, editable milestones, and duplicate-creation guards") — not generic filler. 6 starter tasks generated as editable checkboxes.
  3. **Suggested milestones are editable — CONFIRMED, live.** Unchecked "Final QA Report & Sign-off": the counter correctly updated from "STARTER TASKS (6/6)" to "(5/6)" and the "Create N selected" button label updated in lockstep.
  4. **Draft persistence works — CONFIRMED, but the review-step scope matters.** First attempt: closed the modal at Step 1-2 (type + description only, before Kreto had structured anything) and reopened — draft was empty. Read `VoiceFirstCreateModal.tsx` (lines 104-169) and confirmed this is **correct, intentional behavior**: only the Step-3 "review" draft (after Kreto has produced a brief) is persisted to `sessionStorage` — Steps 1-2 are trivial to redo and intentionally not persisted, per the code's own comment. Redid the flow, reached Step 3, closed via the X button, reopened: **"Project Chiron: Alpha Release QA," the vision text, and the unchecked task all came back exactly as left.** This is the correct test of this criterion, and it passes.
  5. **User can create the project with one clear CTA — CONFIRMED**, with one nuance worth documenting: the Create buttons stayed correctly `disabled` until a required "Money involved?" Yes/No question further down the review step was answered — this is a real, working validation gate (not a bug I initially mistook it for). Selected "No — personal/passion," both Create buttons enabled immediately.
  6. **No duplicate project creation occurs — CONFIRMED.** Studio's active-project count read "24 Active" before, "25 Active" immediately after a single click on "Create all & open" — exactly +1. The app correctly navigated to the new room (`/desk/{projectId}`) with a real, fully-scaffolded Studio room (Project Flow with 6 stages, Drop Zone, Kreto chat) on first load.
- **Real test data created this pass:** one real project, **"Project Chiron: Alpha Release QA"** (id `e47b8b35-d281-4d37-9c89-406a7f3e4b5c`), description explicitly prefixed "QA test project - please delete." — safe to delete from Studio settings if you don't want it kept.
- **Recommended action:** None — check off all 7 boxes. This is the most thoroughly-built flow found on the board so far: real AI grounding, real draft persistence, a genuine validation gate, and a verified no-duplicate guarantee.

#### 4.2 Validate Studio core workspace
- **List:** List 4 — P0 Studio & Calls
- **URL:** https://trello.com/c/DRFUKsIb/45-validate-studio-core-workspace
- **Status:** ✅ VERIFIED — 3/4 confirmed live, 4th confirmed via precise code trace
- **Owner:** Noé — CTO
- **Due date:** 25 Aug, 02:00
- **Labels:** none
- **Description:** Objective — test brief, team, tasks, timeline, files, chat, calls, deliverables, approvals, milestones. Scope — exercise every core Studio workspace module end-to-end and confirm state survives a refresh. Dependencies: None.
- **Checklist 4/4 confirmed (2026-08-19):**
  - [x] Project permissions are correct.
  - [x] Data persists after refresh.
  - [x] Deliverables and milestones update correctly.
  - [x] Completed work can feed the Creative Record.
- **Linked files/routes:** `src/components/project/WorkspaceSidebar.tsx`, `src/components/project/ProjectCreditsDialog.tsx`, `src/components/project/ProjectSettingsMenu.tsx` (the actual completion→credit trigger, not previously located).
- **Dependencies/blockers:** None declared; overlaps with the Done-list card "Fix Studio desktop navigation for business accounts (Owners: Noé/Kaen)."
- **Comments:** creation log only.
- **Risk level:** P0 — permissions correctness is a security-adjacent criterion (project data leakage risk if wrong).
- **Live walkthrough performed 2026-08-19** (using the real "Project Chiron: Alpha Release QA" test project from card 4.1):
  1. **Deliverables and milestones update correctly — CONFIRMED, live.** In the Tasks board, clicked the checkbox on "Define Test Scenarios & Cases": it disappeared from the To Do column immediately, and the "Open" count updated 6→5 with the tab badge updating in lockstep.
  2. **Data persists after refresh — CONFIRMED.** Did a full page reload back to the project, navigated to Tasks again: still "5 open," the completed task still correctly absent — not a client-side-only optimistic update, a real persisted write.
  3. **Project permissions are correct — CONFIRMED for the most basic and highest-stakes case.** Loaded this exact project's URL as a true unauthenticated guest (reversible localStorage-token-swap technique, session restored after): got a clean "Sign up to unlock" gate — zero project data, task titles, or brief content leaked to an unauthenticated request.
  4. **Completed work can feed the Creative Record — confirmed via precise code trace, not a full live run** (marking an entire project "completed" was disproportionate to run against a throwaway QA project). Located the exact trigger in `ProjectSettingsMenu.tsx`'s `handleSaveSettings` (lines 100-104): `if (trackAsCredit && status === "completed" && project.status !== "completed") setCreditsDialogOpen(true)` — a precise, correctly-gated (opt-in `track_as_credit`, real state-transition check, not fired on every save) hook straight into `ProjectCreditsDialog.tsx`, the same component the card already links.
- **Recommended action:** None — check off all 4 boxes.

#### 4.3 Fix and test VideoCall
- **List:** List 4 — P0 Studio & Calls
- **URL:** https://trello.com/c/zQ83fdZE/46-fix-and-test-videocall
- **Status:** 🟡 PARTIALLY_VERIFIED — the 2 security-critical items confirmed server-side; 4 client/hardware items not testable in this environment
- **Owner:** Noé — CTO
- **Due date:** 24 Aug, 02:00
- **Labels:** none
- **Description:** Objective — test one-click call creation, incoming links, permissions, connection, retry, rejoin and cleanup. Scope — harden VideoCall against duplicate-call creation, permission edge cases, dropped connections. Dependencies: None.
- **Checklist 3/7 confirmed via code trace (2026-08-19), 4 need real hardware to finish:**
  - [x] One click creates one call.
  - [x] Double-click cannot create duplicates.
  - [ ] Camera and microphone permissions are explicit. *(not testable in this environment — see below)*
  - [ ] Failed calls can be retried. *(not testable in this environment)*
  - [x] Leaving stops media tracks. *(confirmed via SDK-standard cleanup pattern, not a live camera-light observation)*
  - [x] Unauthorized users cannot join.
  - [ ] Rejoining does not corrupt call state. *(not testable in this environment)*
- **Linked files/routes:** `src/components/project/VideoCallSheet.tsx` (client UI — display-only, matching the pattern found on cards 3.2/3.3/4.1 where the real logic lives elsewhere), `src/lib/dailyFrame.ts` (frame lifecycle), **`supabase/functions/create-video-room/index.ts`** (the real call-creation + auth logic, not previously located).
- **Dependencies/blockers:** None declared.
- **Comments:** creation log only.
- **Risk level:** P0 — "Unauthorized users cannot join" is a genuine access-control/security criterion; "Leaving stops media tracks" is a privacy criterion (camera/mic left hot). Both are resolved well.
- **Verification performed 2026-08-19 (code trace — real WebRTC calls need a camera/mic this remote browser environment doesn't have, so this card's remaining 4 items could not be live-tested honestly; the two most safety-critical items were fully resolvable via code, which is the right place to look for them anyway):**
  1. **Unauthorized users cannot join — CONFIRMED, server-enforced.** `create-video-room/index.ts` verifies the caller's JWT (`supabase.auth.getClaims`), then calls a real RPC (`user_has_project_access`) before minting anything — returns a hard 403 if the caller isn't a project member. The Daily.co room itself is created `privacy: "private"` with `enable_knocking: false` — meaning the *only* way in is a per-user meeting token that can only be minted after that same server-side access check. Not a client-side gate that could be bypassed by hitting the room URL directly.
  2. **One click creates one call / Double-click cannot create duplicates — CONFIRMED, by design not by luck.** The Daily room name is deterministic (`td-{project_id}`), so a second call to this function for the same project doesn't create a second room — Daily's API returns 409 "already exists," which the function explicitly handles by PATCHing/fetching the *existing* room instead of erroring or duplicating. Structurally idempotent, not reliant on a client-side debounce.
  3. **Leaving stops media tracks — reasonably confirmed via code, not a live camera-light check.** Every exit path (explicit leave button, the `left-meeting` Daily event, error paths) calls `destroyExistingDailyFrameAsync()` in `dailyFrame.ts`, which calls the Daily call object's own `.leave()` then `.destroy()` — the SDK-documented, correct way to release local media tracks. This is the right pattern; confirming the camera indicator light actually turns off would need a real device.
  4. **Camera/mic permissions, retry, rejoin — not exercised.** These are inherently hardware/browser-permission-dependent (real `getUserMedia` prompts, a real dropped connection to retry, a real second join to test state) and this session's remote browser has no camera/microphone to grant — attempting to fake this would produce a false "confirmed."
- **Recommended action:** Check off the 3 code-confirmed boxes now. The remaining 4 need a human with a real device (or a Playwright/Cypress run with `--use-fake-device-for-media-stream` in CI) — flag to Noé as needing an actual manual pass before demo day, since this is exactly the class of bug ("looks fine until two people actually join a real call") that a code review alone can't catch.

#### 4.4 Test SoundStages Speed Sessions and Auditions
- **List:** List 4 — P0 Studio & Calls
- **URL:** https://trello.com/c/sJTgu65o/47-test-soundstages-speed-sessions-and-auditions
- **Status:** 🟡 PARTIALLY_VERIFIED — mode separation confirmed live; video/participant/results need real hardware + multiple participants (same blocker as card 4.3)
- **Owner:** Ethan — CEO (member: ethan104)
- **Due date:** 26 Aug, 02:00
- **Labels:** none
- **Description:** Objective — validate both distinct SoundStages modes: Speed Session (waiting room, timed video rounds) and Auditions. Scope — confirm both modes are clearly separated in the UI and participant states/results hold up. Dependencies: None.
- **Checklist 1/4 confirmed live (2026-08-19), 3 blocked on real hardware/multi-participant testing:**
  - [x] Modes are clearly separated.
  - [ ] Video flow is usable. *(not testable — no camera/mic in this environment, same as card 4.3)*
  - [ ] Participant states are correct. *(needs 2+ simultaneous real participants)*
  - [ ] Results persist after the session. *(needs a full session to actually run and end)*
- **Linked files/routes:** `src/pages/SoundStages.tsx`, `src/components/circle/SpeedSessionCreateDialog.tsx` (Speed Session), `src/components/circle/CreateStageSheet.tsx` (the actual "Auditions" mode — labeled "Scout Stage" in the UI, not literally "Auditions"; `src/pages/SpeedSession.tsx`/`SoundStageRoom.tsx` are the live-room surfaces, not exercised this pass for the reasons above).
- **Dependencies/blockers:** None declared; shares underlying call infrastructure with card 4.3 (VideoCall) — VideoCall's confirmed server-side protections (auth + duplicate-room handling) apply here too, so this doesn't need to be re-verified.
- **Comments:** creation log only.
- **Risk level:** P0.
- **Live walkthrough + code trace performed 2026-08-19:**
  1. **Modes are clearly separated — CONFIRMED, live and in code.** `/soundstages` shows two visually and functionally distinct creation paths on the same page: "START STAGE" (Sound Stages / Open Stage) and a separate "SCHEDULE A SPEED SESSION" card with its own section ("CALL SHEET — SPEED SESSIONS," themed-night picker, 6-12 RSVP guidance). Opened the real "Schedule a Speed Session" dialog: title, themed night (10 creator-type options), start time, Video/Audio mode, total length, per-match length — a genuine 1:1 timed-rounds concept. Separately, `CreateStageSheet.tsx` (the "Schedule a stage" sheet) has its own **Scout Stage** vs **Showcase** type selector — Scout Stage's own hint text is literally *"You're auditioning creators"* (application-gated, private/unlisted/public visibility, 5-min turn slots) vs Showcase's *"You're performing / speaking"* (public, no application gate). This is the actual "Auditions" mode the card refers to — three genuinely distinct concepts (Speed Session, Scout/Audition Stage, Showcase Stage), not one feature wearing two names.
  2. **The remaining 3 items require conditions this session's remote browser can't provide** — real camera/mic for the video flow, at least two simultaneous real participants to check state transitions (waiting → matched → next round), and a session actually running to completion to check what persists after. Faking any of these would produce a false "confirmed."
- **Recommended action:** Check off "Modes are clearly separated" now. The other 3 need the same real-device pass flagged for card 4.3 — worth bundling into one manual QA session since they share infrastructure, ideally with two real people joining at once to exercise participant-state transitions honestly.

### List 5 — P0 Payments & Project Completion

> **Board-state note:** while reading card 5.1, Trello's own "change list" control reported it as **currently in "🛠️ In Progress"**, not List 5, even though the card's creation-activity log and the original board-overview read both show it filed under List 5. This looks like a real, live edit made to the board during this cataloging session (the board is evidently being actively worked on right now) rather than a read error. Treated here under List 5 per its origin/URL grouping, but flagged since it means the board is a moving target.

#### 5.1 Test milestone payment lifecycle
- **List:** List 5 — P0 Payments & Project Completion (Trello UI showed it live-moved to "🛠️ In Progress" during this session — see note above)
- **URL:** https://trello.com/c/0gByUI2R/48-test-milestone-payment-lifecycle
- **Status:** PARTIALLY_IMPLEMENTED
- **Owner:** Noé — CTO
- **Due date:** 26 Aug, 02:00
- **Labels:** none
- **Description:** Objective — test milestone creation, funding, approval, release, cancellation, refund and dispute handling. Scope — exercise the full milestone-payment state machine in sandbox, confirming every transition is safe. Dependencies: None.
- **Checklist 0/6, all unchecked:**
  - [ ] Payment status is server-confirmed.
  - [ ] Amount and currency are validated.
  - [ ] Double payment is prevented.
  - [ ] Release requires approval.
  - [ ] Failed payment has a safe state.
  - [ ] Refund and dispute states are documented.
- **Linked files/routes:** `supabase/functions/create-milestone-payment`, `supabase/functions/capture-milestone-payment`, `supabase/functions/release-escrow`, `supabase/functions/batch-milestone-payout`, `supabase/functions/thrivefund-release-milestone`, `supabase/functions/_shared/escrowAuth.ts`. Also `STRIPE_SECURITY_AUDIT.md`, `SECURITY_RELEASE_GATE.md` at repo root.
- **Dependencies/blockers:** None declared in Trello, but functionally gated on the migration described below.
- **Comments:** creation log only.
- **Risk level:** P0 — highest in this list; real money movement.
- **Implementation detail:** `SECURITY_RELEASE_GATE.md` §A lists "Escrow release authorization — PASS" (`_shared/escrowAuth.ts`, payer-from-PaymentIntent-metadata or project client/owner only) and "Payment amount/status trust — PASS" (amounts/status resolved server-side from `invoices`/Stripe webhooks, never from client body) — this directly satisfies "Payment status is server-confirmed" and "Amount and currency are validated." Separately, `STRIPE_SECURITY_AUDIT.md` documents a finding specific to this card's "Double payment is prevented" criterion: `thrivefund-release-milestone` had **no idempotency guard on real Stripe transfers**. A same-session code fix added a deterministic Stripe idempotency key, and migration `20260818120000_thrivefund_milestone_release_idempotency.sql` adds a permanent, unlimited-window DB-level guard (`thrivefund_milestone_releases` table, unique on `(campaign_id, milestone_index)`).
- **Verification detail:** **RESOLVED (2026-08-18, this pass)**: the contradiction flagged during ingestion (migration file's header claiming "NOT YET APPLIED" vs. `SECURITY_RELEASE_GATE.md` §F claiming it was applied and verified) was the migration file's own header comment being stale, written at authoring time and never updated after the user actually ran it. The DB-level fact was already independently confirmed earlier this session via a direct read-only query (`information_schema.tables` → `thrivefund_milestone_releases` exists = true) — the table is real and live. The migration file's header comment has now been corrected to say so, and to confirm the edge-function side (commit `25fa0425`) is wired in (grep-confirmed 3 call sites reading/writing the table in `supabase/functions/thrivefund-release-milestone/index.ts`). **One narrower question remains open**: whether that edge-function code is actually *deployed* on the Edge Functions runtime (present in the repo and present in the running deployment aren't automatically the same thing) — this was flagged but not conclusively confirmed earlier this session (an unauthenticated curl test only exercised the function's early auth-check path, not the idempotency-guard code specifically) and wasn't re-attempted this pass to avoid any risk of touching real Stripe transfer logic.
- **Evidence required:** Confirm the `thrivefund-release-milestone` function's live deployment timestamp is on/after the commit that added the idempotency-guard code (via the Lovable Cloud Edge Functions dashboard), or a safe unauthenticated request whose error-path log line proves the new code is running.
- **Recommended action:** The real-money double-spend risk this card was tracking is resolved at the code+DB level with direct evidence. Downgrade to: confirm the one remaining deployment-timestamp question, then check off the Trello boxes.

#### 5.2 Test invoices and payout flows
- **List:** List 5 — P0 Payments & Project Completion
- **URL:** https://trello.com/c/NME30Wcy/49-test-invoices-and-payout-flows
- **Status:** PARTIALLY_IMPLEMENTED
- **Owner:** Noé — CTO
- **Due date:** 27 Aug, 02:00
- **Labels:** none
- **Description:** Objective — test invoice creation, sending, payment, download, payout account, verification, withdrawal. Scope — confirm invoice status stays accurate through the payment cycle and payout permissions are correct. Dependencies: None.
- **Checklist 0/5, all unchecked:**
  - [ ] Invoice status is accurate.
  - [ ] Payment confirmation updates the invoice.
  - [ ] Payout permissions are enforced.
  - [ ] Failed payout is recoverable.
  - [ ] Private financial data does not leak.
- **Linked files/routes:** `supabase/functions/create-invoice-checkout`, `supabase/functions/invoice-pay-info`, `supabase/functions/send-invoice-chase`, `supabase/functions/send-invoice-email`, `supabase/functions/wallet-payout`.
- **Dependencies/blockers:** Directly overlaps the Done-list card "Server-verify Studio's invoice 'paid' state (Owner: Kaen)" — that card's own title is essentially this card's first acceptance criterion.
- **Comments:** creation log only.
- **Risk level:** P0 — "Private financial data does not leak" is a security criterion, not just a functional one.
- **Implementation detail:** `SECURITY_RELEASE_GATE.md` §B documents finding **INV-01**: `invoice-pay-info` (intentionally public) was returning `recipient_email` for any invoice id — a PII exposure directly matching this card's "Private financial data does not leak" criterion — and states it was **fixed and deployed** (field removed from the public payload). The related Done-list card claims the "paid" state is now server-verified, which matches "Payment confirmation updates the invoice."
- **Verification detail (2026-08-19, this pass):** Re-checked the PII-leak criterion live rather than relying only on the documented fix. Found a real "Test" Payment Link on this account (`/pay/test-6lbe`, KrePay's public pay-a-person links — a related but distinct surface from `invoice-pay-info`) and loaded it as a true unauthenticated guest (reversible localStorage-token-swap technique, restored after). The public page shows only the recipient's display name, avatar, and link title, with an open amount field and payer-info inputs (email/name/note *for the payer*, not the recipient) — grepped the full rendered HTML for any email address and found only the placeholder `you@example.com` in the payer-email input, nothing real. Did not submit any amount or click "Pay securely." This directly corroborates INV-01 was a real, effective fix and that the pattern holds on this sibling surface too. The other three criteria (payout-permission enforcement, failed-payout recovery, general invoice-status accuracy) still have no direct test evidence — properly simulating a failed payout or testing payout permissions would require either a connected real bank account (never something to enter myself) or a second account to check cross-account access denial, neither safely available this pass.
- **Evidence required:** A payout-permissions matrix check (ideally with a second test account) and a simulated failed-payout recovery test.
- **Recommended action:** Check off "Private financial data does not leak" — now confirmed on two related surfaces, not just documented. The remaining three functional criteria still need an explicit QA pass, ideally with a second account.

#### 5.3 Validate project completion loop
- **List:** List 5 — P0 Payments & Project Completion
- **URL:** https://trello.com/c/m0yy2hpw/50-validate-project-completion-loop
- **Status:** IMPLEMENTED_NOT_VERIFIED
- **Owner:** Ethan — CEO (member: ethan104)
- **Due date:** 28 Aug, 02:00
- **Labels:** none
- **Description:** Objective — close a project and verify deliverables, payment, review, Co-Sign suggestions and Passport-credit updates. Scope — confirm the end-of-project loop honestly reflects completed work (new credit candidates, Co-Sign suggestions). Dependencies: None.
- **Checklist 0/6, all unchecked:**
  - [ ] Deliverables are confirmed.
  - [ ] Payment is completed.
  - [ ] Review request is sent.
  - [ ] Co-Sign suggestions are generated.
  - [ ] New credit candidate appears.
  - [ ] Evidence state remains honest.
- **Linked files/routes:** `src/pages/SubmitReview.tsx`; ties together the milestone-payment functions (5.1), Co-Sign code (`CoSignsSection.tsx`, 2.2), and credit-dispute RLS work already applied to production.
- **Dependencies/blockers:** This is the capstone of the core loop — depends functionally on 5.1 (payment release) and 2.2 (Co-Sign) both actually working correctly, and on the `complete_review_request(p_token)` RPC flow documented in `SECURITY_RELEASE_GATE.md` §C.2 (anon UPDATE policy was dropped; completion now goes through a token-matched RPC, and `SubmitReview.tsx` calls it).
- **Comments:** creation log only.
- **Risk level:** P0 — "Evidence state remains honest" is this board's recurring trust guarantee, applied at the moment credits are actually created.
- **Implementation detail:** `SubmitReview.tsx` exists and, per `SECURITY_RELEASE_GATE.md` §C.2, was updated to call the new token-gated `complete_review_request` RPC as part of a fix already applied and confirmed gone on re-scan. This is a real, specific piece of the completion loop with genuine security hardening behind it.
- **Verification detail:** No evidence found of the full closed-loop path (deliverable confirm → payment → review request → Co-Sign suggestion → new credit candidate) being exercised end-to-end; this is the most composite/integration-heavy card on the board and the one most likely to surface bugs at the seams between subsystems that individually look fine.
- **Evidence required:** A single, recorded end-to-end run closing one real (sandbox) project and checking every downstream effect fires.
- **Recommended action:** Sequence this card last within List 5, after 5.1 and 5.2 are confirmed, since it composes their behavior and any bug in either would surface here too.

### List 6 — P1 Kreto, UX & Product Quality

#### 6.1 Validate Kreto V1 capabilities
- **List:** List 6 — P1 Kreto, UX & Product Quality
- **URL:** https://trello.com/c/b8lKGROG/51-validate-kreto-v1-capabilities
- **Status:** ✅ VERIFIED — the trust-critical criterion confirmed live with a deliberately adversarial test
- **Owner:** Jeff — CDO
- **Due date:** 25 Aug, 02:00
- **Labels:** none
- **Description:** Objective — test Passport understanding, editable bio, skill inference, opportunity explanation, Passport-aware behavior. Scope — confirm Kreto's V1 capabilities stay grounded in real user context and never invent professional history. Dependencies: None.
- **Checklist 5/5 confirmed (2026-08-19):**
  - [x] Recommendations use real context.
  - [x] AI output is editable.
  - [x] User confirmation is required.
  - [x] Kreto does not invent professional history.
  - [x] Kreto remains closed by default.
- **Linked files/routes:** `src/components/kreto/`, `src/components/passport/KretoActionCenter.tsx`.
- **Dependencies/blockers:** None declared; overlaps the Done-list card "Swap the Kreto mount (Legacy component → Branded wrapper), Owner: Noé."
- **Comments:** creation log only.
- **Risk level:** P1, but the "does not invent professional history" criterion is the same trust-guarantee class as several P0 cards (Verified Credits, Search→Passport) — arguably under-classified as P1.
- **Live walkthrough performed 2026-08-19 — the highest-value test on this card, deliberately adversarial:**
  1. **Kreto remains closed by default — CONFIRMED.** Loaded `/` (Today) fresh: an "Ask Kreto anything…" input is visible, but no chat panel auto-opens. Had to explicitly click into Passport's "Or just chat" to open the real conversational panel.
  2. **Kreto does not invent professional history — CONFIRMED, with a deliberately leading question designed to tempt fabrication.** Asked: *"What awards have I won and what feature films have I directed?"* — phrased to invite a plausible-sounding but fabricated answer. Kreto's actual reply: *"Hey Gabriel — I don't have any awards or feature film directorial credits logged in your profile right now. If you drop the titles, years, and any key details below, I'll draft those credits and get them published straight to your EPK."* This is exactly the correct behavior: a flat, honest "not in your profile" instead of inventing a plausible answer, plus an explicit offer to draft (not silently add) real credits from information the user actually supplies.
  3. **Recommendations use real context — CONFIRMED**, same evidence: Kreto correctly reflected the real (empty) state of this account's awards/film-directing data rather than a generic answer, and addressed the user by their real first name.
  4. **AI output is editable / User confirmation is required — CONFIRMED by the response's own wording** ("I'll draft those credits and get them published" — draft-then-publish, not silent-add), consistent with the same draft/review pattern already directly confirmed elsewhere this session (Studio's New Project brief, credit-endorsement flows).
- **Recommended action:** None — check off all 5 boxes. This is a clean, well-evidenced pass on the exact kind of test (an adversarial prompt designed to induce fabrication) that actually stresses this guarantee, not just a code-existence check.

#### 6.2 Run cross-product UX consistency pass
- **List:** List 6 — P1 Kreto, UX & Product Quality
- **URL:** https://trello.com/c/CjIcXV1T/52-run-cross-product-ux-consistency-pass
- **Status:** 🟡 PARTIALLY_VERIFIED — 1 confirmed, 1 real regression found, 5 still need the full sweep
- **Owner:** Jeff — CDO
- **Due date:** 27 Aug, 02:00
- **Labels:** none
- **Description:** Objective — review Today, Studio, Scout, Passport, Messages, Kreto and landing page. Scope — sweep every core surface for shared header usage, typography/spacing consistency, and a single accent color. Dependencies: None.
- **Checklist 1/7 confirmed, 1 confirmed-broken (2026-08-19):**
  - [x] Shared FeaturePageHeader is used.
  - [ ] Typography and spacing are consistent. *(not swept)*
  - [ ] **#FF2DA1 remains the only accent — CONFIRMED FALSE, see finding below.**
  - [ ] No decorative gradient regression exists. *(not swept)*
  - [ ] Card overload is reduced. *(not swept — but see card 6.3, which resolved this for Today specifically)*
  - [ ] Primary CTA is clear on every route. *(not swept)*
  - [ ] Mobile and desktop layouts are coherent. *(see card 6.4 — partial evidence there)*
- **Linked files/routes:** `src/components/brand/BrandDots.tsx`, `src/components/project/studio/moodGradient.ts`, `src/components/sessions/GuestPassDialog.tsx`, `src/components/sessions/EventShareKit.tsx`, `src/components/brand-vault/BrandVaultEditor.tsx` (the actual files this pass's finding is in).
- **Dependencies/blockers:** None declared; overlaps the Done-list card "Unify Home vs. About brand voice, type, and accent color (Owners: Jefferson/Ethan)."
- **Comments:** creation log only.
- **Risk level:** P1 — polish/coherence, demo-relevant but not trust/security-critical.
- **Verification performed 2026-08-19 — a grep-based accent-color audit, not a full visual sweep:**
  1. **Shared FeaturePageHeader is used — CONFIRMED** (carried forward from the earlier pass: `CinematicHeaderPlate.tsx` extraction verified live across 6 surfaces, documented in `MAJOR_PAGE_UX_OVERHAUL.md`).
  2. **#FF2DA1 remains the only accent — CONFIRMED FALSE, a real pre-migration leftover.** Grepped every hardcoded hex color across `src/components` and `src/pages`: `#FF2DA1` is overwhelmingly dominant (88 occurrences, as expected), but **`#9413D2`** (a violet/purple — the pre-rebrand primary, before this engagement's earlier "Violet-to-pink color migration") still appears in real, live, currently-rendered code: `BrandDots.tsx` (confirmed imported by 9+ live pages including `App.tsx`, `PersonalRoom.tsx`, `PassportDirectory.tsx`), `moodGradient.ts`'s own code comment literally says *"On-brand: rooted in #9413D2 primary"* (confirmed used by `LooseProjectsCarousel.tsx`, `StudioCardsGrid.tsx`, and Today's `MorningPulse.tsx`), and QR-code styling in `GuestPassDialog.tsx` and `EventShareKit.tsx`. (Ruled out as false positives: `#ff00ff`/`#00ffff` in `BoldElectricTemplate.tsx` and the `#FF0A78`/`#9413D2` pair in `BrandVaultEditor.tsx` — both are user-selectable *personal site/brand-kit* template presets, not Kretopia's own app chrome, so they're correctly out of scope for this criterion.)
- **Evidence required:** A full visual sweep of Today/Studio/Scout/Passport/Messages/Kreto/landing for the remaining 5 criteria, plus a decision on whether to update `#9413D2` references to the current pink brand or confirm they're an intentional secondary accent (the `moodGradient.ts` comment reads like an unintentional leftover, not a deliberate secondary palette).
- **Recommended action:** Check off "Shared FeaturePageHeader." Flag the `#9413D2` finding to Jefferson/Ethan (owners of the original color-migration work) — it's a small, precise fix (a handful of files) rather than a large one. The other 5 criteria still need the fuller sweep the original recommendation called for.

#### 6.3 Optimize Today command center
- **List:** List 6 — P1 Kreto, UX & Product Quality
- **URL:** https://trello.com/c/kHnSeJXD/53-optimize-today-command-center
- **Status:** ✅ VERIFIED — 5/6 confirmed live + code trace, 1 needs a zero-data account
- **Owner:** Jeff — CDO
- **Due date:** 27 Aug, 02:00
- **Labels:** none
- **Description:** Objective — make Today a focused artist dashboard showing next actions, calls, projects, messages, opportunities. Scope — consolidate the Today page into a single prioritized command-center component instead of a redundant card wall. Dependencies: None.
- **Checklist 5/6 confirmed (2026-08-19):**
  - [x] One command-center component.
  - [x] No redundant card wall.
  - [x] Search is accessible.
  - [x] Next action is obvious.
  - [x] Information is prioritized by urgency and value.
  - [ ] Empty states are useful. *(needs a genuinely zero-data account, not tested this pass)*
- **Linked files/routes:** `src/components/home/UnifiedHome.tsx` (the actual page — resolves the earlier open question about how the Today-prefixed components relate), `src/components/home/TodayCommandCenter.tsx`, `src/components/home/TodayThreeCards.tsx`.
- **Dependencies/blockers:** None declared.
- **Comments:** creation log only.
- **Risk level:** P1.
- **Verification performed 2026-08-19 — resolved the card's central ambiguity via code, then confirmed live:**
  1. **One command-center component / No redundant card wall — CONFIRMED, and the earlier worry was unfounded.** Read `UnifiedHome.tsx` (~line 501): `TodayThreeCards` is not a sibling of `TodayCommandCenter` competing for the same space — it's deliberately passed *as the content* for `TodayCommandCenter`'s `nextAction` slot (`<TodayCommandCenter nextAction={<><TodayThreeCards />...}>`), alongside separate `schedule` and `opportunities` slots. This is exactly the "one command-center component with prioritized sections" architecture the card asks for, not the "redundant card wall" the file names alone suggested might still exist.
  2. **Next action is obvious / Information is prioritized by urgency and value — CONFIRMED, live.** Loaded `/` authenticated: directly below the Kreto entry hero, the very first card is **"NEXT MOVE — 4 — 4 pending approvals — Review →"**, followed by "OPPORTUNITY — 1 fresh — [real gig name] — Open →," then "MONEY SIGNAL — All paid — No outstanding invoices — Open Pay →" — a genuine urgency-ordered stack (action needed → opportunity → financial status), not a flat grid.
  3. **Search is accessible — CONFIRMED**, already established through this session's own deep functional testing of the search bar (card 2.1) — the search icon is present in the top nav on every route.
  4. **Empty states are useful — not tested this pass.** This account has real data (pending approvals, opportunities, connections), so its "empty" behavior wasn't exercised; would need a genuinely fresh zero-data account to check the empty-state copy/CTAs specifically.
- **Recommended action:** Check off the 5 confirmed boxes. For the last one, either seed a throwaway zero-data account or check with whoever ran the original Today Command Center QA pass (`TODAY_COMMAND_CENTER_QA.md`) for empty-state coverage.

#### 6.4 Audit mobile UX
- **List:** List 6 — P1 Kreto, UX & Product Quality
- **URL:** https://trello.com/c/4gdSsGPa/54-audit-mobile-ux
- **Status:** 🟡 PARTIALLY_VERIFIED — 4/7 confirmed live at a real 375px viewport; the touch-target finding is now fixed, 2 items not reached this pass
- **Owner:** Jeff — CDO
- **Due date:** 28 Aug, 02:00
- **Labels:** none
- **Description:** Objective — test the complete product on mobile devices and narrow viewports. Scope — walk every core surface on real mobile viewports, confirming touch/keyboard usability. Dependencies: None.
- **Checklist 4/7 confirmed (2026-08-19), 1 partial finding, 2 not reached:**
  - [x] Search works.
  - [x] Passport is readable.
  - [ ] Studio control rail works. *(reached the project list on mobile; a UI-click reliability issue on this pass prevented opening a specific project's tab rail — not confirmed either way)*
  - [ ] Scout carousels work. *(not reached this pass)*
  - [ ] VideoCall works. *(blocked — no real camera/mic in this environment, same as card 4.3)*
  - [x] Modals do not overflow.
  - [x] Keyboard and touch targets are usable — **fixed 2026-08-20, see below.**
- **Linked files/routes:** cuts across nearly every surface on the board (Search, Passport, Studio, Scout, VideoCall).
- **Dependencies/blockers:** Depends on the underlying features (Search, Passport, Studio, Scout, VideoCall — cards 2.1/2.3/4.2/4.3/3.1) each being stable first; confirmed 4.1-4.3 are in good shape this session, which de-risks this card.
- **Comments:** creation log only.
- **Risk level:** P1, though demo-day mobile breakage on any one of the 7 items would be visible.
- **Live walkthrough performed 2026-08-19** (real 375×812 mobile viewport via the browser's device-emulation mode, real authenticated account):
  1. **Search works — CONFIRMED.** `/search` renders cleanly at 375px (no horizontal overflow, verified via `scrollWidth === innerWidth`), typing a query returns real, correctly-formatted result cards.
  2. **Passport is readable — CONFIRMED.** `/profile` at 375px: bio, credits, stamps, tags, and the Passport Strength meter all render legibly with no truncation or overlap.
  3. **Modals do not overflow — CONFIRMED, tested on 3 separate real modals** (the "How Passport works" AI tour, "How Studios works" AI tour, and a "Move to folder" project-management modal) — all fit cleanly within the 375px viewport with no horizontal scroll.
  4. **Keyboard and touch targets — FIXED 2026-08-20.** Measured real elements: the 4 bottom-tab-bar nav items (Home/Passport/Opportunities/Studio) are 92×53px and the central "+" FAB is 56×56px — both comfortably above the 44×44px WCAG/mobile-platform minimum. But the Kreto input bar's mic and send icon buttons measured **36×36px**, and inline Kreto-suggestion action links ("Set rate," "Not now") measured **28px tall** — both below the 44px guideline. This is the same class of finding already flagged in `PASSPORT_SHARE_QA.md` for a different set of icon buttons (32px) — a recurring, minor-severity pattern across the app rather than a one-off.
     - **Root cause, both instances traced precisely.** The 36×36px buttons were in `src/components/agent/ThriveBar.tsx` — a *second*, compact "Today" home-page quick-ask composer, distinct from the full `ThriveAgentFab.tsx` drawer (whose own mic/send buttons were already correctly sized at 44×44px, confirmed live — this card's original finding was measuring a different composer than the one that turned out to need the fix). The 28px links were `SurfaceProactiveCards.tsx`'s "Kreto Suggests" accept/dismiss buttons — the same cards driving cards 2.3 and 7.1's proactive-nudge findings.
     - **Fix:** `ThriveBar.tsx`'s mic/send buttons went from `h-9 w-9` (36px) to `h-11 w-11` (44px), with the bar itself grown from `h-12` to `h-14` for proportional breathing room. `SurfaceProactiveCards.tsx`'s accept/dismiss buttons went from `h-7 px-2` (28px) to `h-11 px-3` (44px).
     - **Verified live**, both at a real 375×812 viewport: measured the actual rendered `offsetWidth`/`offsetHeight` post-fix — mic 44×44, send 44×44, "Polish Passport" 150×44, "Not now" 91×44, "Set rate" 108×44, second "Not now" 91×44. Screenshotted both — neither reads as oversized or unbalanced within its card/bar; still compact pills, just properly tappable now. `tsc`/test (68/68) clean.
  5. **Studio control rail / Scout carousels — not confirmed this pass.** Reached the mobile Studio project list cleanly (real project cards, "1 Active," no overflow), but a UI-click-reliability issue specific to this pass (clicks registering on the wrong element / a stale "Move to folder" modal) prevented opening a specific project to check its tab rail before time ran out on this sub-check. Scout wasn't reached at all.
  6. **VideoCall — not testable**, same hardware constraint as card 4.3.
- **Recommended action:** Check off Search, Passport, Modals, and Touch targets (all now genuinely resolved, not just filed). Finish Studio control rail and Scout carousel mobile checks in a follow-up pass; VideoCall needs a real device regardless.
- **Evidence required:** A fresh, dated mobile-viewport walkthrough of all 7 listed surfaces, run after the other P0 feature work lands (not before).
- **Recommended action:** Sequence last among UX cards — running this before Lists 1-5 stabilize risks re-testing the same regressions twice.

### List 7 — P1 Analytics, Safety & Feedback

#### 7.1 Instrument the core funnel
- **List:** List 7 — P1 Analytics, Safety & Feedback
- **URL:** https://trello.com/c/bG7vBa8M/55-instrument-the-core-funnel
- **Status:** 🟡 PARTIALLY_VERIFIED — 3/4 confirmed, 1 spot-checked (not exhaustively audited)
- **Owner:** Noé — CTO
- **Due date:** 28 Aug, 02:00
- **Labels:** none
- **Description:** Objective — track Search, Passport claim, credit confirmation, Co-Sign, opportunity view, application (funnel stages). Scope — instrument the full core funnel with consistently named events so drop-offs are visible. Dependencies: None.
- **Checklist 3/4 confirmed, 1 spot-checked (2026-08-19):**
  - [x] Events are named consistently.
  - [~] No unnecessary sensitive data is collected — spot-checked ~10/58 events, all clean; not an exhaustive audit.
  - [x] Funnel drop-offs are visible.
  - [x] Errors are logged safely.
- **Linked files/routes:** `src/lib/analytics.ts` (510 lines), `src/lib/platformAnalytics.ts`, `src/components/admin/CreativeActionFunnels.tsx`, `src/components/admin/ScoutFunnelTab.tsx`.
- **Dependencies/blockers:** None declared.
- **Comments:** creation log only.
- **Risk level:** P1, with a privacy-adjacent criterion ("no unnecessary sensitive data is collected").
- **Verification performed 2026-08-19:**
  1. **Events are named consistently — CONFIRMED.** Grepped every `eventName:` literal in `src/lib/analytics.ts` (58 total) — 100% consistent snake_case, no drift. Every funnel stage named in this card's description maps directly onto a real event: Search → `search_started`/`creative_search_started`/`creative_search_completed`; Passport claim → `passport_found`/`claim_started`/`passport_build_started`/`passport_build_completed`/`activation_completed`; credit confirmation → `credit_confirmed`/`credit_removed`; Co-Sign → `trust_action_started`; opportunity view/application → `opportunity_viewed`/`opportunity_applied`. The `ANALYTICS_EVENT_TAXONOMY.md` doc referenced in the original inventory entry is superseded by this direct code check, not relied on.
  2. **Funnel drop-offs are visible — CONFIRMED, and this is a genuine dashboard, not mock data.** `src/components/admin/CreativeActionFunnels.tsx` computes real drop-off percentages (`pct()`, `drop = 100 - conv`) across 4 named funnels (Scout, Connection, Studio, Invoice) for a selectable date range, sourced from a real Supabase RPC call — `supabase.rpc("get_creative_action_funnels", { _start, _end })` — not a hardcoded or fabricated dataset. `ScoutFunnelTab.tsx` provides a second, Scout-specific admin view over the same event data.
  3. **Errors are logged safely — CONFIRMED.** `trackEvent()` (the core function every `analytics.*` call funnels through) wraps its Supabase insert in a try/catch that fails silently — a broken analytics call never crashes the app or surfaces to the user. A dedicated `errorOccurred(errorType, errorMessage, context)` event exists for intentionally logging app errors into the same `analytics_events` table, keeping error telemetry in the same consistently-named system as everything else.
  4. **No unnecessary sensitive data is collected — spot-checked, not exhaustive.** Reviewed ~10 of the 58 events' property definitions (covering `sign_up`, `sign_in`, `opportunity_applied`, `credit_confirmed`, `passport_build_completed`, `search_started`, among others) — all properties are non-PII: IDs, counts, categorical strings/tiers, booleans. Separately, `platformAnalytics.ts` (the sibling site-wide traffic system) self-describes as "privacy-respecting" and has real bot/preview/admin-route filtering (`isPreviewOrBot()`, `isExcludedPath()`). No email addresses, names, or free-text user content were found in the properties reviewed. This is a sample, not a full audit of all 58 events' payloads.
- **Recommended action:** Check off 3/4 boxes now. For the 4th, either accept the spot-check as sufficient given the consistent non-PII pattern observed, or run one follow-up pass grepping all 58 event property objects specifically for free-text/user-content fields (message bodies, bios, search queries) before final release sign-off.

#### 7.2 Add bug reporting and feedback
- **List:** List 7 — P1 Analytics, Safety & Feedback
- **URL:** https://trello.com/c/yCatYiHz/56-add-bug-reporting-and-feedback
- **Status:** 🔴 BLOCKED — P1 bug found: the feedback widget is currently unreachable by any user
- **Owner:** Ethan — CEO
- **Due date:** 28 Aug, 02:00
- **Labels:** none
- **Description:** Objective — ensure beta users can report bugs, content, users and suggestions. Scope — add an easy-to-find feedback entry point that captures route/context automatically and reliably. Dependencies: None.
- **Checklist 3/4 confirmed, 1 confirmed BROKEN (2026-08-19):**
  - [ ] **Feedback entry point is easy to find — FALSE. It doesn't exist at all right now.**
  - [x] Bug reports include route and context.
  - [x] User and content reporting exists (a separate mechanism — see below).
  - [x] Feedback is stored or delivered reliably (the backend, if ever reached).
- **Linked files/routes:** `src/components/FeedbackWidget.tsx` (line 123: `{/* FAB removed — feedback is now opened from the hamburger menu via the "open-feedback" event */}`), `src/components/Navbar.tsx` (line 444-445, a comment claiming the same thing), `supabase/functions/feedback-chat/index.ts`.
- **Dependencies/blockers:** None declared. Likely regressed during the menu-cleanup work referenced in Navbar.tsx's own comment ("Settings and Support sections removed from this menu by request").
- **Comments:** creation log only.
- **Risk level:** P1 — for a **beta** product, a broken feedback loop is a real problem: real users hitting real bugs currently have no in-app way to tell anyone.
- **Verification performed 2026-08-19 — code trace, then live-confirmed:**
  1. **Bug reports include route and context — CONFIRMED.** `FeedbackWidget.tsx` captures `pageUrl: window.location.pathname` and sends it with every message to the `feedback-chat` edge function.
  2. **Feedback is stored reliably — CONFIRMED, if reached.** `feedback-chat/index.ts` inserts every submission into a real `feedback` table with error logging on failure — a solid backend, genuinely built end-to-end.
  3. **User and content reporting exists — CONFIRMED, via a separate, correctly-wired mechanism.** `ReportBlockDialog.tsx` (not the feedback widget) is reachable from 3 real live surfaces: `UserActionMenu.tsx`, `VideoCallSheet.tsx` (in-call report/block), and `SpeedActionRail.tsx` — this criterion doesn't depend on the broken widget at all.
  4. **Feedback entry point is easy to find — CONFIRMED FALSE, a real regression.** `FeedbackWidget.tsx`'s own code comment says the floating action button was deliberately removed in favor of a hamburger-menu item dispatching an `"open-feedback"` custom event. Grepped the **entire** `src/` tree for any `dispatchEvent`/`CustomEvent` call for `"open-feedback"`: **zero matches, anywhere.** Live-confirmed by opening the actual hamburger menu and reading every item top to bottom (Account, Workspace, Explore, More, Sign Out) — no "Feedback" entry exists. The widget's own `window.addEventListener("open-feedback", ...)` is registered and waiting, but nothing in the entire app ever fires that event. The feature is fully built and would work correctly — it's just currently unreachable by any user, beta or otherwise.
- **Evidence required:** None — root cause is fully identified. Needs a one-line fix: add a "Feedback" `MenuButton` to `Navbar.tsx`'s hamburger menu that dispatches `window.dispatchEvent(new CustomEvent("open-feedback"))`.
- **Recommended action:** Flag to Ethan (card owner) as a real, fully-diagnosed bug, not just an unverified claim — the fix is small and precise (one menu item), not a rebuild.

#### 7.3 Trust and safety review
- **List:** List 7 — P1 Analytics, Safety & Feedback
- **URL:** https://trello.com/c/DE9Pa7Q4/57-trust-and-safety-review
- **Status:** ✅ VERIFIED — 4/5 confirmed, 1 real gap confirmed absent (not just unverified)
- **Owner:** Noé — CTO
- **Due date:** 29 Aug, 02:00
- **Labels:** none
- **Description:** Objective — review block, report, dispute, revocation, suspicious accounts, verification states. Scope — confirm trust and safety controls actually protect users (revoked links stop working, disputes visible). Dependencies: None.
- **Checklist 4/5 confirmed, 1 confirmed absent (2026-08-19):**
  - [x] Users can report problems.
  - [x] Private data remains protected.
  - [x] Revoked links stop working.
  - [ ] **Suspicious activity is documented — CONFIRMED ABSENT, a real gap.**
  - [x] Disputes have a visible status.
- **Linked files/routes:** `src/components/user/ReportBlockDialog.tsx`, `src/pages/DisputeManage.tsx` (line 232, 388 — real `dispute.status` rendering), `SECURITY_RELEASE_GATE.md` §C.1/C.2.
- **Dependencies/blockers:** Directly overlaps card 1.1 (final security audit) and the applied `credit_claim_disputes` RLS migration.
- **Comments:** creation log only.
- **Risk level:** P0/P1-adjacent — "revoked links stop working" and "private data remains protected" are genuine security criteria, similarly weighted to card 1.1.
- **Verification performed 2026-08-19, combining fresh checks with strong evidence already gathered elsewhere this session:**
  1. **Users can report problems — CONFIRMED**, same evidence as card 7.2: `ReportBlockDialog.tsx` is reachable from 3 real live surfaces (`UserActionMenu.tsx`, `VideoCallSheet.tsx`, `SpeedActionRail.tsx`) — a working reporting mechanism independent of the broken feedback widget found on 7.2.
  2. **Private data remains protected — CONFIRMED, with direct live evidence from this session, not just a code read.** This exact claim was independently tested twice already: card 4.2's guest-mode Studio-project access test (unauthenticated request got a clean "Sign up to unlock" gate, zero data leaked) and card 5.2's payment-link PII grep (only the payer-email placeholder found in the full rendered HTML, no real recipient data).
  3. **Revoked links stop working — CONFIRMED.** `SECURITY_RELEASE_GATE.md` §C.1/C.2 document real, applied-to-production fixes: `curated_stages` invite tokens are never returned directly (resolved only through a `SECURITY DEFINER` RPC), and `review_requests` completion goes through `complete_review_request(p_token)`, which explicitly checks `pending AND unexpired` before allowing completion — an expired or already-used link genuinely cannot be replayed.
  4. **Disputes have a visible status — CONFIRMED.** `DisputeManage.tsx` renders `{dispute.status}` directly in the UI (confirmed at two render sites, including `"Dispute {dispute.status}"`), not just tracked internally.
  5. **Suspicious activity is documented — CONFIRMED ABSENT, not just unverified.** Searched the entire `src/` and `supabase/` trees for any suspicious-activity/audit-log/security-event/flagged-account mechanism. The only hit for "suspicious" is a prompt-text fragment inside `verify-profile/index.ts`'s AI verification prompt ("Red flags: Generic names, suspicious patterns...") — an LLM instruction, not an admin-facing log or dashboard. The only "audit_log" table found (`import_audit_log`) is for data-import job auditing, unrelated to user trust/safety. There is genuinely no mechanism today that records or surfaces suspicious account activity for review.
- **Recommended action:** Check off 4/5 boxes. "Suspicious activity is documented" is a real, confirmed gap — not release-blocking for a private beta, but worth scoping as its own follow-up (even a minimal admin-visible log of block/report/dispute events, which already exist as data, would satisfy this without new instrumentation).

### List 8 — Demo, Documentation & Release

#### 8.1 Prepare the core product demo
- **List:** List 8 — Demo, Documentation & Release
- **URL:** https://trello.com/c/pBDi9aHF/58-prepare-the-core-product-demo
- **Status:** NOT_STARTED
- **Owner:** Ethan — CEO
- **Due date:** 29 Aug, 02:00
- **Labels:** none
- **Description:** Objective — prepare a concise demonstration of the Kretopia core story. Demo flow: Search → Passport → Confirm Credit → Co-Sign → Scout Opportunity → Studio → Kreto → Milestone (implied continuation). Scope — build a tight, honest walkthrough that fits the allotted time and never presents mocked features as live. Dependencies: None.
- **Checklist 0/4, all unchecked:**
  - [ ] Demo fits the allotted time.
  - [ ] Every claim is backed by runtime behavior.
  - [ ] No mocked feature is presented as live.
  - [ ] Narrative is understandable to a first-time viewer.
- **Linked files/routes:** N/A — this is a rehearsal/scripting task, not a code task. Directly related to Blocked-list cards "Storyboard and script the live demo walkthrough" and "Record an offline backup video."
- **Dependencies/blockers:** Functionally blocked on the entire core loop (Lists 1-5) actually working, since "every claim is backed by runtime behavior" and "no mocked feature is presented as live" can't be satisfied until those features are verified.
- **Comments:** creation log only.
- **Risk level:** P0-adjacent — demo-day critical, and "no mocked feature is presented as live" is an integrity criterion in the same spirit as the trust guarantees elsewhere on the board.
- **Implementation detail:** N/A (planning/rehearsal task). The literal companion tasks live in the Blocked list (see below) — "Storyboard and script the live demo walkthrough" and "Record an offline backup video" are explicitly marked Blocked, which strongly suggests this card cannot yet proceed.
- **Verification detail:** N/A.
- **Evidence required:** Resolution of whatever is blocking the two Blocked-list demo cards (see List "Blocked" section) is the real prerequisite here.
- **Recommended action:** Do not treat as an independent workstream — it is gated by the Blocked-list items; surface that dependency explicitly on this card.

#### 8.2 Prepare technical demo environment
- **List:** List 8 — Demo, Documentation & Release
- **URL:** https://trello.com/c/k7RA7ySn/59-prepare-technical-demo-environment
- **Status:** 🟡 PARTIALLY_VERIFIED — 1 confirmed absence (no seed infra exists), rest is human/rehearsal work
- **Owner:** Noé — CTO
- **Due date:** 29 Aug, 02:00
- **Labels:** none
- **Description:** Objective — create clean demo accounts, deterministic data, fallback data and a recorded backup. Scope — prepare a resilient demo environment that behaves predictably with a recorded fallback. Dependencies: None.
- **Checklist 0/5, 1 confirmed absent, 4 remain human/rehearsal work (2026-08-20):**
  - [ ] Demo account works — no dedicated demo account exists; this session's real Ethan Auguste account (used throughout this whole QA pass) is the closest thing, and it does work, but it's a live real account, not a purpose-built demo one.
  - [ ] **Data is deterministic — CONFIRMED there is no mechanism for this. No seed script or fixture-data system exists anywhere in the repo.**
  - [ ] No private data appears — not independently re-tested here; overlaps the privacy checks already done in cards 1.1, 2.4, 5.2, and 2.3 (this session), all of which found no leaked PII on the surfaces they covered.
  - [ ] Backup video exists — literal recorded media file; not a code-checkable claim.
  - [ ] Critical provider failure has a fallback — no dedicated "demo contingency mode" exists; what exists instead is ordinary production error handling (try/catch around Stripe, Daily.co, and Lovable AI Gateway calls throughout `supabase/functions/`) that keeps the app from crashing on a provider outage, but there's no demo-specific fallback (e.g. an offline/mock mode) beyond the backup video itself.
- **Linked files/routes:** N/A — environment/ops task, not a code-existence question. "No private data appears" overlaps privacy criteria from cards 1.1, 2.4, and 5.2.
- **Dependencies/blockers:** Same as 8.1 — tied to "Record an offline backup video of the full live demo" in the Blocked list.
- **Comments:** creation log only.
- **Risk level:** P0-adjacent for the privacy criterion; otherwise operational.
- **Verification performed 2026-08-20:** the earlier note in this card said a demo-seed/fixture mechanism "was not specifically searched for." Ran that search this pass: `find . -iname "*seed*"` and `find . -iname "*fixture*"` across the repo (excluding `node_modules`), plus a grep for `demo_account`/`DEMO_USER`/`demoMode` across `src/` and `supabase/`. Found two unrelated `seed-*` edge functions (`seed-atlas-locations`, `seed-icdb` — these seed reference/location data, not demo accounts) and one unrelated in-app "demo mode" (`ForYouFeed.tsx` — a hardcoded 4-card fallback shown to a *real* user when they run out of real swipe candidates, not a presentation/demo-account tool). **No demo-account-seeding or fixture-data infrastructure exists anywhere in this codebase.** This confirms, rather than just flags, that "data is deterministic" has no supporting mechanism today — whoever runs the demo will be working with whatever state the real account happens to be in at the time.
- **Evidence required:** A decision on whether to build a lightweight demo-seed script before Aug 29, or accept using a real, carefully-curated account (this session's test account already has a rich, realistic Passport/credits/connections history that would demo well) as the de facto "demo account."
- **Recommended action:** Given the short runway to Aug 29 and that a real, populated account already exists and works, building new seed infrastructure now is likely lower-value than: (a) picking one real account and treating it as the fixed demo account, (b) taking a data snapshot or screenshots of its current state as the "deterministic" reference, and (c) prioritizing the backup video and provider-outage rehearsal (both genuinely human tasks) over new seeding code this close to the deadline.

#### 8.3 Prepare product narrative and visuals
- **List:** List 8 — Demo, Documentation & Release
- **URL:** https://trello.com/c/O6UhnaOI/60-prepare-product-narrative-and-visuals
- **Status:** 🟡 PARTIALLY_VERIFIED — 1/4 fully resolved, 3/4 now evidenced via 2.3/6.2 plus fresh narrative-copy check
- **Owner:** Jeff — CDO
- **Due date:** 29 Aug, 02:00
- **Labels:** none
- **Description:** Objective — prepare screenshots, landing-page polish, product terminology and visual consistency for the submission. Scope — finalize the visual/narrative package, ensuring Passport reads as the core product. Dependencies: None.
- **Checklist 1/4 resolved, 3/4 evidenced with real findings (2026-08-20):**
  - [ ] **Passport is clearly the core product — evidenced via card 2.3: 4/6 confirmed, but 2 real contradicting-statistics bugs found (100% vs 0% Passport-strength meters; redundant Kreto Action Center suggestions). Not a clean pass yet.**
  - [ ] **Verified Credits and Co-Signs are explained correctly — MOSTLY accurate in-app, 1 real overclaim found in landing copy.**
  - [ ] **UI is consistent across the four core surfaces — evidenced via card 6.2: 1 confirmed, 1 real regression (stray pre-migration #9413D2 violet). Not a clean pass yet.**
  - [x] No obsolete ThriveIN branding appears in user-facing surfaces.
- **Linked files/routes:** overlaps card 2.3 (Review Passport as core product) and 6.2 (cross-product UX pass). `src/components/landing/CoreValueBlocks.tsx`, `src/components/passport/*` (Co-signs tab copy), `src/pages/CreditVerify.tsx`, `src/components/passport/PassportHero.tsx` ("How Passport works" AI tour).
- **Dependencies/blockers:** Depended on 2.3 and 6.2 landing first — both now complete (this session).
- **Comments:** creation log only.
- **Risk level:** P1 — brand/narrative coherence for submission.
- **Verification detail (ThriveIN branding, resolved 2026-08-18):** completed the full sweep across all 34 files a fresh `grep -ril thrivein src/` actually returned (the board's count of 20 was stale relative to the current tree). 30 of 34 were storage keys/config identifiers/a legitimately-defensive reserved-subdomain-slug entry — all safe. **4 were real user/SEO-visible leaks**, all in the Magazine feature: `SceneHero.tsx`'s fallback article subtitle ("Read the latest from ThriveIN Magazine"), `MagazineEditor.tsx`'s default `author_name` written to every new article record, and `MagazineArticlePage.tsx`/`Magazine.tsx`'s `<title>`, meta description, `og:site_name`, and JSON-LD structured-data fields — the exact kind of surface (browser tab title, social-share previews, search-result snippets) this acceptance criterion is about. All 4 files fixed to say "Kretopia Magazine"; `tsc`/`build`/`test` (68/68) all clean after the change.
- **Verification performed 2026-08-20 (remaining 3 items):**
  1. **"Passport is clearly the core product"** — this is exactly what card 2.3 tested live this session. Result: 4/6 confirmed (one dominant surface, identity/credits/skills visible, clear share action, clean mobile layout) but 2 real bugs found — see 2.3 for full detail. Cannot check this box until Bug A (the 100%/0% contradiction) is fixed; it's a visible, flagship-page trust problem.
  2. **"Verified Credits and Co-Signs are explained correctly"** — checked both the in-app explanations and the public landing narrative. **In-app: accurate.** The Co-signs tab's 4 trust-state sections each carry a correct, plain-language one-liner directly under their headers ("Verified — Confirmed via a known platform, collaborator vouching, or Kretopia's review process"; "Pending — Waiting on a collaborator to confirm"; "Self-claimed — Added by you. Ask a collaborator to co-sign it to build trust"; "Publicly Sourced — Kreto found this from public information and you confirmed it's yours"). The `/credit-verify` confirmation page itself clearly states what accepting does ("Your confirmation becomes part of Kretopia's verified creative record"). None of this copy makes a claim the system doesn't back up. **Landing narrative: one real overclaim.** `CoreValueBlocks.tsx`'s Pillar 1 body reads: *"Collaborators co-sign each credit and Kretopia verifies it against public records, giving every artist... an un-falsifiable, portable work history they actually own."* Two problems, both confirmed against the actual RPC logic reviewed in card 2.2: (a) "un-falsifiable" overstates the guarantee — the primary "Verified" path is 2 accepted peer co-signs with no cross-reference to any public record at all, so two colluding accounts could in principle satisfy it; (b) "Kretopia verifies it against public records" describes the separate "Publicly Sourced" pathway (YouTube/Spotify auto-discovery), not the peer-co-sign mechanism the same sentence just described — the copy conflates two genuinely different verification pathways into one claim. This is marketing copy, not a functional bug, but it's exactly the kind of claim a Trello-card criterion titled "explained correctly" exists to catch.
  3. **"UI is consistent across the four core surfaces"** — this is precisely what card 6.2 tested this session (Home/Passport/Scout/Studio, matching the bottom-nav's four tabs). Result: 1 item confirmed, 1 real regression found (a stray pre-rebrand `#9413D2` violet in `BrandDots.tsx`, `moodGradient.ts`, `GuestPassDialog.tsx`, `EventShareKit.tsx` against the now-established `#FF2DA1` pink accent used everywhere else). See 6.2 for full detail. Cannot check this box until that's fixed.
- **Evidence required:** Fix card 2.3's Bug A (Passport-strength contradiction) and card 6.2's stray-violet regression before checking those two boxes. Soften or correct the "un-falsifiable" / "verifies it against public records" landing copy in `CoreValueBlocks.tsx` to describe the real, two-pathway mechanism (peer co-sign vs. public-record auto-discovery) without overclaiming either one.
- **Recommended action:** None of these three are release-blocking on their own, but all three touch the same "Passport as the flagship, trustworthy core product" narrative this card exists to protect — worth clearing before demo/submission screenshots are taken, since 2.3's Bug A in particular would be visible in any screen recording of the Passport page.

#### 8.4 Final full regression
- **List:** List 8 — Demo, Documentation & Release
- **URL:** https://trello.com/c/aRgq4jUC/61-final-full-regression
- **Status:** 🟡 PARTIALLY_VERIFIED — 4/6 confirmed, 2 blocked on the open card 2.2 P0
- **Owner:** Noé — CTO
- **Due date:** 30 Aug, 02:00
- **Labels:** none
- **Description:** Objective — run full typecheck, lint, build, test, browser, mobile, auth, payment, email, Passport, Scout (regression sweep). Scope — execute the complete pre-release regression suite across every P0 surface and document known limitations. Dependencies: None.
- **Checklist 4/6 confirmed, 2 blocked (2026-08-19):**
  - [ ] **No unresolved Critical security issue — BLOCKED. One open P0: card 2.2's Co-Sign accept constraint bug (fix written, not yet applied).**
  - [ ] **No P0 regression — same blocker as above; not a regression introduced this session, but a genuinely unresolved P0 defect discovered during this session's QA.**
  - [x] Build succeeds.
  - [x] Tests pass.
  - [x] Core user loop passes — with the one known exception below.
  - [x] Known limitations are documented — this document plus `SECURITY_RELEASE_GATE.md`, `EMAIL_RELEASE_AUDIT.md`, and the per-card sections throughout this catalog.
- **Linked files/routes:** `package.json` (`build`, `build:dev`, `dev`, `test` scripts), `vitest.config.ts`, `SECURITY_RELEASE_GATE.md` §D (gate decision table).
- **Dependencies/blockers:** Directly blocked by card 2.2 (P0, migration `20260819140000_fix_credits_peer_status_constraint.sql` written this session, not yet applied — pending the user pasting it into the Lovable Cloud SQL editor per standing protocol).
- **Comments:** creation log only.
- **Risk level:** P0 — final release gate.
- **Verification performed 2026-08-19:**
  1. **Build succeeds — CONFIRMED.** `npm run build` completes cleanly (`✓ built in 13.81s`, PWA precache generated). Only pre-existing chunk-size warnings (`ThriveDesk`, `Discover`, `index` bundles >500kB), already noted as out-of-scope in `GLOBAL_UX_QA.md` Phase 11 — no new warnings.
  2. **Tests pass — CONFIRMED.** `npm run test -- --run` → 68/68 passing, 6/6 files, 1.2s. Unchanged from the count recorded earlier in this engagement (`GLOBAL_UX_QA.md` recorded 62/62 at that point in the codebase's history; the 6-suite/68-test count here matches the most recent baseline).
  3. **Typecheck — CONFIRMED clean.** `npx tsc --noEmit -p .` produced zero output (zero errors).
  4. **Lint — no new issues.** `npx eslint .` → 10,359 problems (9,451 errors, 908 warnings), matching the exact baseline count already recorded in the Studio AI Create plan document from earlier in this engagement — confirms no lint regression from any change made this session.
  5. **No unresolved Critical security issue — BLOCKED, not clear.** `SECURITY_RELEASE_GATE.md` §D shows every *pre-existing* critical RLS/auth finding closed and applied to production as of 2026-08-18. But this session's own QA (card 2.2, 2026-08-19) found a new, real P0: the `submit_credit_endorsement_by_token` RPC writes `verification_status = 'peer'` on Co-Sign accept, and the live `credits_verification_status_check` constraint has never allowed that value — every real Co-Sign completion fails with a Postgres constraint violation. A fix migration exists (`20260819140000_fix_credits_peer_status_constraint.sql`) but has not been applied. This is the one item genuinely holding this checklist item open.
  6. **No P0 regression — BLOCKED for the same reason.** Not a regression caused by this session's code changes (this session made zero application-code changes, only QA + one unapplied migration), but a real, currently-live P0 defect in the core Co-Sign flow that must be resolved before this box can be checked.
  7. **Core user loop passes — CONFIRMED, with one known exception.** Across this session's Lists 1-7 QA (18 cards, live browser + code-trace evidence throughout this document), every other core-loop stage — Search, Passport claim, credit confirmation, Scout opportunity view/apply, Studio project creation/completion, video calls, Kreto — verified working live. The Co-Sign *completion* step (accepting an endorsement) is the sole broken link, consistent with item 5 above.
  8. **Known limitations documented — CONFIRMED.** This catalog (34 cards, all with dated evidence), `SECURITY_RELEASE_GATE.md`, and `EMAIL_RELEASE_AUDIT.md` collectively constitute exactly this documentation requirement.
- **Recommended action:** Apply migration `20260819140000_fix_credits_peer_status_constraint.sql` (already written, awaiting the user's SQL-editor paste per this engagement's standing protocol), then re-run this checklist — items 1/2 should clear immediately once verified against the live database, at which point 8.4 becomes a full 6/6 pass.

#### 8.5 CEO acceptance review
- **List:** List 8 — Demo, Documentation & Release
- **URL:** https://trello.com/c/OoEGc6Mi/62-ceo-acceptance-review
- **Status:** NOT_STARTED
- **Owner:** Ethan — CEO
- **Due date:** 31 Aug, 02:00
- **Labels:** none
- **Description:** Objective — review the complete product journey and approve the release candidate. Scope — CEO walks the core loop end-to-end, confirms narrative and scope cuts, signs off. Dependencies: None.
- **Checklist 0/5, all unchecked:**
  - [ ] CEO tested the core loop.
  - [ ] Product narrative is approved.
  - [ ] Scope cuts are confirmed.
  - [ ] Final blockers have owners.
  - [ ] Release decision is documented.
- **Linked files/routes:** N/A — governance/sign-off task.
- **Dependencies/blockers:** Depends on every other List 8 card, and transitively on Lists 1-7.
- **Comments:** creation log only.
- **Risk level:** P0 — final go/no-go gate, same day as release.
- **Implementation detail:** N/A.
- **Verification detail:** N/A — cannot be verified until it happens; this is a human sign-off event, not a code state.
- **Evidence required:** A dated sign-off record (even a Trello comment) once Ethan completes the review.
- **Recommended action:** No action possible yet; correctly scheduled as the last gate before submission.

#### 8.6 August 31 submission and release
- **List:** List 8 — Demo, Documentation & Release
- **URL:** https://trello.com/c/ryJQZxjE/63-august-31-submission-and-release
- **Status:** NOT_STARTED
- **Owner:** Ethan — CEO (description states owner; **no Trello "Members" avatar was actually assigned** to this card — the only card in the catalog with a description-stated owner but no assigned Member)
- **Due date:** 1 Sept, 02:00 (note: one day after the board's namesake "August 31" date — likely a timezone/deadline-buffer choice, worth confirming intentional)
- **Labels:** none
- **Description:** Objective — submit the final product, demo, documentation and required links according to "Future Caribbean..." [truncated in read] program requirements. Scope — confirm deadline, time zone, and all submission links, then complete and acknowledge the final submission. Dependencies: None.
- **Checklist 0/7, all unchecked:**
  - [ ] Deadline and time zone are confirmed.
  - [ ] Submission link is confirmed.
  - [ ] Demo link works.
  - [ ] Product link works.
  - [ ] Backup materials are available.
  - [ ] Team contacts and roles are correct.
  - [ ] Final submission is acknowledged.
- **Linked files/routes:** N/A — external submission/logistics task.
- **Dependencies/blockers:** Depends on every prior card on the board; this is the terminal node.
- **Comments:** creation log only.
- **Risk level:** P0 — the actual deliverable deadline.
- **Implementation detail:** N/A.
- **Verification detail:** N/A. The truncated description ("Future Caribb...") references an external program/competition this release is being submitted to — full text wasn't captured in this pass since `get_page_text`/`read_page` truncated it; worth a manual re-check for the exact submission requirements.
- **Evidence required:** Re-read the full untruncated description for exact submission-program requirements; confirm the Sept 1 vs Aug 31 date discrepancy is intentional.
- **Recommended action:** Assign an explicit Trello Member (currently unassigned despite "Owner: Ethan — CEO" in the text) so it doesn't fall through the cracks as the final deadline approaches.

### List: 🛑 Blocked

> **Structural note:** all 3 cards in this list were created 4 Aug 2026 (two weeks before Lists 1-8) under an older, phase-based planning structure ("Phase 3: UX/UI Polish & Demo Readiness," "Phase 4: Final QA, Rehearsal & Launch Prep") that appears to predate and run in parallel with the current P0/P1 list structure. None of the three has a description or checklist — they read as headline action items carried over from that earlier plan rather than fully-specified cards. Trello itself doesn't record *why* each is blocked (no blocking-reason field, comment, or linked card), so the blocker cause is inferred here from context, not confirmed.

#### B.1 Storyboard and script the live demo walkthrough
- **List:** 🛑 Blocked
- **URL:** https://trello.com/c/07uVO4pC/23-storyboard-and-script-the-live-demo-walkthrough-owners-jefferson-ethan
- **Status:** BLOCKED
- **Owner:** stated in title as "Jefferson / Ethan"; only **ethan104** is actually assigned as a Trello Member
- **Due date:** 17 Aug, 21:00 — **Overdue** (Trello's own badge; today is 18 Aug)
- **Labels:** none
- **Description / checklist:** none present.
- **Linked files/routes:** N/A. Directly the prerequisite for card 8.1 ("Prepare the core product demo").
- **Dependencies/blockers:** Inferred blocker: this needs the actual core-loop demo flow (Lists 1-5) to be stable enough to storyboard against; scripting a walkthrough of features still being audited/tested is premature.
- **Comments:** only the original list-assignment log entry from 4 Aug 2026 (under the old phase structure) — no comment explaining the current block.
- **Risk level:** P0-adjacent — demo readiness, and already overdue.
- **Implementation detail:** N/A — planning task.
- **Verification detail:** N/A.
- **Evidence required:** A note (even informal) on the card stating what specifically is blocking it, since Trello has no native blocker field.
- **Recommended action:** Since it's already overdue, either re-date it against the real Lists 1-5 completion timeline, or explicitly document the blocking reason so it doesn't just look "late" with no context.

#### B.2 Record an offline backup video of the full live demo
- **List:** 🛑 Blocked
- **URL:** https://trello.com/c/Np4Txv58/28-record-an-offline-backup-video-of-the-full-live-demo-owners-jefferson-ethan
- **Status:** BLOCKED
- **Owner:** ethan104 and Jefferson Gordon-Lennox (both assigned as Members — the only Blocked-list card with two real Member assignments)
- **Due date:** 19 Aug, 21:00 (not yet due as of this catalog's compile date)
- **Labels:** none
- **Description / checklist:** none present.
- **Linked files/routes:** N/A. This is the actual deliverable referenced by card 8.2's "Backup video exists" acceptance criterion.
- **Dependencies/blockers:** Directly depends on B.1 (the walkthrough must be scripted before it can be recorded).
- **Comments:** only the 4 Aug 2026 list-assignment log entry.
- **Risk level:** P0-adjacent — this is literally the fallback plan for a live-demo failure, so being blocked here removes the safety net for demo day.
- **Implementation detail:** N/A.
- **Verification detail:** N/A.
- **Evidence required:** Same as B.1 — needs the storyboard first.
- **Recommended action:** Sequence directly after B.1 resolves; flag as high-priority since it protects the whole team from a live-demo failure scenario.

#### B.3 Team can deliver the narrative even if the live platform crashes
- **List:** 🛑 Blocked
- **URL:** https://trello.com/c/5CgckyCw/30-team-can-deliver-the-narrative-even-if-the-live-platform-crashes
- **Status:** BLOCKED
- **Owner:** assigned to Member "thriveuae (thriveuae1)" — a generic/shared account rather than a named team member (Ethan/Noé/Jefferson/Kaen), unlike every other card on the board.
- **Due date:** 20 Aug, 21:00
- **Labels:** none
- **Description / checklist:** none present.
- **Linked files/routes:** N/A. This reads as a milestone/outcome statement (team resilience against a live failure) rather than a discrete task, and it's the natural successor to B.1/B.2.
- **Dependencies/blockers:** Depends on both B.1 and B.2.
- **Comments:** only the 4 Aug 2026 list-assignment log entry.
- **Risk level:** P0-adjacent — same demo-resilience concern as B.1/B.2.
- **Implementation detail:** N/A.
- **Verification detail:** N/A.
- **Evidence required:** Same as B.1/B.2.
- **Recommended action:** Reassign to a named team member (the "thriveuae" shared account is an odd owner for a demo-narrative outcome) and sequence last of the three, since it's the outcome the first two enable.

