# Event Reminders — N+1 Query Fix Report

Follow-up to the N+1 pattern flagged in both Deadline Day audit rounds and deliberately deferred each time as performance debt, not a correctness bug (`DEADLINE_DAY_EVENTS_AND_UX_AUDIT.md` §D/§F.3, `EVENT_COMMUNICATION_DELIVERY_REPORT.md`).

## Status: `IMPLEMENTED`. No local Deno type checker available in this environment (same limitation as every edge-function change this session) — verified via careful manual review of the diff instead; `PRODUCTION_VERIFIED` pending redeploy and a real cron run.

## What was actually fixable

`supabase/functions/event-reminders/index.ts`'s `sendReminder()` did four things per participant in a sequential loop: a `profiles` name lookup, an `auth.admin.getUserById()` call, a conditional `send-transactional-email` invoke, and two inserts. Checked whether each could be batched:

- **Name lookup**: batchable — replaced the per-participant `.eq("user_id", p.user_id).maybeSingle()` query with a single `.in("user_id", [...])` query before the loop, mapped by user id.
- **`auth.admin.getUserById()`**: **not** batchable — the standard Supabase GoTrue admin API has no bulk "get users by id list" endpoint (`listUsers()` only paginates through *all* users, not a filtered subset, so it isn't a practical substitute for looking up an arbitrary sparse set of RSVP'd participants). Checked whether another function in this codebase had already solved this (`send-weekly-digest`) — it has the exact same per-user `getUserById()` pattern, confirming this is a real API limitation, not something previously solved and simply not reused.
- **Email send + notification insert**: inherently per-recipient (personalized content), but independent of each other across participants — safe to run concurrently.

## Fix

Batched the name lookup, and converted the remaining per-participant work into a closure (`sendOne`) run via `Promise.all` in bounded batches of 25 at a time, instead of a sequential `for...of` loop. For any event with a typical attendee count (well under 25), this is now effectively fully parallel; for an unusually large event, the batch cap prevents firing hundreds of simultaneous admin-API and email calls at once. The number of external calls is unchanged (this was never reducible below one `getUserById` and one email-send per emailed recipient) — what changes is that they no longer wait on each other, so wall-clock execution time no longer scales linearly with participant count.

Every per-participant behavior (idempotency checks against `event_reminders_sent`, error handling, `stats` counters) is unchanged — only the scheduling (sequential vs. concurrent-batched) and the name-lookup query shape changed.

## Verification

- No local Deno type checker available (`deno` not installed in this environment) — this is normal for edge-function work in this session; every prior edge-function change was verified the same way.
- Manually reviewed the full diff for correctness: closure captures are all in scope, braces balanced, batching loop correctly slices and awaits sequentially across batches while parallelizing within each batch.
- `npx tsc --noEmit -p tsconfig.app.json` / `npm run build` — both clean (this file isn't covered by the app's own tsconfig, which only includes `src/`, but confirms no collateral damage to the rest of the app).
- `PRODUCTION_VERIFIED`: not possible without a redeploy and an actual cron-triggered run against a real event with multiple participants — same limitation as every prior edge-function change this session.

## Deployment steps required

1. Merge the PR.
2. Redeploy the `event-reminders` edge function via Lovable's chat, same workflow as every other edge-function change this session.
3. No migration needed — no schema change.
