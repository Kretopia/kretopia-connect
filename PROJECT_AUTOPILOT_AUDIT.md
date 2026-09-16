# Project Autopilot Audit

Section 10 of the Global Typography, UX/UI and AI-Powered Motion Overhaul. Compiled 2026-08-21 on branch `feature/activation-priority-plan`.

## What was built

`AutopilotProjectGuide` — [`src/components/project/studio/AutopilotProjectGuide.tsx`](src/components/project/studio/AutopilotProjectGuide.tsx) — a guided, human-paced 8-step Studio setup flow: **define project → add collaborators → milestones → AI brief → review tasks → confirm plan → prepare next action → complete/pause**. Wired into [`StudioRoom.tsx`](src/components/project/studio/StudioRoom.tsx) as a "Finish setting up with Autopilot" banner, shown to the project owner only, while `projects.setup_completed` is false — an existing column `CreateProjectWizard.tsx` already writes on project creation but that nothing previously read. Autopilot is what that field was always waiting for.

## How each step avoids silent execution

| Step | What it does | Why it's safe |
|---|---|---|
| 1. Define project | Edit title/description, explicit **Save** | Direct write to a project the caller already owns — same pattern as every other in-place project edit in Studio. |
| 2. Add collaborators | Existing list shown; new invite via explicit **Invite** per person | Immediate real write + real email (`send-project-invitation`) — but only on an explicit, per-person click, never automatically. Identical in spirit to `CreateProjectWizard`'s already-shipped invite flow. Not live-tested with a real email this pass — see below. |
| 3. Milestones | Existing list shown; new milestone via explicit **Add** | `status: 'pending'`, `escrow_status: 'none'` — a planning record only; no escrow or payment path is touched. |
| 4. AI brief | **Draft a brief with Kreto** (AI call, no write) → editable draft → explicit **Save to project** | Textbook Section 9 pattern: "Analyzing your project context…" loading state → "DRAFT READY FOR REVIEW — EDIT ANYTHING" → edit → confirm → "Saved". Regenerate available. Nothing written until Save. |
| 5. Review tasks | AI-suggested starter tasks (from the same brief call) as a checklist, all pre-checked, individually uncheckable | Purely local state — **nothing is written here**. This is the deliberately deferred step the brief asks for. |
| 6. Confirm plan | Read-only summary: project, collaborators, milestones, and the exact task count about to be created | No writes triggered by viewing it — verified live: opening this screen alone changes nothing in the database. |
| 7. Prepare next action | Creates the accepted tasks + **one** proposed next step | The one real execution point, and it only fires on its own explicit button, never automatically on step entry. The proposal is inserted with `status: 'pending'` and rendered later through the existing `ProactiveCards` "Kreto Suggests" surface — same accept/dismiss pattern already verified safe in `AI_POWERED_UX_AUDIT.md`, not a new execution path. |
| 8. Complete/pause | **Mark setup complete** (`setup_completed: true`) or **Pause — continue later** (no-op close, resumable) | Either choice is explicit; pausing is never a dead end — reopening reloads real project state from the database. |

Every AI-generated result (the brief, the suggested tasks) is editable before it becomes real, matches Section 9's required loading/draft/edit/confirm states, and the closing copy on step 8 — "Nothing was published or sent without your confirmation at every step" — mirrors the brief's own required receipt language.

## A real bug this pass found and fixed

Live-testing surfaced a genuine defect, not just confirmed the design: **step 7's proposal insert was silently failing.** `agent_proposals` deliberately has no client-side INSERT policy — the table comment in its own migration says *"No INSERT policy: only service_role (edge fn) inserts"* — a correct security boundary (a client should never be able to inject a fake "AI suggestion" into a proposal feed). The original code inserted directly from the browser and never checked the returned `error`, so the write was rejected by RLS while the UI still displayed a false "prepared" success card.

