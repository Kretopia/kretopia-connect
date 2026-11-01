# Lot 4 -- paste kit for batch 1

**Nothing here is done for you.** This is the checklist for pasting the batch into the Lovable project **kretopia-app** (the one that reaches
production), by hand. Never into "Kretopia Connect": it deploys itself when the pull request is merged. The files are the ones of the branch
`chore/security-lockdown-phase5` (PRs 295 and 296, merged into main on 2026-11-01); the sizes and hashes below are those of the commit this kit was generated from. The reasoning and the
list of what each function changes are in `LOT4_ACTIVATION_BATCH1.md`.

## 0. Before you paste: three read-only checks

**A. What must already exist in kretopia-app.** The batch imports these names from files it does not change. For each, open the file in
kretopia-app, select all, copy, and run `bash docs/security/phase5/paste-kit/compare_clipboard.sh <path under supabase/functions>`. It says
whether the file is the one the branch started from and whether the exported names are present. A missing name makes every function that
imports it fail to start.

| File (already in production) | Names the batch imports |
|---|---|
| `_shared/agentActionBinding.ts` | `bindApprovedAction` |
| `_shared/agentAuthority.ts` | `authorizeHighStakesAction`, `recordExecutedAction` |
| `_shared/aiLimits.ts` | `TOKENS_SHORT_LABEL` |
| `_shared/aiModels.ts` | `GEMINI_3_FLASH`, `GEMINI_FLASH`, `GEMINI_FLASH_IMAGE`, `GEMINI_FLASH_LITE` |
| `_shared/aiRateLimit.ts` | `checkAiFeatureRateLimit` |
| `_shared/fetchWithTimeout.ts` | `fetchWithTimeout` |
| `_shared/guard.ts` | `GuardError`, `constantTimeEqual`, `corsFor`, `rateLimit`, `readJson`, `requireUser`, `safeError` |
| `_shared/notificationGuards.ts` | `INVOICE_CHASE_COOLDOWN_MS`, `cooldownCutoffIso`, `decideInvoiceChase` |
| `_shared/outboundText.ts` | `cleanRecipientEmail`, `escapeHtmlText`, `singleLine` |
| `_shared/promptIsolation.ts` | `PROMPT_INJECTION_DEFENSE_CLAUSE`, `wrapUntrustedContent` |

**B. Every file this batch changes** (the three shared files `_shared/ssrf.ts`, `_shared/aiPerimeter.ts`, `_shared/outboundBudget.ts` first, then each function when its turn comes): run the same script on
production's copy. "Identical to the baseline" means overwriting loses nothing. "DIFFERENT" means production has changes the repository does not, and
**overwriting would remove them**. The script then saves production's copy and a **merge candidate** (production's changes kept, this branch's
changes applied) under `paste-kit/production/` and `paste-kit/merged/`; both stay on your machine. Tell me which files you ran; I review the
candidate, and only then is it pasted.

*The first real comparison (2026-11-02): production's `_shared/ssrf.ts` has 307 lines and blocks address ranges that the repository's does not
(documentation ranges, `ff00::/8`, `2001:db8::/32`, `64:ff9b:1::/48`). Pasting the repository's file over it would have removed those blocks.
The two projects' shared files are edited by two different agents and have drifted: never paste a repository file over a production file that
differs.*

**C. The database.** In the SQL Editor of kretopia-app (read-only). It returns only what is missing, so an empty result is the good one. The
function `consume_ai_feature_call` is the one the member perimeter and the per-address limits rely on:

```sql
SELECT 'table or view' AS kind, t AS missing
FROM unnest(ARRAY['awards', 'connections', 'copilot_plans', 'creative_jams', 'credits', 'deleted_credits', 'discovered_credits', 'discovery_scans', 'email_send_log', 'invoices', 'jam_participants', 'notifications', 'opportunities', 'orch_actions', 'orch_approvals', 'orch_runs', 'orch_settings', 'orch_tool_registry', 'outreach_drafts', 'press_links', 'profiles', 'project_collaborators', 'project_messages', 'projects', 'public_profiles_safe', 'push_subscriptions', 'sponsor_leads', 'user_email_settings', 'user_roles']) AS t
WHERE to_regclass('public.' || quote_ident(t)) IS NULL
UNION ALL
SELECT 'function', f
FROM unnest(ARRAY['consume_ai_feature_call']) AS f
WHERE NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = f)
ORDER BY 1, 2;
```

*Result on 2026-11-02, run on production's database by the kretopia-app agent with the earlier, wider version of this query:* `ai_model_calls`,
`try_reserve_ai_credit`, `commit_ai_credit`, `release_ai_credit` and `reconcile_stale_orch_runs` missing; `consume_ai_feature_call` and the 29
other tables present. **None of the five blocks the batch.** The first four are used only by `gateAiCall`, `commitAiCredit` and `releaseAiCredit`
in `_shared/aiRateLimit.ts` and by `_shared/measuredModelFetch.ts`; no function of the batch imports those (the batch takes only
`checkAiFeatureRateLimit` from that file, and that function calls `consume_ai_feature_call` alone). They belong to the Cloud backend's credit
ledger and must not be created here. The orchestrator calls `reconcile_stale_orch_runs` without depending on it (a logged warning). The query
above no longer lists them.

## 1. Paste order

