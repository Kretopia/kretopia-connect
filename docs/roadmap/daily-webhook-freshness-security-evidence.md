# Slice G: the Daily recording webhook bounds the age of a signed request

Gate audit finding: **GA REL-04** (§4). Matrix row 19 of `gate-audit-company-experience-execution-matrix.md`.
Status of this slice: code only, no migration, **not deployed**.

## Threat addressed

`daily-recording-webhook` verifies an HMAC over `${timestamp}.${body}` but never looked at the timestamp. A captured genuine request therefore stayed valid indefinitely: replaying it re-triggered processing for any recording that was not yet `ready` (GA REL-03 describes the retry and duplicate-effect consequences).

## Affected actor, object, action

| Actor | Object | Action |
|---|---|---|
| Anyone holding an old captured request (body, signature, timestamp) | `daily-recording-webhook` | Replay it |

## Code paths changed

| File | Change |
|---|---|
| `supabase/functions/_shared/webhookFreshness.ts` (new) | Pure `checkWebhookTimestamp(header, nowSeconds, tolerance)`. Digits only, 1 to 13 characters; a millisecond epoch is normalised; outside the window in either direction, or unparsable, is a denial. Default window 900 s. |
| `supabase/functions/daily-recording-webhook/index.ts` | Computes both candidate signatures separately. After the signature is verified, if the **timestamped** form matched, its timestamp must be fresh (401 otherwise). If only the legacy raw-body form matched, the request is accepted as before and a warning is logged that its age cannot be bounded. Nothing else in the handler changed. |
| `src/lib/__tests__/webhookFreshness.test.ts` (new) | Window edges, millisecond epoch, invalid values, and a source-order contract. |

Unchanged on purpose: the mandatory HMAC secret, constant-time comparison, the legacy raw-body signature acceptance, the `test`/`ping` echo, event filtering, idempotency by `recording_id`.

## Why a 900 s window, and what to decide

Stripe uses 300 s. Daily's retry behaviour (whether a retried delivery is re-signed with a new timestamp or keeps the original one) is not documented in this repository. A tight window would silently drop a legitimate late retry; `sync-daily-recordings` would eventually pick the recording up, but with a delay. 900 s trades a slightly longer replay window for not breaking retries. **Decision for the approver:** keep 900 s, or tighten once Daily's retry timestamps have been observed in the function logs.

## Remaining gaps (not in this PR)

- **No event ledger.** A replay inside the window is still accepted; protection against repeated effects still rests on the existing `recording_id` lookup (GA REL-03: non-atomic). A durable ledger or a unique constraint is a Phase 2 proposal.
- **The raw-body fallback is unbounded.** If Daily (or an old configuration) signs the body alone, such a request carries no time and can be replayed. Removing the fallback is a one-line change but could break an older webhook configuration; it needs confirmation of which form production actually sends. The new warning line makes that observable in the logs without changing behaviour.
- Other webhooks (Stripe has its own tolerance in `_shared/stripeSignature.ts`) were not touched.

## Acceptance tests

Automated (vitest): `src/lib/__tests__/webhookFreshness.test.ts`

| Case | Expected |
|---|---|
| timestamp now, 5 s old | accepted |
| exactly at the window edge, either direction | accepted |
| one second past the window, either direction | rejected (`timestamp_outside_tolerance`) |
| a week old | rejected |
| millisecond epoch, recent | accepted (normalised) |
| missing, blank, non-numeric, decimal, negative, zero, exponent, too long | rejected (`timestamp_invalid`) |
| source order | signature check, then freshness, then JSON parse and `findCall` |

Manual, staging-safe (not run: no staging access): send a genuine signed test event (fresh: 200); resend the same body and signature with the original timestamp after the window (401); send a raw-body-signed event (200 plus the warning log).

## Rollback

Revert the PR. No data, schema or secret changed.

## Release

PR only; no automatic deploy. Edge functions deploy through the documented Lovable paste path, which needs explicit approval. After deploying, watch the function logs for `rejected: timestamp_outside_tolerance` and for the raw-body warning for a day before deciding on the two open points above.
