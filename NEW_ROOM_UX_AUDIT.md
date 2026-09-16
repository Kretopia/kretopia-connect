# New Room — Phase 1 Read-Only Audit

Branch: `feature/reliability-overhaul`. Baseline gate before any edit: `typecheck` clean, `test` 99/99 passing, `build` clean, `lint` at the same pre-existing repo-wide baseline as prior sessions (thousands of `any`-type errors in `supabase/functions/*` and stale `.claude/worktrees/`, unrelated to this work).

**Framing note, upfront** — same pattern as the two prior giant specs this session (KrePay, Landing): the spec's own premise doesn't match what's actually running. "New Room" is **not** a static microphone modal with example stickers. The live implementation, `VoiceFirstCreateModal.tsx` (1197 lines), is already a real 4-mode guided intake flow (`prompt → recording → thinking → review`) wired to a genuine AI backend (`extract-brief` edge function, real Gemini calls, real structured-output schema), with a real draft-review-confirm gate before any Project is created. This audit treats that as the baseline and identifies the *actual* gaps against the spec, rather than re-describing already-built work as new.

---

## 1. Current New Room flow

**Entry points** (no dedicated route — a full-screen overlay, opened from state, not the router):
- `CreatorWorkHome` (`/desk`) → `StudioCreateHero` hero card + `VoiceFirstCreateModal`
- `BrandWorkHome` (`/desk`, company accounts) → modal only, no hero
- `ProjectsList.tsx`, `QuickActionFab.tsx`, `WorkspaceSidebar.tsx`, `DeskCommandPalette.tsx` (⌘K) — all open the same modal

**State machine** (`VoiceFirstCreateModal.tsx`):
1. `prompt` — H1 "What are you making?", subtitle, trust line ("Nothing becomes a Project until you confirm..."), a real `&lt;details&gt;` "How this works" disclosure (8-step grid tagged Automatic/Suggested/You confirm), a 96px mic button (real `getUserMedia`), "Or type it instead" toggle, 6 starter-intent pills mapped to real `WorkspaceType` values, two "more ways to start" cards (file/sheet).
2. `recording` — real `MediaRecorder`, running timer, stop button.
3. `thinking` — `KretoAvatar state="thinking"` + cycling real status copy, indeterminate progress bar.
4. `review` — editable title, editable "vision" summary, AI-extracted starter-task checklist (select all/none), room-type picker, money-involved gate, credit-tracking checkbox, date/budget fields, "Start over" / "Create N selected" / "Create all & open".

A draft additionally persists to `sessionStorage` (`new_room_draft:${user.id}`, 24h TTL) so an accidental close/refresh doesn't lose it.

**A second, dead flow exists**: `CreateProjectWizard.tsx`, an older 3-step `Dialog`-based wizard (type → deal type → name/invite), whose only mount point (`CreateProjectDialog.tsx`) is not imported anywhere in `src/` — fully unreachable from the live app despite being complete and functional (it also calls `extract-brief` and inserts into `projects`).

## 2. Current Studio creation flow

