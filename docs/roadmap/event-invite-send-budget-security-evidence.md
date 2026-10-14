# send-event-invite: a host's list is bounded

Slice X, fourth sender pass (after `outbound-senders-security-evidence.md` #161, `-review-` #162 and `-third-pass-` #165). Gate: *what makes Kretopia send a message is triggered by a proven actor, to a recipient the actor is entitled to reach, with a bounded blast radius, once.* Code only: no migration, no policy, no secret, no data change. Not deployed. Repository findings; none was reproduced against production.

## Finding
| # | Where | Evidence | Effect |
|---|---|---|---|
| X1 | `send-event-invite` | The only gate was "the caller created this event" (`creative_jams.created_by`). Any signed-in account can create an event. Then up to **500 addresses per call**, of people who are not users, with no cap per account, per day or per address; only the idempotency key `invite-<event>-<email>` stopped a repeat, and a new event makes a new key. | One account could mail an unbounded number of strangers from our sender address, and mail one stranger from any number of events. The third-pass doc listed it as a remaining gap. |
| X2 | same | `personalNote` was `personalNote?.trim()`: unclipped, any type (an object throws a 500), control characters kept. It is rendered in the branded mail as a quoted note. | A free-text channel of any length in a mail that carries our name. |
| X3 | same | Recipient validation was `^[^\s@]+@[^\s@]+\.[^\s@]+$`: it accepts `a@b.c>`, quotes, commas and brackets. `refUsername` went into the link as supplied (encoded, but any string). | Malformed or header-like addresses reach the sender; the ref is not constrained to a username. |

## What changed (3 source files + 1 test)
- `_shared/outboundBudget.ts` (same module as #165): `planBulkSend` (one decision for a list), `countRecipientSendsBulk` (per-address counts in chunks of 100), `recordActorSendBatch` (one insert for the list), and the limits. Rule: **a count that could not be read is not zero**: 503 and nothing sent.
- `send-event-invite`:
  - the host-owns-the-event check is unchanged and still runs first;
  - **500 addresses per account per 24 h**, and **no address mailed by hosts more than 3 times per 24 h**, whichever hosts they are; the list is cut to what is left of the day, first addresses first, and the held-back ones are reported (`skipped`, `skipped_recently_contacted`, `skipped_over_limit`), never sent;
  - the registry rows (`email_send_log`, template `event-invite-direct`, actor in `metadata`) are written **before** the first mail; if they cannot be written, 503 and nothing is sent;
  - a test to the host's own address counts against the account's day but is not held back for having been mailed recently;
  - every address goes through `cleanRecipientEmail` (a single plain address); the note through `cleanFreeText(…, 500)`; the `ref` must look like a username (`[A-Za-z0-9_.-]{1,40}`) or the host's own username is used.
- `InviteByEmailDialog.tsx`: tells the host how many were not sent and why, and shows the function's own refusal message instead of the generic one.

## Tests
`src/lib/__tests__/eventInviteBudget.test.ts` (new, 17): list under both limits; an address mailed 3 times held back even for a fresh account; the list cut to the remaining allowance in order; 429 when the day is used up or every address is held back; **503 when either count failed**; chunked counting; one insert with the actor and unique ids; an empty list writes nothing and a failed write is reported; wiring (owner check before any count, budget then registry then send, only `plan.allowed` is iterated, 503 when the registry write fails, validation, clipped note, username-shaped ref, skipped reported). Not run: a real send, a real Resend queue.

## Not addressed
- The registry is still `email_send_log` metadata, not a purpose-built table (`proposal-outbound-send-registry.md`): no actor index and no purpose-built window.
- The cap is per account and per address; a host can still mail 500 different addresses a day to people who never asked. Content is the host's own free text (now clipped); the title and host name of the event are also host-controlled and are not reviewed here.
- `send-event-blast`'s `listUsers({ perPage: 1000 })` correctness bug, `send-user-email` / `send-transactional-email` per-recipient-only caps, and the six remaining "signal only" senders (`rsvp-speed-session`, `send-invoice-chase`, `thrivefund-create-pledge`, `notify-swipe`, `notify-speed-pool-ping`, `notify-speed-session-update`).

## Release
Paste `_shared/outboundBudget.ts` first (it already has older copies of the same file in the bundle: paste the new one), then `send-event-invite`. Publishing the frontend is independent: the dialog works with the old function (it ignores the new fields).

## Rollback
Re-paste the previous `send-event-invite`. `_shared/outboundBudget.ts` can stay: the added exports are unused by the old function. Registry rows written under `event-invite-direct` are harmless.