Same path in kretopia-app as in the repository. Shared files first, one function at a time after that, with the probe of section 2 after each.
Before overwriting a file, copy its current content from kretopia-app into a note: that is the way back (the editor's history also works).

| # | File | vs baseline | Lines | Bytes | sha256 (12) | |
|---|---|---|---|---|---|---|
| 1 | `_shared/ssrf.ts` | changed | 322 | 13024 | `35a0412c6e2c` |  |
| 2 | `_shared/aiPerimeter.ts` | changed | 24 | 1202 | `35468ed6168b` |  |
| 3 | `_shared/outboundBudget.ts` | changed | 196 | 8488 | `e3e373eb5f4e` |  |
| 4 | `_shared/approvalHardening.ts` | new | 135 | 7114 | `5b68ea7a0bea` |  |
| 5 | `_shared/enrichmentAccess.ts` | new | 43 | 2631 | `3a112cc02bbf` |  |
| 6 | `_shared/enrichmentCaller.ts` | new | 29 | 1775 | `caccbf34307c` |  |
| 7 | `_shared/invoiceEmail.ts` | new | 182 | 9592 | `58a2f27a3180` |  |
| 8 | `_shared/voiceNote.ts` | new | 89 | 4596 | `67c9527cf6b7` |  |
| 9 | `_shared/pushEndpoint.ts` | new | 29 | 1371 | `fb571f87e46e` |  |
| 10 | `copilot-collaborator-tools/index.ts` | changed | 537 | 22201 | `d05a67af8298` |  |
| 11 | `copilot-executor/index.ts` | changed | 392 | 16403 | `155a2550f522` |  |
| 12 | `agent-orchestrator/index.ts` | changed | 1350 | 57295 | `08d1219f03cf` |  |
| 13 | `send-invoice-email/index.ts` | changed | 113 | 5059 | `c703845832b0` |  |
| 14 | `send-outreach-draft/index.ts` | changed | 296 | 14135 | `7f397799b76f` |  |
| 15 | `enrich-creator-profile/index.ts` | changed | 550 | 28061 | `2de3b24aa7b7` |  |
| 16 | `enrich-press-links/index.ts` | changed | 188 | 7815 | `8e61795577ce` |  |
| 17 | `enrich-credits/index.ts` | changed | 295 | 13265 | `07e5ef7f2e39` |  |
| 18 | `extract-event-details/index.ts` | changed | 388 | 17304 | `21b4646b4047` |  |
| 19 | `transcribe-voice-note/index.ts` | changed | 144 | 5688 | `4622761d8cad` |  |
| 20 | `send-push-notification/index.ts` | changed | 432 | 15374 | `974f7042d81b` |  |

Order of the functions is the order of the table. Stop at the first problem; do not paste the rest.

## 2. Probe after each function

Anonymous call with the project's public (publishable) key. A function that starts answers with its own refusal; a function that cannot start
(a missing export, a missing file) answers a platform 500.

```bash
URL=https://kwmcocsitwssrtzkdojh.supabase.co
ANON=<the project's publishable key>
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$URL/functions/v1/<function>" -H "apikey: $ANON" -H "Authorization: Bearer $ANON" -H "Content-Type: application/json" -d '{}'
```

Expected: **401** (or 400/403 for a few), **never 500**. Then the specific check of each function, from `LOT4_ACTIVATION_BATCH1.md` section 4
(for example `send-invoice-email` with a malformed `recipientEmail` -> 400, with another member's invoice id -> 404).

## 3. Way back

* One function: paste back the note you took (or `git show c0da3818e:supabase/functions/<function>/index.ts`, the state before this branch) and redeploy it.
* Roll `transcribe-voice-note` and `send-push-notification` back **before** `_shared/ssrf.ts` or `_shared/pushEndpoint.ts`: they import them.
* The new shared files can stay: nothing else imports them.

## 4. Optional: `desk-agent` (batch 1c)

`desk-agent` carries the fix for the model choosing the tool an internal call runs. It was blocked because `_shared/premiumSwitch.ts` is absent
from kretopia-app. That file is self-contained (no import, 1733 bytes). It is the Premium kick-off switch (everything free until
`PREMIUM_ENFORCED` is set to true, the owner's order): pasting it is a decision, and it changes nothing until a function that imports it is
pasted. Then, in this order: `_shared/premiumSwitch.ts`, then `desk-agent/index.ts` (needs `_shared/approvalHardening.ts` from step 4 above).
The files below must already exist in kretopia-app with these exports (check them with the script of section 0A):

| File | Names `desk-agent` imports |
|---|---|
| `_shared/aiModels.ts` | `GEMINI_3_FLASH` |
| `_shared/copilotContext.ts` | `loadCopilotContext`, `renderContextPreamble` |
| `_shared/executionGuard.ts` | `evaluateExecutionGuard` |
| `_shared/fetchWithTimeout.ts` | `fetchWithTimeout` |
| `_shared/guard.ts` | `corsFor`, `readJson`, `safeError` |

| File | vs baseline | Lines | Bytes | sha256 (12) |
|---|---|---|---|---|
| `_shared/premiumSwitch.ts` | unchanged | 38 | 1733 | `f4e372d193fb` |
| `desk-agent/index.ts` | changed | 1111 | 52131 | `876d7a45239f` |

## What this kit does and does not establish

It makes the pre-checks mechanical and the order exact. It does not read kretopia-app, does not paste anything and does not prove a function
works in the real Deno runtime: the tests behind the batch run the real handlers with a fake database and provider. Until you have pasted and
probed, none of these protections is active in production.