`createProject()` (`VoiceFirstCreateModal.tsx:480-561`): one `projects` insert → optional `project_tasks` insert for selected deliverables → `scaffoldProjectDefaults()` (`src/lib/scaffoldProject.ts`) which idempotently seeds per-type Vault folders + starter deliverables from `WORKSPACE_CONFIGS` (the same canonical config used by the Studio room's own tabs) → `analytics.projectCreated(project.id)` → toast → clear draft → close → `navigate('/desk/${project.id}')`. Genuinely type-aware — not a generic fallback structure.

## 3. Actual data contract

`extract-brief` (`supabase/functions/extract-brief/index.ts`) always returns:
```
{ project: { title, summary }, deliverables: [{ title, description, due_date, references[], notes }] }
```
Sources: `text | csv | sheet | doc | audio`. Sheet ingestion is real (Google Sheets CSV export endpoint, no OAuth). Doc/audio are sent as base64 multimodal parts directly to `google/gemini-2.5-flash` via the Lovable AI gateway — no separate transcription/OCR service, no persistent file storage (files never touch Supabase Storage; they're base64'd straight into the request and never written to disk server-side).

## 4. Actual AI capabilities — real, with one confirmed bug

The system prompt (`buildSystemPrompt`) is genuinely well-built: per-type producer personas with concrete example deliverable sequences, strict JSON output, "always 5-8 deliverables," "elevate, don't echo," real rules for spreadsheet column mapping and reference-URL kind detection. Authenticated (JWT check, fixed per a comment referencing a prior unauthenticated-abuse finding).

**Confirmed bug**: `extract-brief`'s `PERSONAS` object is keyed on `podcast | event | content | campaign | music | client | general` — but the app's real `WorkspaceType` enum (`src/lib/workspaceConfigs.ts`, the single source of truth used everywhere else, including the starter-intent pills) is `photo_shoot | video_shoot | music_project | fashion_show | event_production | commissioned_art | brand_collab | dj_live_gig | edit_job | content_series | general`. The whitelist check is an exact-string `.includes()` — **every real type except `general` fails to match and silently falls back to the generic persona.** `event_production` ≠ `event`, `music_project` ≠ `music`, `content_series` ≠ `content` — none of the specialized personas the code clearly intends to use are ever actually selected. Compounding this: `WORKSPACE_CONFIGS` already defines a per-type `aiPersonaPrompt` field (e.g. photo_shoot's: *"You're producing a photo shoot. Help with call sheets, shot lists, lighting notes..."*) that `extract-brief` doesn't consume at all — there are two separate, drifted persona systems where there should be one.

## 5. Unsupported claims in current UI

None found that overclaim automation beyond what's real — the existing trust line and "How this works" disclosure are accurate to what the code does. The gap is the inverse: the persona bug above means the AI draft quality *undersells* what the system prompt was designed to deliver, for every type except General.

## 6. Security risks

- **Project ownership: verified sound.** `created_by` is not client-trusted — a `BEFORE INSERT` trigger (`set_project_created_by`, `SECURITY DEFINER`) unconditionally overwrites it from `auth.uid()` whenever a session exists, added in the `20251005014449` migration and re-confirmed unmodified as of the latest touch (`20260524111719`). The INSERT policy itself is permissive (`WITH CHECK (auth.uid() IS NOT NULL)`) but that's safe *because* ownership is enforced by the trigger, not the policy. SELECT/UPDATE use a `SECURITY DEFINER` `user_has_project_access()` helper correctly covering solo/matched/collaborator cases; DELETE is creator-only. No cross-user creation/read/write path found.
- **No idempotency key.** A double-click or a retried request after a slow/ambiguous network response could create two `projects` rows for the same draft. The only guard is a client-side `creating` boolean disabling the button — real but bypassable (e.g. two near-simultaneous taps before React re-renders, or a client-side retry after a timeout whose original request actually succeeded server-side).
- **No server-side file-size/MIME enforcement** for the `doc`/`audio` base64 payload — the 25MB cap is client-side only in `processFile()`. Low severity (a cost/abuse vector via the AI gateway, not a data-authorization issue), since nothing is persisted server-side from this path.
- `extract-brief` error responses can surface raw `err.message` (including underlying Postgres/gateway text in some paths) directly in a toast — minor information-exposure smell, not a live exploit.

## 7. UX problems

- Hardcoded brand color (`const ACCENT = "#FF2DA1"`, ~11 uses in `VoiceFirstCreateModal.tsx`, ~7 more in `StudioCreateHero.tsx`, plus raw `rgba(255,45,161,…)` strings for every glow/border/shadow) instead of the app's real `--energy` token — works today only because the token happens to equal the same hex; any future palette/theme change would silently desync this one feature from the rest of the product.
- The modal is a bespoke `fixed inset-0` overlay with **no focus trap** (confirmed: no Tab-containment logic at all — a keyboard user can Tab out into the page behind it) and **no focus-return on close** (closing just unmounts; the trigger element is never refocused). `aria-label="New Room"` on the root duplicates the visible `&lt;h1&gt;` as a static string instead of `aria-labelledby` pointing at it.
- Every other comparable "create X" flow in the app (`StartProjectDialog`, `PostOpportunityDialog`, `InvoiceGenerator`, even New Room's own dead `CreateProjectWizard`) uses the shared shadcn `Dialog`, which provides focus trap/return for free. New Room's live overlay reinvents this by hand and gets it half right.
- Dead code: `CreateProjectWizard.tsx` + `CreateProjectDialog.tsx` are unreachable, duplicate the same `extract-brief`/`projects`-insert logic, and would confuse anyone reading the codebase into thinking there are two supported creation flows.
- Zero `new_room_*` analytics events exist (only the pre-existing generic `analytics.projectCreated`, which already fires correctly at the end) — no visibility into where users drop off across voice/text/file/link, thinking, or review.

## 8. Performance risks

Nothing alarming found. Voice/file processing already runs off the main render path via async handlers; the AI call is a single request, not chained/streamed (fine for this latency budget); `sessionStorage` draft persistence is small and synchronous. No obvious duplicate-request pattern in the client code itself (server-side duplicate-project risk is the idempotency gap in §6, not a perf issue).

## 9. Files to change

- `supabase/functions/extract-brief/index.ts` — fix the persona/`WorkspaceType` mismatch (P0).
- `src/components/project/studio/VoiceFirstCreateModal.tsx` — focus trap + focus return + `aria-labelledby`; replace hardcoded `ACCENT`/`rgba` with token-based classes; add `new_room_*` analytics instrumentation.
- `src/components/project/studio/StudioCreateHero.tsx` — same color-token cleanup.
- `src/lib/analytics.ts` — add the `new_room_*` event methods.
- Delete: `src/components/project/CreateProjectWizard.tsx`, `src/components/project/CreateProjectDialog.tsx` (confirmed unreachable — re-verify immediately before deleting).
- New: a test suite for the persona-mapping fix and the core create-flow logic (none exists today for either file).

## 10. Files to protect

`src/lib/scaffoldProject.ts` and `src/lib/workspaceConfigs.ts` (already correct, genuinely type-aware Studio initialization — do not touch structure, only read from). The `projects`/`project_tasks` RLS policies and the `set_project_created_by` trigger (verified sound — no schema/policy change needed or wanted). `useReducedMotion`, `BrandDots`/`BrandLoader`, the shared `Button` variant system, `KretoAvatar` (kept for the "thinking" state — see judgment call below). Payment/Stripe code, auth, navbar — standing rule, untouched regardless.

## 11. Migration requirements

None required for the P0/P1 scope below. A real idempotency-key mechanism (e.g. a client-generated UUID stored in a unique-constrained column, checked before insert) would need a migration — flagged as **requires backend work / P2**, not attempted without a separate, explicit go-ahead, per the standing rule against applying migrations unprompted.

## 12. Implementation plan (P0 → P1, this pass)

1. Fix `extract-brief`'s persona map to the real 11-value `WorkspaceType` enum, sourced from `WORKSPACE_CONFIGS.aiPersonaPrompt` where it exists rather than a second hand-maintained table.
2. Add a real focus trap + focus-return + `aria-labelledby` to `VoiceFirstCreateModal`'s existing custom overlay (surgical fix, not a full Radix `Dialog` rewrite — the 1197-line 4-mode state machine is too large to safely re-platform in this pass; flagged as a P2 recommendation for a future, dedicated pass).
3. Replace hardcoded accent hex/rgba with `hsl(var(--energy))`-based Tailwind classes in both files.
4. Add `new_room_*` analytics events to `src/lib/analytics.ts` and instrument the real transition points already present in the state machine.
5. Delete the confirmed-dead `CreateProjectWizard.tsx`/`CreateProjectDialog.tsx` pair, after a final grep-verify.
6. Add a first test suite: persona-mapping unit tests (pure logic, no mocks needed) + a `VoiceFirstCreateModal` component test following the app's established Supabase/`useAuth` mock pattern (`UnifiedSearchDropdown.hero.test.tsx`'s style, since no test currently mocks `useAuth` anywhere in the repo — this establishes that pattern).

**Explicitly out of scope for this pass** (P2, per the spec's own scope-control section): converting the overlay to a full `Dialog` primitive; voice-specific test coverage requiring real microphone hardware; a from-scratch visual redesign of a flow that is already functionally solid — this pass fixes real bugs and real gaps rather than reskinning working UI.

**Update, same pass**: the double-click duplicate-project race (originally scoped here as needing a migration) turned out to have a real non-migration fix -- a synchronous ref guard closes the dominant double-click case; only the narrower network-retry case still needs a migration. The 7-breakpoint responsive matrix and a full reduced-motion code-path audit were also completed within this pass rather than deferred. See `NEW_ROOM_RELEASE_GATE.md` for the final, accurate status.

## 13. Test plan

Unit: persona-resolution logic (every real `WorkspaceType` value maps to its intended persona, fallback only for genuinely unknown strings). Component: `VoiceFirstCreateModal` renders in `prompt` mode with the real heading structure, Escape closes it, starter-intent click transitions state correctly, focus is trapped and returns on close.

## 14. Browser verification plan

Open New Room from `/desk`, confirm heading/starter-intents/how-it-works render, submit free text, confirm `thinking` → `review` transition, confirm nothing is written to `projects` before the explicit Create click, confirm exactly one project is created on confirm and navigation lands on `/desk/:id`, check console/network for errors, test Escape + Tab containment, test at a mobile viewport, test with reduced motion.

---

Proceeding directly into implementation per explicit instruction to continue without a further confirmation gate.
