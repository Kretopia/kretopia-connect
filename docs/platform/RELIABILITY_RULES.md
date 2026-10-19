# Reliability rules

Applies to every Edge Function and to the client code that calls them. Reference implementations: `daily-recording-webhook`, `sync-daily-recordings`, `speed-session-reminders`.

## 1. Error contract
| Status | Use |
|---|---|
| 400 | Input is missing or malformed. |
| 401 | No valid session, signature, or cron secret. |
| 403 | Authenticated but not allowed (including a revoked member). |
| 404 | The object does not exist, or the caller must not learn that it does. |
| 409 | A real conflict. A replay of an already-done operation is **200** with `dedup: true`. |
| 429 | Rate limited. |
| 502 | A provider (Daily, Stripe, AI gateway) failed or answered unusably. |
| 503 | A lookup needed for a security decision failed. Deny. |
| 500 | Anything unexpected. |

- Error body: `{ "error": "<sentence for a person>", "code": "<stable_snake_case>" }`. Never a stack trace, SQL text, provider response body, `String(e)`, or an id the caller may not see.
- Server log, one line per failure: `console.error("[<function>] <what failed>", { ids, code })`. No tokens, emails, or payloads.
- Every handler has one outer `try/catch` that answers 500. An empty `catch` is allowed only around a best-effort side effect, with a log line.

## 2. Never fake success
- 2xx means the required durable work is **done or safely queued**. Queue only after the canonical row exists, and use `EdgeRuntime.waitUntil` for background work.
- `supabase.functions.invoke()` and every `.insert/.update/.upsert/.delete` return `{ error }` and do not throw. Read it.
- A provider or AI failure never becomes canned content, a default score, or "verified". Answer 502.
- Batch or cron work: all units failed gives 5xx; some failed gives 200 with `{ ok: false, failed: n }`; none failed gives 200 `{ ok: true }`.
- A fail-open check is a decision, not a default. Current exception: `moderate-opportunity` (documented in `REPO_AUDIT.md`).
- Client code keeps loading, empty, and error as three different states. An error is never rendered as "nothing yet".

## 3. Webhooks
Order: verify signature, check freshness, parse, claim idempotency, do the work, answer.
- Answer 401 for a bad signature or stale timestamp, 400 for a signed event missing required fields, 500 when required work failed so the provider retries.
- Answer 200 only for an event that needs nothing from us (test ping, unrelated event type, a room that is not ours). Say why: `{ "ok": true, "ignored": "<reason>" }`.
- A failed lookup is a 500, never "no matching record" (providers do not retry a 2xx).
- Stripe events go through `_shared/webhookLedger.ts`; a failure that answers non-2xx releases the ledger row first.

## 4. Idempotency
A handler that can run twice (webhook redelivery, cron tick, client retry, sync) must be safe to run twice.
- Prefer a natural key or a unique index. Where no unique index exists, insert, re-read the rows for the key ordered by `(created_at, id)`, keep the first, delete your own (`_shared/recordingRow.ts`).
- Claim work with a compare-and-swap: `update ... where status in (...)` and `.select("id")`; zero rows means another run owns it (`transcribe-call`).
- Write the "done" flag in the same step as the effect, check its error, and send mail with an idempotency key.
- Credits, co-signs, Passport updates: one effect per `(object, actor, action)`; a replay returns the existing result.

## 5. Cron and background functions
- Authenticate with `requireAdminOrCron`. Never open a service-role function to the anon key.
- Return counts: `{ ok, processed, failed }`. Log each failed unit with its id.
- Keep per-unit failures from aborting the batch, but surface them in the status code (section 2).

## 6. Review checklist
1. Can a failure here return 2xx? 2. Is every `{ error }` read? 3. Can this run twice? 4. Does the body leak internals? 5. Does the 401/403/503 path fail closed? 6. Is there a test that fails when the fix is removed?
