# AI-Powered UX Audit

Section 9 of the Global Typography, UX/UI and AI-Powered Motion Overhaul. Compiled 2026-08-21 on branch `feature/activation-priority-plan`.

## Scope and methodology

The product has **119 edge functions** that call the Lovable AI Gateway (`ai.gateway.lovable.dev`) and **20+ frontend components** that surface AI-generated content to users. A field-by-field audit (intent/input/output/confidence/loading/editable/accept/regenerate/dismiss/error/quota/privacy/audit-event/confirmation) of all of them is not a one-pass undertaking — this is the same scale problem `GLOBAL_UX_UI_INVENTORY.md` documented for routes. This pass therefore did two things, both grounded in actually reading the code (not inferring from names):

1. **Full-surface triage against the brief's explicit "must not silently" list** — the highest-stakes part of Section 9. Every edge function whose name suggested it might publish, email, verify a credit, create a project, invite someone, touch payment state, alter a Passport, submit an application, or schedule a session was individually opened and checked for what it actually writes to the database, not just what it's named.
2. **Deep verification of the real, shipped "propose → review → execute" mechanism** (`agent_proposals` + `SurfaceProactiveCards`), since that's the one piece of infrastructure the brief's required interaction pattern depends on existing at all.

## 1. The "must not silently…" checklist — verified against real code

| Forbidden silent action | Finding | Evidence |
|---|---|---|
| **Publish** | No AI-calling function flips a `draft`/`published` flag without a separate human-triggered call. `gig-moderator` closes (not publishes) — see finding below. | Grepped every `.update(` call across all 119 functions for `status`/`published` writes. |
| **Send an email** | `send-invoice-chase` has an explicit `send: boolean` gate, defaulting to false — comment in the source literally says *"Owner approval gate: if send=true AND user has Gmail configured, sends via SMTP."* `money-agent-watch` (the function that drafts chase emails autonomously on a cron) only ever inserts a `draft`-status row; it never calls with `send=true`. | [`send-invoice-chase/index.ts:3`](supabase/functions/send-invoice-chase/index.ts), [`money-agent-watch/index.ts:97`](supabase/functions/money-agent-watch/index.ts:97) |
| **Verify a credit** | `verify-credit` writes only to `credits.ai_confidence` (a metadata score) and a separate `credit_ai_verifications` table — it never touches `credits.verification_status`, which is the field the "Verified" badge actually reads. Real verification stays a human/peer Co-Sign flow. Bulk-import functions (`auto-discover-creatives`, `import-odos-members`, `bulk-import-profiles`) that insert credits on a person's behalf all correctly use `verification_status: 'imported'` — a distinct, clearly-unverified status, not `'verified'`. | [`verify-credit/index.ts:142-146`](supabase/functions/verify-credit/index.ts:142), 3× `verification_status: 'imported'` inserts checked directly. |
| **Create a project** | No AI-calling function inserts into `projects`. | Grepped `from("projects").insert` / `from('projects').insert` across all functions — no hits. |
| **Invite a person** | Not found in any AI-calling function. | Grepped `invite` writes — no hits outside explicit, non-AI invite endpoints. |
| **Change payment state / release money** | No AI-calling function writes to `invoices.status`, `milestones.status`, or payout tables. `ai-finance`/`scan-receipt` only read and summarize; `money-agent-watch` only proposes. | Read both files in full — no write path exists. |
| **Alter a Passport** | Not checked exhaustively this pass — flagged as **not covered**, see below. | — |
| **Submit an application** | `draft-gig-application` returns `{ cover_letter, epk_url }` in the HTTP response only — it performs **zero database writes**, confirmed by reading the whole file. Grepping all 119 functions for any `applications` table insert/update paired with an AI-gateway call returned nothing. | [`draft-gig-application/index.ts`](supabase/functions/draft-gig-application/index.ts) (no `.insert`/`.update` calls exist in the file at all). |
| **Schedule a real session** | Grepping all 119 functions for `calendar_events`/`meetings`/`sessions` writes paired with an AI-gateway call returned nothing. | — |

**One real gap found and fixed in this pass**, adjacent to but not literally on this list: `gig-moderator` is a daily cron function that autonomously closes a person's gig posting — either on a hard deadline they set themselves (safe, confidence 1.0) or on an **AI-inferred** deadline/staleness judgment (confidence ≥ 0.6 for "expired", ≥ 0.7 for "spam"). It wrote to `gig_moderation_log` (an admin-only audit table) but **never told the gig's owner** their live post had been changed — no `notifications` insert existed at all before this pass. That's a silent, irreversible-feeling state change on a user's own content with no visibility, which is exactly the trust failure Section 9 is guarding against even though "close a gig" isn't the literal word "publish" or "payment." Fixed by mirroring the exact notification pattern `money-agent-watch` already uses correctly elsewhere in the codebase — see [`gig-moderator/index.ts`](supabase/functions/gig-moderator/index.ts).

## 2. The real "propose → review → confirm → execute" mechanism

The product already has one genuine, working implementation of the brief's required pattern: the `agent_proposals` table + `SurfaceProactiveCards.tsx`.

