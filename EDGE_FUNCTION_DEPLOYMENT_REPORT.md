# Edge Function Deployment Report

**Status: not deployed. Blocked — same access gap as
`LOVABLE_CLOUD_ACCESS_REPORT.md`.**

No Edge Function deployment was attempted this session. Per Section 6 of
the authorized procedure, deployment requires confirmed migrations,
verified environment variables, confirmed Cloud Secrets, a passing local
gate, and a confirmed target project — the last of those is not met
(`BLOCKED_LOVABLE_CLOUD_ACCESS`), so none of the rest was checked either.

## Functions with local changes not yet confirmed live

| Function | Change | Local verification | Live deployment status |
|---|---|---|---|
| `krepay-ai-insights` | New function (AI financial summary) | `npm run typecheck`/`build` clean; its *failure path* (404/CORS, since it isn't deployed) was live-verified during earlier browser testing — the app correctly showed a visible error with retry, no crash | **Not deployed.** Confirmed not reachable — the 404/CORS observed during live testing is direct evidence of this, not an inference. |
| `stripe-marketplace-webhook` | Added Stripe-event-ID dedup | Typecheck/build clean (edge functions aren't covered by the app's `tsconfig`, so this is a syntax-level check only, not a full compile check — Deno-specific) | **Deployment status unconfirmed** — no way to check deployed revision without Lovable Cloud/Supabase access |
| `wallet-payout` | Added client-supplied idempotency key to `stripe.payouts.create` | Same as above | **Unconfirmed** |
| `wallet-transfer` | Reserve-before-act idempotency via `wallet_transfers.idempotency_key` | Same as above | **Unconfirmed** |
| `create-connect-payment`, `create-payment` | Deleted (dead, unsafe code) | Confirmed deleted from source; **deleting source does not by itself undeploy an already-live function** | **Unconfirmed whether these are still live and callable** — this is a real open question, not a formality, since a dead-but-still-deployed function with a client-controlled amount/destination remains reachable regardless of what the repo's source says |

## What deployment verification would require, once access exists

Per Section 6: for each function above, confirm the deployed revision
ID, deployment timestamp, current logs, and — specifically for the two
deleted functions — confirm via `supabase functions list` (or the
Lovable Cloud equivalent) that they no longer appear as deployed at all,
not just that their source is gone from this repo. "Reachable" or
"unreachable" from a test request is not sufficient on its own per the
governing instruction (*"Do not claim a function is live from
reachability alone"*) — a deployed-revision/build-ID/timestamp is the
required evidence, and none of that exists in this session.
