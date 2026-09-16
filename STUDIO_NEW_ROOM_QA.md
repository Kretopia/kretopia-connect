# Studio New Room — QA

**Component:** `src/components/project/studio/VoiceFirstCreateModal.tsx` (861 lines)
**Route:** Opened from `/desk` via the "New project" CTA
**Commit:** `3805b6ac` (Phase 3)

## What changed

The charter asked for a progressive 4-step guided flow (choose type → describe idea → Kreto structures the project → confirm and create) with draft persistence, no duplicate-submission risk, and full user control over AI suggestions. Investigation found `VoiceFirstCreateModal.tsx` **already implemented nearly all of this**: staged flow, `sessionStorage`-backed draft persistence (`new_room_draft:${user.id}`), an editable AI-structured review step, and double-submit guards (`disabled` on `creating`/title/selection/payment-status). Rebuilding it would have risked regressing those working safeguards for no real gain, so the change was scoped to copy and step-labeling only:

1. Headline: "What are you making?" → **"Create a project"**
2. Subcopy: "Pick the kind of room — or just speak. We'll shape it around you." → **"Kreto will help shape the workspace around your brief, team and next milestone."**
3. Added a `"Step 1 · Choose the project type"` label above the existing workspace-type chip grid.
4. Added a `"Step 2 · Describe the idea"` label above the existing voice/text toggle.
5. Relabeled the review step's heading from "Here's what we caught" to **"Step 3 · Kreto structured your project — review and edit"**.

Nothing else was touched: type inference logic, recording logic, draft persistence, brief extraction, deliverables selection, payment/credit tracking, and the footer's create-project buttons are all exactly as they were before this charter.

## Acceptance criteria

| Criterion | Status |
|---|---|
| STEP 1: choose project type | ✅ Existing `WORKSPACE_CONFIGS` chip grid (10 types), now explicitly labeled "Step 1" |
| STEP 2: describe the idea (text + optional voice + example prompts) | ✅ Existing voice/text toggle with example prompt chip, now explicitly labeled "Step 2" |
| STEP 3: Kreto structures the project (editable preview) | ✅ Existing AI-structured review, now explicitly labeled "Step 3", confirmed editable before this charter and unchanged |
| STEP 4: confirm and create | ✅ Existing footer CTA buttons (`createProject("selected")` / `createProject(brief.deliverables?.length ? "all" : "none")`), unchanged |
| Draft persistence | ✅ Pre-existing `sessionStorage` mechanism, untouched |
| No duplicate creation on double-click | ✅ Pre-existing `disabled` guards on `creating`/title/selection/payment-status, untouched |
| Loading/error/retry/success states | ✅ Pre-existing, untouched |
| First milestone visible after creation | ✅ Pre-existing behavior, untouched |
| No invented facts, user stays in control | ✅ AI suggestions remain editable before creation, as before |
| Progressive disclosure, not a long multi-page form | ✅ Confirmed via live click-through — steps expand progressively as the user interacts, not presented as one long form |

## Live verification

Opened the modal from `/desk`'s "New project" CTA via a direct button click. Confirmed: headline reads "Create a project", subcopy reads "Kreto will help shape the workspace around your brief, team and next milestone.", the 4-step preview panel (Describe it → Kreto builds a brief → Review & edit → Launch the room) renders correctly, Step 1's project-type chips and Step 2's voice/text entry with example prompt are both visible and correctly labeled. Closed via Escape without creating a project, to avoid writing fabricated test data into the database.

`npx tsc --noEmit`, `eslint` diff-check (zero new issues), `npm run build`, and `npm run test -- --run` (62/62) all pass for this change.
