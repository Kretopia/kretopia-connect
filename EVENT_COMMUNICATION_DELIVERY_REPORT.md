# Event Communication Delivery Report

## Status: `AUDITED`. No code changed this round — every traced path was already correctly implemented (idempotent, authorized, server-side recipient derivation). One known performance item (N+1) confirmed still present and deliberately deferred, as it was in the prior audit round.

| Trigger | Email expected? | In-app expected? | Current code path | Actual failure | Fix | Idempotency | Test evidence | Status |
|---|---|---|---|---|---|---|---|---|
| Comment posted | No | Yes (host + other commenters) | `EventComments.tsx` insert → `notify_event_comment` RPC (`20260905120000_...sql`) | None found — RPC is `SECURITY DEFINER`, authorizes via `auth.uid() = comment.user_id`, derives recipients server-side | None needed | `dedupe_key` unique index, `ON CONFLICT DO NOTHING` | Code read only; no live send triggered | `AUDITED`, correct |
| Comment posted (push) | No | Yes, via browser push | `sendPushNotification()` → `send-push-notification` edge fn | None found — `hasRealRelationship()` server-side check (shared event/connection/project/application) prevents targeting arbitrary users | None needed | N/A (fire-once per comment, not re-triggered) | Code read only | `AUDITED`, correct |
| Event starting in 24h | Yes | Yes | `event-reminders/index.ts` `sendReminder()`, cron-driven | N+1 query per participant (profile lookup + `auth.admin.getUserById` + email invoke, all per-user in a loop) — confirmed still present, same as prior audit | Not fixed this round — performance debt, not a correctness bug | `event_reminders_sent` table, checked before send | Code read only; no live send triggered | `AUDITED`; N+1 `DEFERRED_AFTER_DEADLINE` |
| Event starting in 1h | No (push only) | Yes | Same function, same loop | Same N+1 as above (no email leg for this trigger, so lower cost) | Not fixed this round | Same table | Code read only | `AUDITED`; N+1 `DEFERRED_AFTER_DEADLINE` |
| Event starting in 24h (legacy path) | Yes | No | `send-event-reminders/index.ts`, cron-driven | None found — this older function explicitly cross-checks the *same* `event_reminders_sent` table the newer function writes to, plus its own `email_send_log`, specifically so a user is never double-emailed if both functions are ever scheduled together | None needed | Dual: `email_send_log` + cross-function check against `event_reminders_sent` | Code read only | `AUDITED`, correct |
| Event ended ~2h ago (recap) | No | Yes | `event-reminders/index.ts` `runPostEvent()` | None found | None needed | `event_reminders_sent` (`recap_2h_after` type) | Code read only | `AUDITED`, correct |
| Event ended ~48h ago (reconnect nudge) | No | Yes | `event-reminders/index.ts` `sendReconnectNudge()` | None found | None needed | `event_reminders_sent` (`reconnect_48h` type) | Code read only | `AUDITED`, correct |
| Event ended (host credit + promoter rewards) | No | Yes (promoter only) | `event-reminders/index.ts` `runPostEvent()` | None found | None needed | Credit dedup via `(user_id, source, source_id)`; reward dedup via `event_promoter_rewards` upsert on `(event_id, referred_user_id)` | Code read only | `AUDITED`, correct |

## Cron scheduling — `NOT_CONFIRMED`

No `cron.schedule` call referencing `event-reminders` or `send-event-reminders` exists in any migration. Scheduling for these appears to live outside the repository (Supabase or Lovable dashboard), which this environment cannot inspect. **This is the one item in the whole communications path this audit could not resolve from source alone** — recommend confirming directly in the Lovable/Supabase dashboard which function(s) are actually scheduled, and at what cadence, since the dedup logic only *prevents a duplicate send*, it doesn't confirm either function is actually running at all.

## Environment / configuration

- Both edge functions require `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — `send-event-reminders` explicitly checks for their presence and returns a clean 500 with a logged error if missing (`index.ts:17-26`); `event-reminders` reads them via non-null assertion at module load (`index.ts:18-19`), which would throw a less-clean error on a genuinely missing var — `AUDITED`, a minor inconsistency in error-message quality between the two functions, not a functional gap (both would fail loudly either way, not silently).
- Both are gated by `requireAdminOrCron` (`supabase/functions/_shared/admin-guard.ts`) — confirmed present and checked first in both functions before any work happens.

## No changes made in this report's scope

Per the brief's own priority ordering and non-destructive-changes rule, the N+1 pattern was deliberately left as-is — it's a known, already-previously-deferred performance item, not a correctness or security bug, and batching it properly would touch several query shapes in a function that's otherwise working correctly. Fixing it is a good candidate for `DEFERRED_AFTER_DEADLINE` follow-up work, not today's P0 pass.
