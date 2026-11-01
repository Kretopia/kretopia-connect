# Lot 4 -- first activation batch (limited, from the real diff)

Nothing here is deployed or activated. This is a list, built from `git diff origin/main..HEAD -- supabase/functions` (28 `index.ts`, 10 shared
files) and from the import graph of the repository, of what a first deployment would contain and what has to be true first. It does **not**
extend to the 70 functions of the manifest, and it leaves out `desk-agent`.

## Status

| Batch | Contents | Status | What is missing to pass |
|---|---|---|---|
| **1** | 11 functions below + 9 shared files | **WAITING_FOR_VALIDATION** | (1) a read-only comparison of the nine shared files in the project that reaches production (kretopia-app) with this branch: the batch needs the exports listed in section 3, and I could not read that project in this session; (2) the answer to one read-only query (section 3) proving `consume_ai_feature_call` exists there; (3) your decision of the backend that hosts each function (legacy production or the Cloud backend). Nothing else: no SQL is a prerequisite. The checks are now mechanical: see `LOT4_PASTE_KIT.md` (a comparison script for (1), a query that lists every table and function the batch uses and returns only what is missing for (2)) |
| **1b** | 15 handlers whose response helper could not see the request's CORS headers | **READY_FOR_APPROVAL** (Cloud backend: the broken versions are exactly `c0da3818e`, "Deployed 323 backend functions") | on the legacy production project, compare first: if its copies still declare a module-level `corsHeaders`, they are not broken there and need nothing |
| excluded | `desk-agent` | **BLOCKED** | `_shared/premiumSwitch.ts` is absent from the production project; no substitute was written and no premium check is replaced by free access. The fix it carries here (the model could choose the tool it runs) stays undeployed until the file is there. To unblock: paste the self-contained `_shared/premiumSwitch.ts` first (it is the Premium kick-off switch, the owner's decision), then `desk-agent`: `LOT4_PASTE_KIT.md` section 4 |
| excluded | `desk-agent-watch` | not activated | AGENTS.md keeps it disabled while the legacy backend is active; its only change here is the CORS-helper fix |
| excluded | `public-digital-presence` | Cloud only | it is hosted on the Cloud backend (AGENTS.md); its quota function is `drizzle/migrations/0000`, not part of the legacy pack |

## 1. Functions of batch 1 (exact)

| Group | Function | Change | JWT setting to keep |
|---|---|---|---|
| approvals (SEC-26/27) | `copilot-collaborator-tools` | `add_collaborator` bound to person and project, single use, no name fallback | as today (session required in code) |
| | `copilot-executor` | decision required, plan claimed once, registry decides each step | as today |
| | `agent-orchestrator` | no retargeting through `edited_args`, approval record or nothing | as today |
| payment-link and prospection mail | `send-invoice-email` | one plain recipient, escaped, bounded, settled invoices refused | as today |
| | `send-outreach-draft` | one plain recipient, one-line subject, escaped body, hourly limits | as today |
| profile enrichment | `enrich-creator-profile`, `enrich-press-links`, `enrich-credits` | own profile, admin, or the platform | as today (the batch calls it with the service-role key, which passes Verify JWT) |
| SSRF | `extract-event-details`, `transcribe-voice-note`, `send-push-notification` | network policy on a member-supplied address | as today |

**Verify JWT: preserved everywhere.** `supabase/config.toml` carries no per-function setting (3 lines), so the toggle lives in the Lovable
project. Every function above authenticates inside its own code (`getUser`, `getClaims`, `requireAiCaller`), so leaving Verify JWT as it is
costs nothing and changing it would only widen what an anonymous caller reaches the code with. No justification to turn any of them off exists
in this batch. (`handle-email-unsubscribe`, `redeem-project-share`, `public-digital-presence` are public by design and are not in batch 1.)

## 2. Shared files and who imports them (transitively)

Paste in this order, before any function:

| # | File | New or changed | Imported by (transitively) |
|---|---|---|---|
| 1 | `_shared/ssrf.ts` | changed: bounded fetch is now a bytes core plus a text wrapper; new `safeFetchBytes`. Existing exports and behaviour unchanged (96 existing tests pass) | 15: analyze-profile-url, epk-og-image, external-claim, external-discovery-run, external-import, extract-event-details, fetch-link-metadata, fetch-og-data, fetch-portfolio-data, generate-sitemap, import-profile-from-url, import-profile-url, scrape-thumbnail, send-push-notification, transcribe-voice-note |
| 2 | `_shared/aiPerimeter.ts` | changed: `requireAiCaller` now returns `{ id }` (callers that ignore the return value are unaffected) | 36, among them the batch's enrich-creator-profile, enrich-credits, enrich-press-links, transcribe-voice-note |
| 3 | `_shared/outboundBudget.ts` | changed: one constant added (`OUTREACH_GMAIL_TEMPLATE`) | 6: notify-swipe, send-event-invite, send-invoice-email, send-outreach-draft, send-outreach-email, send-project-invitation |
| 4 | `_shared/approvalHardening.ts` | new | copilot-executor, agent-orchestrator (and desk-agent, excluded) |
| 5, 6 | `_shared/enrichmentAccess.ts`, `_shared/enrichmentCaller.ts` | new | the three enrichment functions |
| 7 | `_shared/invoiceEmail.ts` | new | send-invoice-email |
| 8 | `_shared/voiceNote.ts` | new | transcribe-voice-note |
| 9 | `_shared/pushEndpoint.ts` | new | send-push-notification |

Pasting a changed shared file does not change the other consumers until each is next deployed, and every change to a shared file is additive, so
**no consumer outside the batch has to be redeployed.** `_shared/durableBudget.ts` (new, no importer) is not part of the batch: nothing calls it.

## 3. Prerequisites in the production project (to check read-only before pasting)

The new files import these from shared files that already exist in the repository; the production project must expose the same names:

* `_shared/guard.ts`: `corsFor`, `GuardError`, `safeError`, `requireUser`, `rateLimit`, `constantTimeEqual`, `readJson`
* `_shared/aiPerimeter.ts` (as pasted from step 2), `_shared/outboundText.ts` (`escapeHtmlText`, `cleanRecipientEmail`, `singleLine`)
* `_shared/agentAuthority.ts`, `_shared/agentActionBinding.ts`, `_shared/executionGuard.ts`, `_shared/notificationGuards.ts`, `_shared/aiModels.ts`
* the function `consume_ai_feature_call` (used by the member perimeter and the per-address limits). Read-only check, in the SQL Editor of kretopia-app:

```sql
SELECT p.oid::regprocedure AS signature, p.prosecdef AS security_definer
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'consume_ai_feature_call';
```

If a name is missing the function fails at boot with an import error and answers nothing: that is why the order below starts with ONE function.

## 4. Order of activation, check after each step, way back

1. Paste the nine shared files (section 2 order). Nothing changes yet.
2. Deploy **`send-invoice-email`** alone (smallest reach: it needs `guard.corsFor`, `outboundText`, `outboundBudget`, `invoiceEmail`).
   Check: `POST` with a malformed `recipientEmail` -> 400 `A single valid recipient email is required`; with another member's invoice id -> 404
   `Invoice not found`; with no `Authorization` -> 401. If it answers a platform 500, a shared export is missing: stop, roll back (below).
3. Deploy `send-outreach-draft`, then `enrich-creator-profile`, `enrich-press-links`, `enrich-credits`.
   Check: as a member, `enrich-creator-profile` with another member's `user_id` -> 404 `Profile not found`, own id -> 200; `enrich-credits` with no
   `user_id` -> 403. Run batch-enrich-profiles once as an admin on one unclaimed profile and see it succeed (it was failing since the member perimeter).
4. Deploy `extract-event-details`, `transcribe-voice-note`, `send-push-notification`.
   Check: `extract-event-details` with `source_url` `http://169.254.169.254/` -> 400 `That link cannot be read`; `transcribe-voice-note` with another member's
   message id -> 404; send one real push notification to your own device and see it arrive.
5. Deploy `copilot-collaborator-tools`, `copilot-executor`, `agent-orchestrator`.
   Check: `copilot-executor` with no `decision` -> 400; Kreto proposes "add Alice to project X", approve it once in the app -> Alice is added;
   approve the same action again -> refused (409/410). Remove Alice and replay the old approval id -> refused.
6. Watch the edge function logs for an hour for `Error in ...` lines and for 4xx spikes on the functions above.

**Way back, per function:** paste `git show c0da3818e:supabase/functions/<function>/index.ts` back (the state before this branch) and redeploy that function.
Roll `transcribe-voice-note` and `send-push-notification` back BEFORE `_shared/ssrf.ts`/`pushEndpoint.ts` if you roll those back (they import them).
The new shared files can stay: nothing else imports them.

## 5. Tests that already exist for the batch

Positive and negative, all run against the real handlers with a fake database and a fake provider (no real network, no real provider):
`approvalHardening.test.ts`, `edge/copilotExecutorApproval.test.ts`, `edge/collaboratorToolsApproval.test.ts`, `agentActionBinding.test.ts`,
`invoiceEmail.test.ts`, `edge/sendInvoiceEmail.test.ts`, `edge/sendOutreachDraft.test.ts`, `notificationGuards.test.ts`,
`enrichmentAccess.test.ts`, `edge/enrichmentTargets.test.ts`, `edge/ssrfConsumers.test.ts`, `edgeCorsScope.test.ts`.
What they cannot show: the real Deno runtime, the real DNS (rebinding cannot be pinned from this runtime and is stated as a limit), a real provider, a real JWT.

## 6. Batch 1b (the 15 handlers)

`create-meeting`, `mint-meeting-token`, `redeem-project-share`, `handle-email-unsubscribe`, `draft-outreach-email`, `send-invoice-chase`,
`generate-clips`, `generate-moodboard-image`, `generate-studio-copy`, `generate-studio-image`, `krepay-ai-insights`, `purge-expired-recordings`,
`thrivefund-ai-assist`, `wallet-add-bank`, and `desk-agent-watch` (stays disabled). No shared file, no SQL; each file only moves a local helper
into its handler. Deploy one by one, check each with an unauthenticated call that must now answer its own 401 instead of a platform 500.
