# Kreto overhaul — validation against the acceptance criteria

Phase 6 of the Kreto overhaul (plan: `KRETO_OVERHAUL_PLAN.md`). Each criterion from the brief, its status, the evidence, and what is
left. "Met" means the code does it and a test proves it; "Partly met" says exactly which part is missing; nothing here is claimed
from intent alone.

Pull requests: Phase 2 `Kretopia/kretopia-connect#363` and the decisions commit (merged to `main` through #366), Phase 3 #364
(merged), Phase 4 #369, Phase 5 #370, Phase 6 (this). Planning docs #365 (merged).

| # | Criterion | Status | Evidence | Left to do |
|---|---|---|---|---|
| 1 | The user can choose a Kretopia-branded model and effort level | Met | Model and effort picker in the composer (#363, #370); server-side routing in `_shared/kretoProfiles.ts`; `kretoProfiles.test.ts`, `kretoProfilesClient.test.ts`, picker cases in `InlineKretoChat.test.tsx` | — |
| 2 | The user can see the cost/usage impact before an expensive request | Met | "About N% of today" beside Send; the server asks first at 25% of what is left today or this week and stops a request that does not fit, before anything is counted (#363); weekly allowance per plan; `thriveAiChatProfiles.test.ts` (guard, weekly), confirm-flow cases in `InlineKretoChat.test.tsx` | The composer shows the Cloud allowance, the chat function also checks the legacy ledger and uses the lower: unify the two ledgers |
| 3 | The system prevents silent expensive upgrades | Met | Auto never exceeds the effort ceiling and no longer upgrades on length; the deepest tier only for admins and active Premium; `kretoRoutingInvariants.test.ts` checks every combination (about 43,000) | — |
| 4 | Kreto gives direct, useful, source-aware answers | Partly met | Answer-first replies with a Sources disclosure naming the Kretopia data used (#364, #370); only the sections a message is about are sent in detail; `kretoContext.test.ts`, context cases in `thriveAiChatProfiles.test.ts` | Usefulness is not something a test proves; a rolling thread summary (lot K4, written, not applied) would replace up to 40 raw past messages |
| 5 | Kreto distinguishes internal data from external research | Partly met | Replies label "From your Kretopia data"; every web research tool asks each time (#369); the chat itself does not browse | No "From the web" label yet because chat has no web results; a web research consent setting is lot K4 (written, not applied) |
| 6 | Kreto never invents verification, payment, availability, or authority | Partly met | A paid invoice says whether the payment provider confirmed it (#364); Credits keep their evidence level; actions report "Not confirmed" when they may have acted (#369); the /kreto subtitle no longer claims approval at every step (#370); USER FACTS forbid inventing; `kretoContext.test.ts` (paid means proven), `kretoToolPolicy.test.ts` (failure outcomes) | A model can still be wrong: these are guardrails, not proof. No availability data is loaded, so Kreto is told nothing about it rather than guessing |
| 7 | Kreto asks for approval before sensitive actions | Met in code | One policy for all 65 tools, stricter of registry and policy; sending, publishing, money, access and shared changes ask; deleting a project, charging and the unsafe profile refresh are locked (#369); approval cards on /kreto; `kretoToolPolicy.test.ts`, `edge/agentOrchestratorPolicy.test.ts`, `edge/agentOrchestratorLifecycle.test.ts` | Re-tier the registry rows to match (lot K3, written, not applied); production's orchestrator differs from the repository's and must be reconciled before any deploy (see the production check below) |
| 8 | Every action has a durable audit trail | Partly met | Every proposal, run, block, failure and decision leaves a row (`orch_actions`, `orch_approvals`, `orch_runs` with status); a failure marks the run failed; `edge/agentOrchestratorLifecycle.test.ts` | Statuses `partial`, `cancelled`, `unknown` and run profile/effort are lot K2 (written, not applied); `running` already exists |
| 9 | Agent history cannot be silently rewritten or deleted | Not met | The code never rewrites it, but database policies still allow it | Lot K1 (written, not applied) revokes client inserts on `orch_runs`/`orch_approvals`, owner updates/deletes on `copilot_plans`, deletes on `agent_project_context` |
| 10 | The UI is clean, premium, and clearly Kretopia-branded | Met | One quiet composer row, answer-first replies, status chips, settings (#370); browser check in Midnight and Daylight at 1280px and on a phone; `kretoUiGuard.test.ts` | — |
| 11 | No provider names are exposed in user-facing UI | Met | Labels, notices, refusals, headers and Kreto's surfaces checked: `kretoUiGuard.test.ts`, `kretoProfilesClient.test.ts`, `kretoRoutingInvariants.test.ts`, `kretoToolPolicy.test.ts`, header checks in `thriveAiChatProfiles.test.ts` | — |
| 12 | No unrelated systems are broken | See below | Every test that imports a file the Kreto work changed, run on current `main` with Phases 4 to 6 merged in | — |
| 13 | No production deployment or merge occurs without explicit approval | Met | Nothing was deployed; no pull request was merged by Kreto's work (you merged #364, #365 and #366) | — |

## Criterion 12: the run

Run on 2026-11-21 against current `main` (`2fb56c7a3`) with Phases 4 to 6 merged in locally (nothing pushed to `main`), so it tests
the code as it will land next to everything merged since:

- **Every test that depends on a changed file.** Found by an import-graph walk from the 25 source files the Kreto work changed
  (`vitest related` cannot build its graph on this repository, see below): 29 test files, including Discover, Passport, Scout, Match,
  Admin and route prefetch. Result: 28 files and 353 tests pass; `DiscoverPage.test.tsx` fails 3 tests. Those same 3 tests fail on
  plain `main` without any Kreto change, so they are not caused by this work.
- **Every Kreto test** (Kreto, edge, context, memory, policy, UI guard): 57 files, 875 tests, all passing.
- **Typecheck** of `main` plus the stack: clean.
- **Lint** of every changed file: no new findings beyond those already on `main`.
- **Browser** (Phase 5): `/kreto` in Midnight and Daylight at 1280px and on an iPhone 13, no overflow, no page errors.

Found on `main` along the way, unrelated to Kreto: `supabase/functions/og-campaign/index.ts` had `await publicPerimeter(req, …)`
inside the synchronous `formatMoney` helper (since #337), so the file did not compile. Production was never affected: it runs a newer
version. #374 made the repository a byte-for-byte copy of production's function and its two helpers.

## Production check of `agent-orchestrator` (2026-11-21, read-only, kretopia-app at `9cff96cd`)

Production does **not** have the input bug #369 fixed: it reads the body with `_shared/requestBody.ts` (`readJsonObject`), which keeps
`intent`, so agent proposals already work there. Production's function has drifted from the repository's (1,197 vs 1,437 lines):

* **Only in production:** `_shared/destructiveApproval.ts` (destructive tools blocked until a target-bound approval exists),
  `_shared/toolArgs.ts` (arguments checked against the registry's `args_schema` before running), a re-read of the registry at execution
  (a tool locked or re-pointed since the proposal is refused), an approval that must carry exactly the proposed arguments (edits need a
  new proposal), and `_shared/callerAuth.ts` for the caller.
* **Only in the repository:** `_shared/kretoToolPolicy.ts` (the stricter of registry and policy floor, unknown tools ask, locked
  attempts recorded), the planner honouring the person's auto-run setting (production's planner runs `safe_auto` tools inline
  regardless), truthful "not confirmed" outcomes, and `_shared/approvalHardening.ts`.

So pasting the repository's orchestrator would remove production's safeguards. The safe path is the one used for og-campaign: first
copy production's orchestrator and its three helpers into the repository unchanged, then add the policy layer on top of that in a
reviewed change. Lot K3 (below) already brings production's behaviour to the policy floor without deploying code.

## Decisions waiting for you

1. Whether to reconcile `agent-orchestrator` as described above (parity first, then the policy on top). Until then, do not paste it.
2. Applying the migrations of rows 4, 5, 7, 8 and 9: written for review in `docs/security/kreto/manual-sql/` (lots K1 to K4, rehearsed on
   a scratch database, not applied).

## Deploy order (when approved)

Before pasting any function into `kretopia-app`, compare it with the deployed copy: `og-campaign` and `agent-orchestrator` both
turned out to be different (and in places stricter) in production. Paste only what matches or what was reconciled.

Legacy (Lovable `kretopia-app`), shared files first: `_shared/kretoProfiles.ts`, `_shared/kretoContext.ts`,
`_shared/memoryPolicy.ts`, `_shared/copilotContext.ts`, `_shared/kretoToolPolicy.ts`, `_shared/approvalHardening.ts`; then
`thrive-ai-chat`, `thrive-memory-extract`, `copilot-executor`. **Not `agent-orchestrator`** until it is reconciled (see the production
check above). Cloud: `_shared/kretoProfiles.ts`, `_shared/kretoContext.ts`, then `kreto-resources`. Then publish the app.
