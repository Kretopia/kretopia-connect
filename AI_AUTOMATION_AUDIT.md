# Kretopia AI Automation Audit — Kreto & the Orchestration Layer

Scope: read-only audit of every AI-driven automation surface in the app, checked against the
product's core safety rule:

> AI must NEVER silently publish a credit, verify a contribution, send a message, send an email,
> create a payment, release funds, invite a user, change a milestone, alter a Passport, or expose
> private info — every AI action must follow: **AI suggests → User reviews → User edits/confirms →
> System executes → Action receipt displayed.**

This session did not re-verify `src/pages/KretoTab.tsx` or `src/components/passport/PassportHero.tsx`
(confirmed gated in an earlier pass) except where directly relevant to a new surface.

---

## Summary table

| # | Surface | Found? | Confirmation-gated? | Severity of gap |
|---|---|---|---|---|
| — | Shared orchestrator (`orch_actions`/`AgentApprovalCard`) | Yes | Yes, by design (risk tiers) | none (design is sound) |
| 1 | Passport understanding | Partial (via KretoTab chat context; no dedicated "summarize my Passport" surface) | Yes (KretoTab, previously verified) | none new |
| 2 | Bio drafting | Yes — `KretoPassportBuilder.tsx` (live) + orphaned `AIProfileEnhancer.tsx` (dead code) | Yes (live path) / n/a (dead path) | none (live path already verified) |
| 3 | Skill suggestions | Yes — `KretoPassportBuilder.tsx` | Yes | none |
| 4 | Credit organization | Yes — `DiscoveriesInbox.tsx` + `discovered_credits` inbox | Yes, per-item + bulk confirm | none — exemplary pattern |
| 5 | Evidence explanation | Yes — `verify-credit` edge fn + `credit_ai_verifications` | **No** — fires automatically, no approval card | **Major** (see Cross-cutting #1) |
| 6 | Co-Sign suggestions | Not found (no AI-driven "who should co-sign" recommender) | n/a | none (absence, not a gap) |
| 7 | Opportunity matching + reasoning | Yes — `generate-match-explanation`, `ai-talent-match`, `sponsor-radar`, `scout-leads` | Yes for actions (send/DM gated); reasoning itself is read-only | Minor (fabricated fallback score, see §7) |
| 8 | Brief-to-project | Yes — `extract-brief`, `elevate-brief` | Yes (frontend review step before insert) | none found |
| 9 | Brief-to-task | Yes — `voice-to-task`, `enhance-task` | Yes (`VoiceTaskCapture.tsx` has explicit review phase) | none found |
| 10 | Milestone suggestions | Yes — `scope-guardian` (`generate_milestones`) | Yes for creation; **no ownership check on read** | Moderate (IDOR, see §10) |
| 11 | Meeting summaries | Yes — `transcribe-call`, `speed-session-recap` | Not deeply re-verified this pass | not assessed in depth |
| 12 | Next-action recommendations | Yes — `agent_proposals` + `SurfaceProactiveCards`/`ProactiveCards` | Yes — accept only navigates, never executes | none — exemplary pattern |
| 13 | Today command center | Yes — `TodayThreeCards.tsx` + surface-agent-watch | Yes (deterministic, navigation-only) | none |
| 14 | Email drafting | Yes — `draft-outreach-email`, `send-outreach-draft` split | Yes — draft/send are separate tools, send is `requires_approval` | none |
| 15 | Project status summaries | Yes — `get_project_summary` in `desk-agent` | Yes (read-only, access-checked) | none |

**Headline finding:** surface **#5 (Evidence explanation / credit verification)** is the one AI
action in this codebase that writes a value driving a public-facing **"Verified"** badge with no
user confirmation step, and it is inconsistently labeled between two components. Details in
Cross-cutting findings.

---

## Shared orchestration layer

### Tables & lifecycle
The core pattern lives in Postgres tables created in `supabase/migrations/20260501201445_*.sql`:

- `orch_tool_registry` — catalog of every tool the orchestrator can call, each with a
  `risk_level` enum: **`safe_auto`** (executes immediately), **`requires_approval`** (queued,
  needs a user tap), **`locked`** (never executes — e.g. `charge_card`).
- `orch_runs` — one row per user intent (`status`: `running` → `awaiting_approval` /
  `completed`).
- `orch_actions` — one row per proposed tool call (`status`: `proposed` → `approved`/`rejected`
  → `executed`/`failed`, or `auto_executed` for `safe_auto` tools). This is the audit trail.
- `orch_approvals` — append-only log of each user decision (`decision`, `edited_args`, `note`).
- `orch_settings` — per-user kill switch (`agents_enabled`) and `daily_action_limit`.

Source: `supabase/functions/agent-orchestrator/index.ts:1-17` (header comment), tables defined in
`supabase/migrations/20260501201445_1e56ef9e-a9dd-4d68-adb7-c12d6ed84af3.sql:1-171`.

### Approval-card UI pattern
- `src/hooks/usePendingAgentActions.ts:10-57` subscribes (Supabase Realtime) to the caller's own
  `orch_actions` rows where `status = 'proposed'`.
- `src/components/agent/AgentApprovalCard.tsx:23-160` renders each one with an explicit
  **Approve** / **Dismiss** pair (lines 127-155); nothing executes until `handle("approved")` is
  clicked, which calls `decideAgentAction` (`src/lib/agentOrchestrator.ts`), which round-trips to
  `agent-orchestrator` with `{ action_id, decision }`.
- Server-side, `agent-orchestrator/index.ts:631-710` is the only code path that flips a
  `requires_approval` action from `proposed` to `executed` — and it only runs after it reads back
  `action.status !== "proposed"` guard (line 645) to block double-execution/replay.
- `src/lib/agentRiskUI.ts:13-35` renders a risk pill ("Low risk" / "Needs approval" / "Locked")
  and a plain-English description next to every action so the user isn't parsing tool names.

### Is every surface routed through this pattern?
**No — three distinct patterns coexist**, and only one of the three is fully my-data-only,
review-gated by construction:

1. **`orch_actions` / `AgentApprovalCard`** (agent-orchestrator, desk-agent, copilot-collaborator-tools) —
   tiered `safe_auto`/`requires_approval`/`locked`, explicit approve/dismiss UI, full audit trail.
   Used by: DM sends, collaborator add/remove, project archive/delete, credit publish, event
   RSVP/invites, payment links, vouching (`vouch_credit`), memory deletes.
2. **`agent_proposals` / `ProactiveCards` & `SurfaceProactiveCards`** (desk-agent-watch,
   surface-agent-watch) — a *lighter-weight, read-only* proposal channel. Accepting a card never
   executes a side effect itself — `ProactiveCards.tsx:134-164` and
   `SurfaceProactiveCards.tsx:114-132` both just flip `agent_proposals.status` to `accepted` and
   **navigate** the user to the relevant tab, where the real action still requires its own confirm
   step (e.g. actually clicking "Send" on a draft invoice). This is a *sound* pattern, just
   structurally separate from `orch_actions`.
3. **Ad-hoc, no ticket at all** — several surfaces fire a Supabase Edge Function directly from a
   React event handler with **no `orch_actions` row, no approval card, and no audit trail**:
   - `verify-credit` (fires automatically after every credit insert — see Cross-cutting #1)
   - `generate-bio`, `generate-match-explanation`, `voice-to-task`, `enhance-task`,
     `extract-brief`, `elevate-brief`, `scope-guardian` (all pure "generate text/JSON, let the
     user review before saving" calls — safe as long as the frontend actually gates the save,
     which in every case checked here it does)

So: **destructive/outbound actions correctly funnel through `orch_actions`; read-only/creative
drafting tools mostly bypass it (fine, since nothing is saved without a separate explicit save
click); one function (`verify-credit`) bypasses it and also writes state that visibly changes
what other users see.**

---

## Surface-by-surface findings

### 1. Passport understanding
No dedicated "Kreto reads and summarizes your Passport" surface was found (searched
`PassportInsight`, `PassportSummary`, `PassportAnaly*`, "passport.*understand" across `src/` and
`supabase/functions/` — no matches). The closest things are:
- `infer-passport-profession` (`supabase/functions/infer-passport-profession/index.ts:1-45`) —
  classifies a profile into one of 9 layout archetypes (model/photographer/musician/etc.) for
  *rendering* purposes, not a user-facing summary.
- KretoTab's general chat (`src/pages/KretoTab.tsx:83-94`) loads the caller's own `profiles` row
  (`.eq("user_id", user.id)`) as context — correctly scoped to self, previously confirmed gated.

**Verdict:** not found as a standalone surface; nothing new to flag.

### 2 & 3. Bio drafting / Skill suggestions
Live, gated implementation: `src/components/passport/KretoPassportBuilder.tsx`.
- Input: `role`, `existingBio`, and `confirmedCredits` (already user-approved, per its own header
  comment at lines 27-42).
- Calls the `generate-content` edge function to draft bio text and suggest skills
  (`KretoPassportBuilder.tsx:36-42` comment references this).
- Output: freeform bio string + string array of skills, shown in an **editable review** stage
  (component state `stage: "building" | "review"`, line 51).
- Confirmation: `onConfirm` only fires on explicit user click (prop doc at line 21: *"Called only
  when the user explicitly confirms the drafted content"*) — matches the safety rule exactly.

**Dead code found:** `src/components/profile/AIProfileEnhancer.tsx` (236 lines) implements the
same bio/skills generation UX calling `generate-content` directly, and its `onBioGenerated` /
`onSkillsGenerated` callbacks bubble straight up to whatever parent renders it — but **it is not
imported or mounted anywhere in the app** (`grep -rn "profile/AIProfileEnhancer" src/` returns no
import sites). Not a live risk today; flagged only so it isn't accidentally wired up later without
adding its own confirm step (the component itself has no save button — it hands raw AI output
straight to its caller via callback with no review UI of its own).

### 4. Credit organization
Best-designed surface in the app: `src/components/profile/DiscoveriesInbox.tsx`.
- Input: the caller's own `discovered_credits` rows (`user_id` filter at line 59).
- Evidence labeling is deliberately conservative — `evidenceLabel()` (lines 36-40) returns only
  `"Publicly Sourced"` or `"Potential"`, **never** `"Verified"`. The code comment at lines 32-35
  states the policy explicitly: *"Nothing here is ever 'Verified Credit' — that only happens
  through real verification (organization confirmation / co-sign / authoritative source), never
  through the user just confirming an AI-found guess is theirs."*
- Confirmation: per-item **"Add to credits"** / **"Not me"** buttons (lines 268-291) call
  `approve_discovered_credit` / `dismiss_discovered_credit` RPCs; a bulk "Add selected credits"
  path (lines 105-121) does the same per-item, just batched — no silent auto-add.

**Verdict:** exemplary; this is the pattern the rest of the app should be held to (see #5).

### 5. Evidence explanation — **the audit's most important finding**
`supabase/functions/verify-credit/index.ts` is a background "plausibility check" that:
- Sends the credit's `project_name`/`role`/`year`/`platform` to an LLM and asks it to guess
  `confidence` (0-1) and a `status` of `"verified"` if confidence ≥ 0.7 (system prompt,
  lines 49-55) — the model has **no web access, no ICDB lookup, no evidence source**; it is
  purely judging plausibility of freeform text.
- Writes that result via **service-role key** (bypasses RLS) into `credit_ai_verifications`
  (upsert, lines 84-96) **and** updates `credits.ai_confidence` (lines 101-104) directly —
  with **no approval card, no `orch_actions` row, no way for the user to review or reject it**.
- **Fires automatically**, not on any explicit "verify this" click, from three separate call
  sites the instant a user adds a credit:
  - `src/components/profile/CreditsSection.tsx:107-118` ("Trigger AI verification in background")
  - `src/components/profile/UnifiedWorkHistory.tsx:251-255`
  - `src/components/profile/ICDBCreditForm.tsx:459-469`
- **No ownership check**: the function never confirms the `credit_id` in the request body
  belongs to the caller (compare to `copilot-collaborator-tools`, which does this correctly for
  every project mutation). It is not listed in `supabase/config.toml`'s `verify_jwt = false`
  block, so the Supabase gateway still requires *a* valid session — but **any** logged-in user can
  call `verify-credit` with **any other user's `credit_id`** plus arbitrary
  `project_name`/`role`/`year` text, and the function will happily upsert an AI verification
  record and overwrite that credit's `ai_confidence` using the attacker-supplied (not DB-sourced)
  project details. This is a real IDOR, not just a theoretical one.
- **Consequence for the badge:** `src/components/profile/ICDBTimeline.tsx:270-286`
  (`getVerificationBadge`) renders a **"Verified"** badge (ShieldCheck icon, just a different
  border color) when `credit.ai_confidence >= 0.7` — **visually and textually indistinguishable
  in label from** the badge shown when a credit has genuine human `verification_status ===
  'verified'` (lines 271-277 vs 279-285 — both literally say "Verified"). `ICDBTimeline.tsx` is
  mounted on the public profile view (`src/pages/ViewProfile.tsx` → `ViewProfileTabs.tsx` →
  `ICDBTimeline.tsx`), i.e. **every visitor to a user's Passport sees this badge**, not just the
  owner.

This directly contradicts the product's own stated policy (the same policy is correctly encoded
in `DiscoveriesInbox.tsx`'s `evidenceLabel()`, which explicitly refuses to ever say "Verified" for
an AI guess) and the core safety rule's "AI must never silently... verify a contribution."

**By contrast**, two other places in the codebase get this right and should be the reference
implementation:
- `src/pages/CreatorEPK.tsx:702-708,757-763` labels the same `ai_confidence`-derived tier as
  **"AI"** (distinct pill, distinct color) — never "Verified".
- `src/components/circle/CreatorBrowseGrid.tsx` only ever gates its "Verified" badge/filter on
  `verification_status === 'verified'` (lines 169, 389, 671, 750), ignoring `ai_confidence`
  entirely for badge purposes.

So the bug is localized to `ICDBTimeline.tsx`'s `getVerificationBadge()`, but because that
component is the main profile credit list, its exposure is high.

### 6. Co-Sign suggestions
No AI-driven "who should co-sign this / here are likely collaborators to ask" recommender was
found. `request_vouch` (tool registry, `requires_approval`, handler `send-credit-invite`) and the
`vouch_credit` tool require the caller (or the LLM planner) to already have a `collaborator_id` —
there is no ranking/suggestion model behind it. `src/components/profile/CreditVerificationPanel.tsx`
and `CoSignsSection.tsx` contain no AI/"suggest" logic (`grep` for `suggest|recommend|AI` in
`CreditVerificationPanel.tsx` returns nothing). Human-initiated invite flow
(`src/components/profile/ICDBCreditForm.tsx:483-507` → `send-credit-invite` edge function) is
user-typed-names-only and correctly treated as a normal user action (the user fills in an actual
name/email and clicks Add Credit — not an autonomous AI decision), so it is out of scope for the
"AI silently emails someone" concern even though it does send email.

**Verdict:** not found. Reporting as a plain absence, not a gap.

### 7. Opportunity matching + reasoning
Several independent implementations:
- `supabase/functions/generate-match-explanation/index.ts` — takes `currentUser`/`targetUser`
  JSON **supplied directly by the client** (not re-fetched server-side from the DB by ID), so
  there's no additional privacy exposure beyond what the client's own RLS-governed query already
  returned (`src/components/discover/MatchExplanationDialog.tsx:56-71` fetches both profiles via
  normal `supabase.from('profiles')` calls first). No auth check in the function itself
  (`grep` for `Authorization|getUser|getClaims` returns nothing) but the function is not in
  `config.toml`'s `verify_jwt=false` list, so the gateway still requires a session.
  - **Confidence/evidence integrity gap:** the system prompt hard-codes *"Score must be 70-99
    (high matches only)"* (line 60) — the model is structurally forbidden from ever returning a
    low or mismatched score, so the number shown is not a real discriminator, just a flavor
    label.
  - **Deceptive failure fallback:** on any error (rate limit aside), the function catches and
    returns **HTTP 200** with a fabricated `{ score: 85, reasons: [4 generic strings] }`
    (lines 160-176) — indistinguishable from a genuine response. The frontend
    (`MatchExplanationDialog.tsx:88-99`) has its own separate `catch` with its own separate
    generic fallback reasons, and defaults `score` to `85` in three different places
    (lines 46, 89, and the server's own fallback). A user has no way to tell "Perfect Match 85%"
    apart from "the AI call silently failed twice and this is a canned placeholder."
- `sponsor-radar` (`find_sponsors` tool, `safe_auto`) and `scout-leads` (`research_web` tool,
  `safe_auto`) — both persist leads to `sponsor_leads` for the user to review in Intel; no
  outbound contact happens automatically (drafting ≠ sending is enforced by tool-registry
  separation, e.g. `send_outreach_email` is `requires_approval`).
- `ai-talent-match/index.ts:15-27` — validates the caller's JWT via `supabase.auth.getUser(token)`
  before doing anything, a good pattern.

### 8. Brief-to-project
`supabase/functions/extract-brief/index.ts` — accepts text/CSV/Google-Sheet/doc/audio, returns a
fixed `{ project: { title, summary }, deliverables: [...] }` shape (header comment, lines 1-9) for
the **frontend to review and bulk-insert** — no direct DB write in the function itself (it's a
pure extractor). Frontend surfaces: `SmartBriefBuilder.tsx`, `BriefHub.tsx`,
`VoiceFirstCreateModal.tsx`, `CreateProjectWizard.tsx` — not individually re-audited line-by-line
this pass, but the edge function's own contract (return structured data, no DB access) makes a
silent-write bypass structurally unlikely from this function alone.

### 9. Brief-to-task
`supabase/functions/voice-to-task/index.ts` and `enhance-task/index.ts` are both stateless
text/audio-in, JSON-out transformers with **no Supabase client at all** (no DB read/write
capability exists in either file), so there's no privacy-scoping question — they cannot leak
another user's data because they never query the database.
`src/components/project/mobile/VoiceTaskCapture.tsx` has an explicit `"review"` phase
(line 35, entered at line 140) before the actual `project_tasks` insert (line 250) — user sees
the extracted task(s) and must act before anything is saved.

### 10. Milestone suggestions
`supabase/functions/scope-guardian/index.ts`, action `generate_milestones` (case at line 103).
- Confirms the caller's identity via `supabase.auth.getUser(token)` (lines 22-28) — good.
- **But then reads `projects` and `milestones` by a client-supplied `projectId` with no
  ownership/membership check** (lines 44-68: `.from('projects').select(...).eq('id', projectId)`,
  no `.eq('created_by', user.id)` or `user_has_project_access` RPC anywhere in this file —
  confirmed by grep). Compare to `desk-agent/index.ts:409-419`, which calls
  `admin.rpc("user_has_project_access", { project_id_param, user_id_param: user.id })` and
  403s if it fails — `scope-guardian` has no equivalent gate.
- Practical exposure: an authenticated user who supplies (or guesses) another user's
  `projectId` can get back that project's title, description, status, and **existing milestone
  titles/descriptions/dollar amounts**, folded into the AI's response. This is a genuine IDOR,
  moderate severity (requires knowing/guessing a UUID, but nothing server-side stops it).
- No direct DB write happens in `generate_milestones` itself — it returns JSON for the frontend to
  review, so the "silently changes a milestone" rule is not violated by this function; the
  violation here is read-side (privacy boundary), not write-side.

### 11. Meeting summaries
`supabase/functions/transcribe-call/index.ts` (615 lines) and
`supabase/functions/speed-session-recap/index.ts` (173 lines) exist and are wired to
`src/pages/Recordings.tsx`, `src/components/calls/RecentRecordingsRail.tsx`, and
`src/components/project/VideoCallSheet.tsx`. Given the scope of this audit, these were located and
confirmed to exist but **not deeply re-verified line-by-line** for confirmation-gating in this
pass — flagging as "found, not fully assessed" rather than asserting a specific gap.

### 12. Next-action recommendations
Two parallel, well-built implementations, both **read-only until the user clicks through**:
- Project-scoped: `desk-agent-watch/index.ts` writes to `agent_proposals`
  (`ALLOWED_KINDS`: `draft_invoice`, `schedule_followup`, `next_milestone`, `wrap_project`,
  `collab_nudge`, lines 19-25), gated behind a **subscription-tier check**
  (`creator_pro`/`founder`/`brand_enterprise` only, lines 72-84) and a 30-min throttle
  (lines 86-96). Rendered by `src/components/project/studio/ProactiveCards.tsx`; `handleAccept`
  (lines 134-164) only flips `agent_proposals.status` and navigates — no side effect fires from
  the card itself.
- Cross-surface: `surface-agent-watch/index.ts` — fully **deterministic** (no LLM call at all;
  see `computeStrength()` at line 273 and the plain SQL-driven rules for `passport_polish`,
  `gig_match`, `rate_optimize`, `pay_cashflow`, `frequent_collaborator`), scoped to
  `user.id` on every query (lines 83-238 — every table read filters `.eq("user_id", user.id)` or
  equivalent owner column). Rendered by `SurfaceProactiveCards.tsx`; same accept-only-navigates
  pattern (lines 114-132).

### 13. Today command center
`src/components/home/TodayThreeCards.tsx` — click handlers only call `navigate(c.to)`
(line 207); no `supabase.functions.invoke`/insert/update calls found in the component. Backed by
the same deterministic `surface-agent-watch` described above for surface #12. Not re-auditing
`ThrivePromptHero.tsx` in depth per the task's instruction (already covered as routing natural
language into the gated orchestrator flow).

### 14. Email drafting
`supabase/functions/draft-outreach-email/index.ts` (previously partially read this session) and
its sibling `send-outreach-draft` are registered as **two separate tools** in
`orch_tool_registry`: `draft_outreach_email` is `safe_auto` (writes a draft only), while sending
(`send_outreach_email` / `send_outreach_draft`) is `requires_approval`
(`supabase/migrations/20260509151944_eb41e694-da9f-488f-be21-4fa8f995190f.sql:47-52`). Also
`auto-outreach-watch/index.ts` (a scheduled watcher) only ever calls `draft-outreach-email` and
writes to `outreach_drafts` with `status: "draft"` (lines 51-56, 73-92) plus a notification — it
never calls a send function. Drafting and sending are cleanly separated everywhere this was
checked.

### 15. Project status summaries
`get_project_summary` in `desk-agent/index.ts:667-678` — purely reads already-fetched,
access-checked project data (`openTasks`, `overdue`, `collaborators`, `project.status`) and
returns counts; no LLM call, no write. Access to the underlying project is gated earlier in the
same request by `admin.rpc("user_has_project_access", ...)` (lines 409-419) — this is the correct
pattern that `scope-guardian` (surface #10) is missing.

---

## Cross-cutting findings

### The one AI action that fires a side effect without user confirmation, by name

**`verify-credit`** (`supabase/functions/verify-credit/index.ts`), triggered automatically from
`CreditsSection.tsx`, `UnifiedWorkHistory.tsx`, and `ICDBCreditForm.tsx` immediately after any
credit insert. It writes `credits.ai_confidence` and upserts `credit_ai_verifications` with **no
approval card, no `orch_actions` row, and no way for the user to see or reject the AI's plausibility
judgment before it takes effect** — and that value then drives a public **"Verified"** badge shown
to every visitor of the credit owner's Passport via `ICDBTimeline.tsx`'s `getVerificationBadge()`
(lines 270-286). This is the one place in the app where "AI verifies a contribution" happens
exactly as the safety rule says it must never happen: silently.

Two mitigating facts, for calibration: (a) the badge mislabeling is localized to one component —
`CreatorEPK.tsx` and `CreatorBrowseGrid.tsx` both handle the same underlying data correctly
(label it "AI" or ignore it for "Verified" purposes); (b) the codebase's own `DiscoveriesInbox.tsx`
shows the team already knows and has implemented the correct policy elsewhere ("Nothing here is
ever 'Verified Credit'... never through the user just confirming an AI-found guess"). This reads as
a localized regression/inconsistency rather than an intentional design choice — which makes it
straightforward to fix by making `ICDBTimeline.tsx`'s badge match `CreatorEPK.tsx`'s tiering.

### Secondary finding: IDOR-style authorization gaps (read-side, not write-side)

Two edge functions validate that the caller is *a* logged-in user but never check that the
resource ID in the request belongs to that user:
- `verify-credit` — no check that `credit_id` belongs to the caller; combined with using the
  service-role key, any authenticated user can plant fabricated AI verification data
  (using client-supplied, not DB-sourced, project details) against **any other user's** credit.
- `scope-guardian` (`generate_milestones` / `analyze_brief` / `check_scope_drift` actions) — no
  check that `projectId` belongs to or is shared with the caller; an authenticated user who
  knows/guesses another user's project UUID can pull that project's title, description, status,
  and milestone amounts into the AI's context and response.

Both are moderate rather than critical: they require a valid platform login (gateway-level
`verify_jwt` defaults to `true` for both — neither appears in `supabase/config.toml`'s
`verify_jwt = false` block) and, for `scope-guardian`, a correctly guessed UUID. Neither allows a
DB write to someone else's `credits.verification_status`, milestones, or payments — the exposure is
information disclosure (`scope-guardian`) and corruption of a secondary AI-confidence field
(`verify-credit`), not the primary trust/payment state.

### Everything else checked holds up well

Every other automation surface reviewed in depth — the `orch_actions` approval-card pipeline
(collaborator add/remove, project archive/delete, DM send, event RSVP/invite, credit vouch/publish,
memory delete), the `agent_proposals` proactive-nudge pipeline (home/scout/pay/passport surfaces
and Studio nudges), `DiscoveriesInbox.tsx`'s credit-organization inbox, `VoiceTaskCapture.tsx`'s
review phase, and `desk-agent`'s project-scoped tools — correctly separates **AI suggests** from
**system executes**, with a real audit trail (`orch_actions`/`orch_approvals`) for the
higher-risk tier and consistent per-user/per-project ownership checks (`user_has_project_access`,
`created_by === userId` checks in `copilot-collaborator-tools`). `agent-send-dm`,
`agent-vouch-credit`, and `agent-rsvp-event` are thin, trust-the-caller wrappers by design, but in
every call path found, the only caller is `agent-orchestrator`'s `executeAction()`, which is only
reached after a `requires_approval` action has been explicitly approved (or, for the small
`safe_auto` subset like `rsvp_to_event`... — note `rsvp_to_event` is actually registered
`requires_approval`, not `safe_auto`, in
`supabase/migrations/20260509235233_d6be4321-ecd4-441e-ab4c-5ac6ec7ed39b.sql:11`).

### Not independently re-verified this pass
- Meeting summaries (`transcribe-call`, `speed-session-recap`) — located, not deeply audited.
- `src/components/project/BriefHub.tsx`, `SmartBriefBuilder.tsx`,
  `CreateProjectWizard.tsx` frontend save-gating for brief-to-project — the edge function contract
  is safe (returns data only), but the frontend insert path per-component was not individually
  traced.
