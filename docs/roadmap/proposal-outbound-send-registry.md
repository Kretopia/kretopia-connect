# Proposal: durable per-account outbound send registry

Proposal only. **Nothing here was applied, and nothing here is runnable.** The statement sketches use `<PLACEHOLDER>` tokens and will fail if pasted (a past draft SQL block in a proposal was pasted and run). The real migration is written only after approval, in its own PR, against the live definitions captured in step 0.

Matrix row 13 (GA AUX-05; CE p.17, p.21, p.36) and the "durable per-user outbound registry" item of the program. It replaces the interim control introduced by the third outbound pass (`email_send_log` rows tagged with the acting user), which counts attempts only, has no index on the actor and cannot make a send idempotent.

## 0. Prerequisite: capture the live state (read-only, by someone with production access)

- the effective definition, indexes, policies and grants of `email_send_log`, `email_send_state` and the queue functions that read them;
- row counts of `email_send_log` by `template_name` and by day for the last 30 days (the size of the table the interim counter scans);
- which senders write to `email_send_log` today (`send-transactional-email`, `send-weekly-digest`, and, from PR #165, `send-project-invitation` and `send-outreach-email` under the template names `project-invitation-direct` and `outreach-direct`).

## 1. Objects affected and current unsafe behaviour

| # | Object | Behaviour today | Consequence |
|---|---|---|---|
| R-A | senders that call a provider directly (`send-outreach-email`, `send-project-invitation`, `send-get-paid-link`, `verify-guest-opportunity`, `send-phone-otp`, `send-event-invite`, `send-credit-invite`) | no common budget; the last three passes added per-function limits (per recipient per hour, per account per hour, an OTP cooldown), each with its own source of truth | a limit lives in one function, and an attacker or a bug in another is unlimited; a daily or monthly bound exists nowhere |
| R-B | idempotency | a "send once" is enforced per case: an action claimed by compare-and-set (`agent-send-dm`), a sequence email claimed pending to sent, a transactional `idempotencyKey` | a new sender has to reinvent it; a crashed send leaves "claimed, not delivered" with no record of which |
| R-C | `email_send_log` | an audit trail of the queue, `message_id` unique per `sent`, no actor column; `metadata.actor_user_id` is a convention | counting by actor scans a JSON path; SMS, WhatsApp, push and DMs are not in it at all |

## 2. Target (what must be true afterwards)

1. One server-side authority records and decides every outbound send to a person who is not the actor: channel, kind, actor, recipient (normalised, stored as a hash plus the domain or country for reporting), an idempotency key, a status, the provider message id, a time.
2. A send is **reserved before** it is attempted: the reservation checks the actor's windows (hour, day, month), the recipient's windows, and the idempotency key atomically, in one call. A repeated key returns the earlier outcome instead of a second send.
3. A reservation that never reached `sent` or `failed` is visible as `unknown` after a timeout, so that a retry is a decision, not a guess (the "outcome_unknown" state the execution MVP document lists as missing).
4. Clients cannot read or write it. The service role only. The actor can read **their own counts** through a function (for the UI: "12 of 30 this hour").
5. Limits are data (per channel and kind, with a subscription-tier multiplier), not constants in each function.
6. Retention is bounded (90 days of rows; aggregates kept longer).

## 3. Migration sketches (NOT RUNNABLE, for review of intent only)

```
-- R-1  the registry table                                         [fixes R-A, R-B, R-C]
-- NOT RUNNABLE
CREATE TABLE public.<outbound_send_registry> (
  <id> uuid PK,
  <actor_user_id> uuid NOT NULL,          -- the authenticated actor; never trusted from a body
  <channel> text NOT NULL CHECK (<channel> IN ('email','sms','whatsapp','push','dm')),
  <kind> text NOT NULL,                   -- 'project_invitation', 'outreach', 'otp', ...
  <recipient_hash> text NOT NULL,         -- hash of the normalised address or number
  <recipient_scope> text NULL,            -- domain or country code, for reports without PII
  <idempotency_key> text NOT NULL,        -- caller-chosen, bound to actor
  <status> text NOT NULL CHECK (<status> IN ('reserved','sent','failed','suppressed','unknown')),
  <provider_message_id> text NULL,
  <reserved_at> timestamptz NOT NULL DEFAULT now(),
  <settled_at> timestamptz NULL,
  UNIQUE (<actor_user_id>, <idempotency_key>)
)
-- index on (actor_user_id, channel, reserved_at), (recipient_hash, channel, reserved_at)
-- RLS enabled, NO policy for anon or authenticated: service role only
```

```
-- R-2  the limits as data                                         [fixes R-A]
-- NOT RUNNABLE
CREATE TABLE public.<outbound_send_limits> (<channel>, <kind>, <window> ('hour','day','month'),
  <per_actor> int, <per_recipient> int, <tier_multiplier> jsonb)
-- seeded from the constants in the three passes: project invitation 20 and 3 per hour,
-- outreach 30 and 3 per hour, OTP one per 60 s, guest verification 3 per address per hour
```

```
-- R-3  one atomic reservation                                     [fixes R-B]
-- NOT RUNNABLE
CREATE FUNCTION public.<reserve_outbound_send>(<actor>, <channel>, <kind>, <recipient_hash>,
                                               <idempotency_key>, <recipient_scope>)
  RETURNS TABLE (<outcome> text, <registry_id> uuid, <retry_after_seconds> int)
  -- SECURITY DEFINER, EXECUTE only for service_role
  -- 1. if (actor, key) exists -> return its status (replay), insert nothing
  -- 2. count the actor's and the recipient's windows from the limits table
  -- 3. over a limit -> outcome 'limited'; otherwise insert 'reserved' and return 'ok'
CREATE FUNCTION public.<settle_outbound_send>(<registry_id>, <status>, <provider_message_id>)
CREATE FUNCTION public.<my_outbound_counts>()   -- authenticated: the caller's own windows only
-- a scheduled sweep marks 'reserved' older than <5 minutes> as 'unknown'
```

Shared code that goes with it (a separate PR, after approval): `_shared/outboundBudget.ts` keeps the pure `decideSendBudget` and swaps its two `email_send_log` readers for one call to `<reserve_outbound_send>`; each sender calls reserve, sends, then settles.

## 4. Storage policy impact

None. No bucket, no storage policy.

## 5. Data migration, backfill and compatibility

| Item | Plan |
|---|---|
| Existing rows | none copied: the registry starts empty. The interim `email_send_log` rows keep their meaning for the queue |
| Cut-over | per sender, one at a time, in this order: `send-phone-otp`, `send-project-invitation`, `send-outreach-email`, `verify-guest-opportunity`, `send-get-paid-link`, `send-event-invite`, `send-credit-invite` |
| During the cut-over | a sender reads both counters and refuses on either (the stricter wins), so nothing becomes unlimited between steps |
| Privacy | the registry stores a hash of the address, not the address. If support needs the address, it is looked up from the provider log by message id |

## 6. RLS impact by role

| Role | Registry | Limits | `my_outbound_counts()` |
|---|---|---|---|
| anonymous | no access | no access | no access |
| authenticated, any | no access to rows | no access | own windows only |
| admin | no direct access in the app; read through a report function if wanted | managed by migration | n/a |
| service role | read and write through the three functions | read | n/a |

## 7. Decisions needed from the approver

1. **Limits.** The numbers above come from three code passes, not from a product decision. Approve them, or set per tier.
2. **Recipient storage.** Hash only (recommended), or the plain address.
3. **Which senders are in scope for the first release.** Recommended: the seven listed in section 5.
4. **Unknown outcomes.** Whether a send in `unknown` may be retried automatically (risk: a duplicate) or only by the actor.
5. **Retention.** 90 days of rows, aggregates kept: confirm.

## 8. Rollout sequence

1. Capture section 0.
2. Migration R-1 to R-3 (additive, no sender changed). Verify with a service-role call and an anonymous call that is refused.
3. Code PR for the first sender (OTP), pasted manually; run the test table of section 10.
4. One sender per PR after that, each pasted and verified before the next.
5. Remove the interim `email_send_log` counters after the last sender and a clean week.

## 9. Rollback

Each sender PR is reverted by re-pasting the previous function (the interim counter returns). The tables and functions are additive and can stay unused; dropping them is a separate step. Save the section 0 definitions first.

## 10. Tests required before each step

Roles: the actor, a second actor, an unrelated authenticated user, anonymous, the service role.

| Case | Expected |
|---|---|
| actor reserves under every limit | `ok`, a `reserved` row |
| the same idempotency key again | the earlier outcome, no second row, no second send |
| the actor over the hour limit | `limited` with a retry delay, nothing sent |
| a second actor to the same recipient over the recipient limit | `limited` |
| a different actor reusing the first actor's key | independent (the key is per actor) |
| an authenticated client selects the registry | refused |
| an authenticated client calls `reserve_outbound_send` | refused |
| a provider failure | `failed`, and the retry is a new key |
| a process dies after reserve | `unknown` after the sweep, visible to the actor in their counts |

## 11. Estimated blast radius

Low for the migration (additive, no reader yet). Medium per sender cut-over: a wrong limit blocks a real send (a visible 429), never opens one. The only way this proposal makes things worse is a reserve call that fails closed for everyone: it must answer 503 for the actor, not hang.

## 12. Not in scope

Provider spend caps (`proposal-twilio-spend-controls.md`), credential storage (`proposal-gmail-credential-storage.md`), the merge-code template (`proposal-account-merge-otp-template.md`), unsubscribe and suppression (the existing queue), per-workspace budgets (Company Experience, after its own gate).