- **AI is thinking**: cron functions (`money-agent-watch`, others) run in the background, not in the request path of any user action.
- **AI produces a suggestion**: a row is inserted with `status: "pending"`, a human-readable `title`/`body`, and a machine-readable `action_intent` (e.g. `{ tool: "send_chase_email", args: { invoice_id } }`) describing what it *would* do — the tool is never called yet.
- **User reviews**: `SurfaceProactiveCards.tsx` renders it live via realtime subscription, labeled "Kreto Suggests."
- **User edits or confirms**: "Accept" (`handleAccept`, [`SurfaceProactiveCards.tsx:114`](src/components/agent/SurfaceProactiveCards.tsx:114)) only flips `agent_proposals.status` to `"accepted"` and navigates the user to a real review surface (`action_intent.href`) — it does **not** invoke `action_intent.tool` itself. "Not now" flips it to `"dismissed"`. Verified: no code path anywhere reads `action_intent.tool` and executes it automatically.
- **System executes**: this is where the chain is currently **incomplete**, not unsafe. `send-invoice-chase`'s `send=true` path exists and is properly gated, but grepping the entire frontend found **no caller that ever passes `send: true`** — meaning the AI-drafted chase email the user "accepts" currently has no wired path to actually be sent. Safe (nothing can fire), but also means the confirmation receipt step ("Nothing was published or sent yet" / "Sent") never actually triggers for this specific feature yet. Worth a follow-up ticket, not a safety fix.
- **Confirmation receipt**: not verified this pass for any flow — flagged as not covered below.

## 3. Frontend interaction-state coverage (spot-checked, not exhaustive)

Grepped ~20 known AI-facing components for two required UI states:

- **Loading/"thinking" copy** (e.g. "Analyzing…", "Generating…", "Drafting…"): present in 20 of the ~20 components checked (`AIJobDescriptionGenerator`, `AIBriefBuilder`, `AIMatchRecommendations`, `AIOpportunityInsights`, `TalentCopilot`, `KretopiaHero`'s search, etc.). Good, broad coverage.
- **A real "Regenerate" action** (distinct from Accept/Dismiss, letting the user ask for a different draft instead of only keeping-or-discarding): found in only **3** components — `AIWebsiteGenerator.tsx`, `PodcastStudioSection.tsx`, `EventPostRecapSection.tsx`. The rest (including `AIJobDescriptionGenerator` on Hire Talent and `AIStageBriefGenerator` added earlier this session) offer accept-or-discard but not regenerate. This is a real, quantifiable gap against the brief's required accept/regenerate/dismiss triad — not fixed this pass (a UI addition across a dozen-plus components is a separate slice of work, not a bug fix), listed under recommendations.
- **Quota state copy**: present in a further ~15 components (`ScoutedGigsSection`, `StudioAICreate`, `AIStageBriefGenerator`, `CreateServiceDialog`, etc.), generally reusing the shared `aiBriefs`/feature-gate quota system rather than inventing per-feature limits — consistent, not fragmented.

## What this audit does not cover

- **Passport alteration** — not individually traced this pass. `KretoPassportBuilder.tsx` and `infer-passport-profession` exist and are AI-backed; whether any write path touches a live Passport field without the "only becomes official once you confirm" gate that `MeetKretoSection.tsx`'s own marketing copy promises was not independently verified against the actual database writes.
- **Confirmation-receipt UI** — whether any flow actually shows "Sent" / "Nothing was published yet" after a real accept was not checked; `send-invoice-chase` has no wired frontend caller yet (see above), so this may currently be moot for that specific flow, but wasn't checked for others (e.g. `apply-to-stage`, `book-meeting`).
- **Privacy boundary** — whether any AI-gateway call sends more PII than necessary to the external model was not audited per-function; only spot-checked on `verify-credit` (sends project/role/year/platform, not the user's own contact info) and `gig-moderator` (sends title/type/duration/description, no user PII).
- **Audit-event completeness** — `gig_moderation_log`, `credit_ai_verifications`, and `agent_proposals` all function as real audit trails for their respective features; whether every one of the 119 functions has an equivalent trail was not checked.
- **The other ~100 AI-calling edge functions** not named in the tables above (e.g. `desk-agent`, `copilot-planner`, `thrive-ai-chat`, `spark-ideas`, `sponsor-radar`, the full `desk-*`/`route-*` families) — triaged only by grepping for the 10 forbidden-write patterns, not individually read end to end.

## Summary

No confirmed violation of the brief's "AI must not silently…" list was found across the 119 AI-calling edge functions for the 8 explicitly named actions (publish, email, verify-credit, create-project, invite, payment, application, session) — each was checked against real write paths, not names. One adjacent silent-state-change gap was found (`gig-moderator` auto-closing a gig with no owner notification) and fixed. The core "propose, don't execute" mechanism (`agent_proposals`) is real, working, and correctly conservative — if anything it's currently *too* conservative in one place (the chase-email "execute" step has no frontend trigger at all yet). The clearest remaining gap is UI-level, not safety-level: only 3 of ~20 AI-drafting components offer a Regenerate action.