Fixed two ways:
1. Added `create-agent-proposal` ([`supabase/functions/create-agent-proposal/index.ts`](supabase/functions/create-agent-proposal/index.ts)) — a narrow edge function that re-verifies the caller owns the target project server-side (never trusts a client-supplied ownership claim), then inserts with the service-role client. It creates a `pending` proposal and does nothing else — no accept, no execute, no email.
2. `AutopilotProjectGuide` now calls that function via `supabase.functions.invoke` and checks the returned error, matching every other write in the component (all of which already checked errors correctly — this was the one place that didn't).

A second, related bug was caught in the same live pass: `prepareNextAction` called `goNext()` immediately after a successful prepare, advancing past step 7 before the "N tasks added / 1 suggestion waiting" confirmation receipt ever had a chance to render — so the person never actually saw the receipt the brief's interaction pattern requires. Fixed by removing the auto-advance; "Continue" now only appears, and only needs to be clicked, once the receipt is showing.

## Verification

Live-tested end to end in a throwaway test project (`Autopilot Verification Test — safe to delete`, created via a direct authenticated insert for this purpose, deleted afterward along with every row it produced — confirmed via a follow-up query that `/desk` shows only the account's one real pre-existing project again):

- Step 1: edited title/description, clicked Save, saw "Saved to the project" — confirmed the value persists across a fresh mount (re-loaded from the real `project` row, not local-only state).
- Step 2: confirmed the empty-state, disabled Invite button until a valid email is typed, and the safety copy ("Autopilot never sends one on its own"). **Did not click Invite with a real address** — this session's standing rule against triggering real emails applies here the same as everywhere else; the send path itself is identical to `CreateProjectWizard`'s already-shipped, already-used invite mechanism, so it is not a new risk, just not independently re-verified by clicking it.
- Step 3: added a real milestone ("Rough cut delivered"), confirmed it appears in the list and the form clears — a real, correctly-scoped write.
- Step 4: clicked "Draft a brief with Kreto," watched the real `extract-brief` AI call run ("Analyzing your project context…"), got back a real generated brief, edited nothing, clicked "Save to project," confirmed "Saved" and that the project's `description` was actually updated (re-verified via a fresh mount loading the saved text back in).
- Step 5: confirmed 7 real AI-suggested starter tasks rendered as a checklist, unchecked one, confirmed the count updated.
- Step 6: confirmed the summary screen accurately reflected everything set up so far, including the reduced task count from step 5.
- Step 7: **first attempt exposed the RLS/silent-failure bug above** — caught via a direct database query showing 0 proposals despite the UI claiming success. Fixed as described. Re-tested after the fix: the button no longer shows a false-success state, and the browser console now correctly surfaces the (expected, pending-deploy) failure instead of hiding it — see below.
- Step 8: not re-tested after the step 7 fix in this pass (the flow was verified up through step 7's corrected error path; walking into 8 was already confirmed structurally correct in the first, pre-fix pass — `finalize`'s own error handling was never in question).
- `npm run typecheck` / `build` / `test`: clean, matching baseline (68/68 tests, one pre-existing unrelated typecheck error).

## What this does not cover

- **`create-agent-proposal` is not deployed yet.** Like every edge function this session, there is no CLI deploy path available (Kretopia's Supabase project isn't among the ones this machine's Supabase CLI login can reach — established earlier this session) — it syncs automatically via Lovable Cloud once pushed, the same as `search-icdb` and `gig-moderator` earlier in this engagement. Confirmed live that the current pending-deploy state fails safely (a proper error surfaces, no false success) rather than silently. The end-to-end "prepare next action creates a real proposal" behavior itself has not been observed live yet and needs re-verification once the function is live.
- **Step 2's real invite send was not live-tested by clicking Invite** — deliberately, to avoid sending a real email during verification. The code path is identical to the already-proven `CreateProjectWizard` mechanism.
- **Step 8's two finalize paths were not independently re-tested after the step 7 fix** — only the pre-fix pass exercised them, and step 7's fix didn't touch step 8's code at all, so risk of regression there is low but not zero.
- **Not tested**: reopening Autopilot on a project that already has real collaborators/milestones from before (only tested against a project that Autopilot itself built up); resuming a paused (not completed) Autopilot session after a real page reload — only tested resuming after a same-session HMR remount, not a fresh navigation; mobile/narrow-viewport layout of the Sheet; keyboard-only navigation through the 8 steps; what happens if two people with Studio access both have Autopilot open on the same project at once.
